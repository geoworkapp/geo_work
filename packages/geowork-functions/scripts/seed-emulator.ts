import * as admin from 'firebase-admin';

/**
 * Seed script for the Firebase emulator.
 *
 * - Populates companies, users, jobSites, schedules collections
 * - Can be run multiple times (idempotent)
 *
 * Usage (from repo root):
 *   npm --prefix packages/geowork-functions run build && node packages/geowork-functions/scripts/seed-emulator.js
 *
 * Make sure the Firestore emulator is running on localhost:8080 before executing.
 */

// Ensure we are pointing to the emulator
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-project';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}

const db = admin.firestore();

async function seed() {
  const companyId = 'demoCompany';
  const employeeId = 'demoEmployee';
  const jobSiteId = 'demoSite';
  const scheduleId = 'demoSchedule';

  // 1. Company
  await db.collection('companies').doc(companyId).set({
    name: 'Demo Company',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    autoClockSettings: {
      enabled: true,
      clockInBuffer: 10,
      clockOutBuffer: 10,
      geofenceExitGracePeriod: 5,
      requiresConfirmation: false,
    },
  }, { merge: true });

  // 2. Job Site
  await db.collection('jobSites').doc(jobSiteId).set({
    companyId,
    siteName: 'Main Warehouse',
    location: { latitude: 40.7128, longitude: -74.0060 },
    radius: 100, // meters
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // 3. User (employee)
  await db.collection('users').doc(employeeId).set({
    companyId,
    firstName: 'John',
    lastName: 'Doe',
    role: 'employee',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // 4. Schedule
  const start = new Date();
  start.setMinutes(start.getMinutes() + 2); // starts in 2 minutes
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000); // 8-hour shift

  await db.collection('schedules').doc(scheduleId).set({
    companyId,
    employeeId,
    jobSiteId,
    startTime: start,
    endTime: end,
    status: 'scheduled',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('✅ Seed data written to Firestore emulator');
}

seed().then(() => process.exit()).catch(err => {
  console.error(err);
  process.exit(1);
}); 