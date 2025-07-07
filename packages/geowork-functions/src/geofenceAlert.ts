import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";

// Ensure Admin SDK is initialized exactly once
if (!admin.apps.length) {
  admin.initializeApp();
}

// Firestore collection names (centralised for potential reuse)
const TIME_ENTRIES_COLLECTION = 'timeEntries';
const GEOFENCE_ALERTS_COLLECTION = 'geofenceAlerts';

// Schema (TypeScript interface) for alert documents
export interface GeofenceAlert {
  employeeId: string;
  companyId: string;
  jobSiteId: string;
  distance: number; // metres beyond geofence centre
  firstDetected: FirebaseFirestore.Timestamp;
  lastSeen: FirebaseFirestore.Timestamp;
  active: boolean;
  resolvedAt?: FirebaseFirestore.Timestamp;
}

// Throttling window – suppress duplicate pushes within X minutes
const PUSH_THROTTLE_MINUTES = 10;

// Triggered when a new time entry is created
export const monitorGeofenceBreach = onDocumentCreated(`${TIME_ENTRIES_COLLECTION}/{entryId}`, async (event) => {
  const snap = event.data;
  if (!snap) {
    logger.warn('monitorGeofenceBreach: No snapshot');
    return;
  }
  const data = snap.data() as any;
  if (!data) return;

  const {
    employeeId = data.userId,
    companyId,
    jobSiteId = data.siteId,
    metadata = {},
    status,
  } = data;

  const outsideGeofence: boolean = metadata.outsideGeofence === true;
  const distance: number = data.distanceFromJobSite ?? 0;

  const db = admin.firestore();
  const alertsRef = db.collection(GEOFENCE_ALERTS_COLLECTION);

  // Query existing active alert for this employee (one active at a time is enough)
  const existingAlertSnap = await alertsRef
    .where('employeeId', '==', employeeId)
    .where('active', '==', true)
    .limit(1)
    .get();

  const now = admin.firestore.Timestamp.now();

  // Helper to send FCM push to company admin topic
  const sendPush = async (title: string, body: string) => {
    try {
      await admin.messaging().send({
        topic: `company_${companyId}_admins`,
        notification: { title, body },
        data: {
          type: 'GEOFENCE_ALERT',
          employeeId,
          jobSiteId,
        },
      });
      logger.info(`Sent push to company_${companyId}_admins`);
    } catch (err) {
      logger.error('FCM send error', err);
    }
  };

  // CASE 1: Employee is outside geofence during an active shift (not clockedOut)
  if (outsideGeofence && status !== 'clockedOut') {
    if (existingAlertSnap.empty) {
      // Create new alert document
      const alertDoc: GeofenceAlert = {
        employeeId,
        companyId,
        jobSiteId,
        distance,
        firstDetected: now,
        lastSeen: now,
        active: true,
      };
      await alertsRef.add(alertDoc);
      logger.info(`Created new geofence alert for employee ${employeeId}`);

      await sendPush('Employee outside geofence', `Employee ${employeeId} is ${Math.round(distance)}m outside job site ${jobSiteId}`);
    } else {
      // Alert already active – update lastSeen, maybe send periodic reminder
      const doc = existingAlertSnap.docs[0];
      const lastPushAt: FirebaseFirestore.Timestamp | undefined = doc.get('lastPushAt');
      await doc.ref.update({ lastSeen: now, distance });

      if (!lastPushAt || now.toMillis() - lastPushAt.toMillis() > PUSH_THROTTLE_MINUTES * 60 * 1000) {
        await doc.ref.update({ lastPushAt: now });
        await sendPush('Employee still outside geofence', `Employee ${employeeId} remains ${Math.round(distance)}m outside job site ${jobSiteId}`);
      }
    }
    return;
  }

  // CASE 2: Employee back inside geofence or shift ended – resolve any active alert
  if (!existingAlertSnap.empty) {
    const doc = existingAlertSnap.docs[0];
    await doc.ref.update({ active: false, resolvedAt: now });
    logger.info(`Resolved geofence alert for employee ${employeeId}`);

    await sendPush('Geofence alert resolved', `Employee ${employeeId} is back inside the job site or has clocked out.`);
  }
}); 