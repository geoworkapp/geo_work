import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function migrateData() {
  const db = admin.firestore();
  
  try {
    console.log('Starting migration...');
    
    // Migrate completedShifts
    const completedShiftsRef = db.collection('completedShifts');
    const completedShiftsSnapshot = await completedShiftsRef.where('employeeId', '!=', null).get();
    
    console.log(`Found ${completedShiftsSnapshot.size} completed shifts to migrate`);
    
    const completedShiftsBatch = db.batch();
    completedShiftsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.employeeId && !data.userId) {
        completedShiftsBatch.update(doc.ref, {
          userId: data.employeeId,
          workSessionId: data.workSessionId || '',
          customFields: data.customFields || {},
          employeeId: admin.firestore.FieldValue.delete()
        });
      }
    });
    
    // Migrate userAssignments
    const userAssignmentsRef = db.collection('userAssignments');
    const userAssignmentsSnapshot = await userAssignmentsRef.where('employeeId', '!=', null).get();
    
    console.log(`Found ${userAssignmentsSnapshot.size} user assignments to migrate`);
    
    const userAssignmentsBatch = db.batch();
    userAssignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.employeeId && !data.userId) {
        userAssignmentsBatch.update(doc.ref, {
          userId: data.employeeId,
          employeeId: admin.firestore.FieldValue.delete()
        });
      }
    });
    
    // Commit the batches
    if (completedShiftsSnapshot.size > 0) {
      await completedShiftsBatch.commit();
      console.log('✅ Completed shifts migration successful');
    }
    
    if (userAssignmentsSnapshot.size > 0) {
      await userAssignmentsBatch.commit();
      console.log('✅ User assignments migration successful');
    }
    
    // Validate migration
    const validationResults = await validateMigration();
    console.log('\nValidation Results:', validationResults);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

async function validateMigration() {
  const db = admin.firestore();
  const collections = ['completedShifts', 'userAssignments'];
  const results: Record<string, any> = {};

  for (const collectionName of collections) {
    const legacySnapshot = await db.collection(collectionName)
      .where('employeeId', '!=', null)
      .get();

    const newSnapshot = await db.collection(collectionName)
      .where('userId', '!=', null)
      .get();

    results[collectionName] = {
      legacyFieldCount: legacySnapshot.size,
      newFieldCount: newSnapshot.size,
      migrationComplete: legacySnapshot.size === 0,
      totalDocuments: legacySnapshot.size + newSnapshot.size
    };
  }

  return results;
}

// Run migration
migrateData()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 