import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const registerAdminToken = onRequest(async (req, res) => {
  // CORS preflight support
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { token, companyId } = req.body as { token?: string; companyId?: string };
  if (!token || !companyId) {
    res.status(400).send('Missing token or companyId');
    return;
  }

  const topic = `company_${companyId}_admins`;

  try {
    // In emulator environment we don't have valid FCM credentials – skip real call
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      logger.info('Emulator detected – skipping subscribeToTopic and returning success');
      res.status(200).send('subscribed (emulated)');
      return;
    }

    await admin.messaging().subscribeToTopic(token, topic);
    logger.info(`Subscribed token to ${topic}`);

    // Store the token for housekeeping (optional)
    await admin.firestore().collection('deviceTokens').doc(token).set({
      companyId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send('subscribed');
  } catch (err) {
    logger.error('Subscription error', err);
    res.status(500).send('subscription error');
  }
}); 