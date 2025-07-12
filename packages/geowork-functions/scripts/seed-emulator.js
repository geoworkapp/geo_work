// Plain-JS seed script for the Firestore emulator
// Usage: node packages/geowork-functions/scripts/seed-emulator.js

const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-project';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}

const db = admin.firestore();

(async () => {
  const companyId = 'demoCompany';
  const employeeId = 'demoEmployee';
  const jobSiteId = 'demoSite';
  const scheduleId = 'demoSchedule';

  await db.doc(`companies/${companyId}`).set({
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

  await db.doc(`jobSites/${jobSiteId}`).set({
    companyId,
    siteName: 'Main Warehouse',
    location: { latitude: 40.7128, longitude: -74.0060 },
    radius: 100,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.doc(`users/${employeeId}`).set({
    companyId,
    firstName: 'John',
    lastName: 'Doe',
    role: 'employee',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const start = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000); // +8h

  await db.doc(`schedules/${scheduleId}`).set({
    companyId,
    employeeId,
    jobSiteId,
    startTime: start,
    endTime: end,
    status: 'scheduled',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('✅ Seed data written');
  process.exit();
})().catch(err => {
  console.error(err);
  process.exit(1);
}); 