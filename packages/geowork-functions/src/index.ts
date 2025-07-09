/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {onCall} from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';
// Shared types available for use in functions:
// import type {User, Company, JobSite, TimeEntry, Schedule} from "shared/types";

// 🔥 GeoWork Time Tracker Cloud Functions
// For cost control and performance optimization
setGlobalOptions({ 
  maxInstances: 10,
  region: 'europe-west1' // European region for GDPR compliance
});

// Type helper to demonstrate shared types usage (used in development)
// type SupportedEntity = User | Company | JobSite | TimeEntry | Schedule;

// 🚀 Health check function - verifies Cloud Functions are working
export const healthCheck = onRequest((request, response) => {
  logger.info("Health check called", {structuredData: true});
  
  response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "GeoWork Cloud Functions are running!",
    version: "1.0.0",
    // Example usage of shared types
    supportedEntities: ["User", "Company", "JobSite", "TimeEntry", "Schedule"] as const,
    typeSystemCheck: "All shared types available"
  });
});

// 📋 API Info function - provides API documentation endpoint
export const apiInfo = onRequest((request, response) => {
  logger.info("API info requested", {structuredData: true});
  
  response.json({
    name: "GeoWork Time Tracker API",
    version: "1.0.0",
    description: "Geofence-based employee time tracking system",
    endpoints: {
      "/healthCheck": "Health status check",
      "/apiInfo": "API documentation"
    },
    documentation: "https://github.com/yourcompany/geowork-time-tracker",
    // Demonstration that shared types are available
    dataModels: {
      user: "User interface from shared types",
      company: "Company interface from shared types", 
      jobSite: "JobSite interface from shared types",
      timeEntry: "TimeEntry interface from shared types",
      schedule: "Schedule interface from shared types"
    }
  });
});

// Data Migration Functions
export const migrateCompletedShifts = onCall(async (request) => {
  // Verify admin access
  if (!request.auth) {
    throw new Error('Must be authenticated');
  }

  // For now, we'll add a basic check - in production you'd verify superadmin role
  const userRecord = await admin.auth().getUser(request.auth.uid);
  if (!userRecord.customClaims?.admin) {
    throw new Error('Only admin can run migrations');
  }

  try {
    const db = admin.firestore();
    const completedShiftsRef = db.collection('completedShifts');
    
    // Get documents with legacy employeeId field
    const querySnapshot = await completedShiftsRef.where('employeeId', '!=', null).get();
    
    if (querySnapshot.empty) {
      return { message: 'No documents to migrate', migrated: 0 };
    }

    const batch = db.batch();
    let migratedCount = 0;

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.employeeId && !data.userId) {
        batch.update(doc.ref, {
          userId: data.employeeId,
          workSessionId: data.workSessionId || '',
          customFields: data.customFields || {},
          employeeId: admin.firestore.FieldValue.delete()
        });
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      await batch.commit();
    }

    return { 
      message: `Successfully migrated ${migratedCount} completed shifts`,
      migrated: migratedCount 
    };
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error('Migration failed');
  }
});

export const migrateUserAssignments = onCall(async (request) => {
  // Verify admin access
  if (!request.auth) {
    throw new Error('Must be authenticated');
  }

  const userRecord = await admin.auth().getUser(request.auth.uid);
  if (!userRecord.customClaims?.admin) {
    throw new Error('Only admin can run migrations');
  }

  try {
    const db = admin.firestore();
    const userAssignmentsRef = db.collection('userAssignments');
    
    // Get documents with legacy employeeId field
    const querySnapshot = await userAssignmentsRef.where('employeeId', '!=', null).get();
    
    if (querySnapshot.empty) {
      return { message: 'No documents to migrate', migrated: 0 };
    }

    const batch = db.batch();
    let migratedCount = 0;

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.employeeId && !data.userId) {
        batch.update(doc.ref, {
          userId: data.employeeId,
          employeeId: admin.firestore.FieldValue.delete()
        });
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      await batch.commit();
    }

    return { 
      message: `Successfully migrated ${migratedCount} user assignments`,
      migrated: migratedCount 
    };
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error('Migration failed');
  }
});

export const validateMigration = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('Must be authenticated');
  }

  const userRecord = await admin.auth().getUser(request.auth.uid);
  if (!userRecord.customClaims?.admin) {
    throw new Error('Only admin can validate migrations');
  }

  try {
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
  } catch (error) {
    console.error('Validation error:', error);
    throw new Error('Validation failed');
  }
});

export const rollbackMigration = onCall(async (request) => {
  // Emergency rollback function
  if (!request.auth) {
    throw new Error('Must be authenticated');
  }

  const userRecord = await admin.auth().getUser(request.auth.uid);
  if (!userRecord.customClaims?.admin) {
    throw new Error('Only admin can rollback migrations');
  }

  try {
    const db = admin.firestore();
    const batch = db.batch();
    let rollbackCount = 0;

    // Rollback completedShifts
    const completedShiftsSnapshot = await db.collection('completedShifts')
      .where('userId', '!=', null)
      .get();

    completedShiftsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId && !data.employeeId) {
        batch.update(doc.ref, {
          employeeId: data.userId,
          userId: admin.firestore.FieldValue.delete(),
          workSessionId: admin.firestore.FieldValue.delete(),
          customFields: admin.firestore.FieldValue.delete()
        });
        rollbackCount++;
      }
    });

    // Rollback userAssignments
    const userAssignmentsSnapshot = await db.collection('userAssignments')
      .where('userId', '!=', null)
      .get();

    userAssignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId && !data.employeeId) {
        batch.update(doc.ref, {
          employeeId: data.userId,
          userId: admin.firestore.FieldValue.delete()
        });
        rollbackCount++;
      }
    });

    if (rollbackCount > 0) {
      await batch.commit();
    }

    return { 
      status: 'rollback-complete',
      rolledBack: rollbackCount,
      message: `Successfully rolled back ${rollbackCount} documents`
    };
  } catch (error) {
    console.error('Rollback error:', error);
    throw new Error('Rollback failed');
  }
});

// Geofence breach monitoring trigger
export { monitorGeofenceBreach } from './geofenceAlert';

export { registerAdminToken } from './registerAdminToken';

// Schedule orchestrator system for automatic time tracking
export { 
  scheduleOrchestrator,
  processScheduleStarts,
  processActiveScheduleSessions,
  processScheduleEnds
} from './scheduleOrchestrator';
