import { getMessaging, isSupported, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { app } from './config';

let messaging: Messaging | null = null;

// Initialise Firebase Messaging only if browser supports it
export async function initMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (!(await isSupported())) {
    console.warn('FCM not supported in this browser');
    return null;
  }
  messaging = getMessaging(app);
  return messaging;
}

interface RegisterOptions {
  companyId: string;
}

// Request permission, fetch token, send to backend to subscribe to topic
export async function enablePushNotifications(opts: RegisterOptions) {
  const msg = await initMessaging();
  if (!msg) return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return;
  }

  try {
    const token = await getToken(msg, {
      vapidKey: import.meta.env.VITE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    if (!token) {
      console.warn('FCM token retrieval failed');
      return;
    }

    // Determine backend endpoint (emulator vs production)
    const host = import.meta.env.VITE_FUNCTIONS_HOST ?? '';
    const endpoint = host
      ? `${host}/geowork-time-tracker/europe-west1/registerAdminToken`
      : 'https://europe-west1-geowork-time-tracker.cloudfunctions.net/registerAdminToken';

    // Send token to backend for topic subscription
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, companyId: opts.companyId }),
    });

    // Foreground message listener; you can replace this with a global event or toast
    onMessage(msg, (payload) => {
      console.log('🔔 Foreground push', payload);
      // Dispatch a browser event so any component can listen
      window.dispatchEvent(new CustomEvent('fcm-message', { detail: payload }));
    });
  } catch (err) {
    console.error('Enable push failed', err);
  }
} 