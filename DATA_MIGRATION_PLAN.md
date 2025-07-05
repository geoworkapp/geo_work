# Data Migration Plan for GeoWork Time Tracker

## Overview
This document outlines the data migration required to transition from legacy field names to the standardized field names defined in the shared models.

## Critical Field Changes Identified

### 1. CompletedShift Collection
**Location**: Firestore collection `completedShifts`
**Change**: `employeeId` → `userId`
**Impact**: High - affects all completed shift records
**Additional Fields**: Added `workSessionId` and `customFields`

```javascript
// Migration Script
db.completedShifts.find({}).forEach(function(doc) {
  if (doc.employeeId && !doc.userId) {
    db.completedShifts.updateOne(
      { _id: doc._id },
      {
        $set: {
          userId: doc.employeeId,
          workSessionId: doc.workSessionId || '', // Set default if missing
          customFields: doc.customFields || {}    // Set default if missing
        },
        $unset: { employeeId: 1 }
      }
    );
  }
});
```

### 2. TimeEntry Collection
**Location**: Firestore collection `timeEntries`
**Change**: Support both `employeeId` (legacy) and `userId` (new)
**Impact**: Medium - mobile app updated to support both field names
**Status**: ✅ Mobile app already handles both field names

### 3. Schedule Collection
**Location**: Firestore collection `schedules`
**Field**: `employeeId` remains for schedules (as employees are assigned to schedules)
**Impact**: Low - no change needed
**Status**: ✅ Correct usage

### 4. UserAssignment Collection
**Location**: Firestore collection `userAssignments`
**Change**: `employeeId` → `userId`
**Impact**: Medium - affects job site assignments

```javascript
// Migration Script
db.userAssignments.find({}).forEach(function(doc) {
  if (doc.employeeId && !doc.userId) {
    db.userAssignments.updateOne(
      { _id: doc._id },
      {
        $set: { userId: doc.employeeId },
        $unset: { employeeId: 1 }
      }
    );
  }
});
```

### 5. DeviceInfo Field Addition
**Location**: Various collections with deviceInfo subdocuments
**Change**: Added `deviceId` field
**Impact**: Low - optional field, defaults handled

## Migration Strategy

### Phase 1: Backward Compatibility (Current Status)
✅ **Completed**: 
- Mobile app reads both `employeeId` and `userId` fields
- Web admin uses correct field names
- Firebase Functions ready for shared types

### Phase 2: Data Migration Scripts
📋 **Required**: Create and execute Firestore migration scripts

#### A. CompletedShift Migration
```typescript
// Firebase Function for migration
export const migrateCompletedShifts = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Only superadmin can run migrations');
  }

  const batch = admin.firestore().batch();
  const completedShiftsRef = admin.firestore().collection('completedShifts');
  
  const querySnapshot = await completedShiftsRef.where('employeeId', '!=', null).get();
  
  querySnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.employeeId && !data.userId) {
      batch.update(doc.ref, {
        userId: data.employeeId,
        workSessionId: data.workSessionId || '',
        customFields: data.customFields || {},
        employeeId: admin.firestore.FieldValue.delete()
      });
    }
  });

  await batch.commit();
  return { migrated: querySnapshot.docs.length };
});
```

#### B. UserAssignment Migration
```typescript
export const migrateUserAssignments = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Only superadmin can run migrations');
  }

  const batch = admin.firestore().batch();
  const userAssignmentsRef = admin.firestore().collection('userAssignments');
  
  const querySnapshot = await userAssignmentsRef.where('employeeId', '!=', null).get();
  
  querySnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.employeeId && !data.userId) {
      batch.update(doc.ref, {
        userId: data.employeeId,
        employeeId: admin.firestore.FieldValue.delete()
      });
    }
  });

  await batch.commit();
  return { migrated: querySnapshot.docs.length };
});
```

### Phase 3: Validation and Cleanup
📋 **Required**: Verify migration success and remove backward compatibility

#### Migration Validation Script
```typescript
export const validateMigration = functions.https.onCall(async (data, context) => {
  const collections = ['completedShifts', 'userAssignments'];
  const results: Record<string, any> = {};

  for (const collectionName of collections) {
    const legacyCount = await admin.firestore()
      .collection(collectionName)
      .where('employeeId', '!=', null)
      .get()
      .then(snapshot => snapshot.size);

    const newCount = await admin.firestore()
      .collection(collectionName)
      .where('userId', '!=', null)
      .get()
      .then(snapshot => snapshot.size);

    results[collectionName] = {
      legacyFieldCount: legacyCount,
      newFieldCount: newCount,
      migrationComplete: legacyCount === 0
    };
  }

  return results;
});
```

## Migration Timeline

### Immediate (Completed ✅)
- [x] Mobile app supports both field names
- [x] Web admin uses correct field names  
- [x] Firebase Functions ready for shared types
- [x] Dart models synchronized with TypeScript interfaces

### Week 1 (Required)
- [ ] Deploy migration Cloud Functions
- [ ] Execute CompletedShift migration
- [ ] Execute UserAssignment migration  
- [ ] Validate migration results

### Week 2 (Cleanup)
- [ ] Remove backward compatibility code from mobile app
- [ ] Update mobile app to use only new field names
- [ ] Update Firestore security rules to reflect new schema
- [ ] Remove legacy field support

## Rollback Strategy

### Emergency Rollback
If migration causes issues, we can rollback using the reverse migration:

```typescript
export const rollbackMigration = functions.https.onCall(async (data, context) => {
  // Reverse the field changes
  const batch = admin.firestore().batch();
  
  // Rollback completedShifts
  const completedShiftsSnapshot = await admin.firestore()
    .collection('completedShifts')
    .where('userId', '!=', null)
    .get();
    
  completedShiftsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    batch.update(doc.ref, {
      employeeId: data.userId,
      userId: admin.firestore.FieldValue.delete()
    });
  });

  await batch.commit();
  return { status: 'rollback-complete' };
});
```

## Risk Assessment

### Low Risk ✅
- TimeEntry collection (mobile app handles both field names)
- DeviceInfo additions (optional fields)
- Schedule collection (no changes needed)

### Medium Risk ⚠️
- UserAssignment migration (affects job site access)
- Web admin compatibility during transition

### High Risk 🚨
- CompletedShift migration (affects payroll data)
- **Mitigation**: Full backup before migration + validation scripts

## Testing Strategy

### Pre-Migration Testing
1. Create test data with legacy field names
2. Verify mobile app reads both field formats
3. Test migration scripts on development environment
4. Validate data integrity post-migration

### Production Migration
1. **Backup**: Full Firestore backup before migration
2. **Monitoring**: Real-time monitoring during migration
3. **Validation**: Immediate post-migration validation
4. **Rollback Plan**: Ready rollback scripts if needed

## Success Criteria

### Technical
- [ ] Zero data loss during migration
- [ ] All applications work with new field names
- [ ] Performance maintained or improved
- [ ] Security rules updated correctly

### Business
- [ ] No impact on user workflows
- [ ] Payroll data accuracy maintained
- [ ] Time tracking continues uninterrupted
- [ ] Job site assignments preserved

## Execution Checklist

### Pre-Migration
- [ ] Full Firestore backup
- [ ] Migration scripts tested in dev environment
- [ ] Rollback scripts prepared
- [ ] Monitoring alerts configured
- [ ] Stakeholder notification sent

### Migration Execution
- [ ] Deploy migration Cloud Functions
- [ ] Execute CompletedShift migration
- [ ] Execute UserAssignment migration
- [ ] Run validation scripts
- [ ] Verify application functionality

### Post-Migration
- [ ] Remove backward compatibility code
- [ ] Update security rules
- [ ] Monitor for 48 hours
- [ ] Archive legacy migration code
- [ ] Document lessons learned

## Notes

- **Data Integrity**: All migration scripts include validation checks
- **Zero Downtime**: Migration can be performed without application downtime
- **Gradual Rollout**: Can migrate collections independently
- **Monitoring**: CloudWatch/Firebase monitoring during migration process

## Contact

For migration execution and rollback procedures, contact the development team with superadmin access. 