/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker for GeoWork Admin Dashboard
// Docs: https://firebase.google.com/docs/cloud-messaging/js/receive

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// IMPORTANT: Replace placeholders with your actual Firebase project config.
// These values can also be injected at deploy time if you prefer.
const firebaseConfig = {
  apiKey: 'AIzaSyBDMboKlZHplKNv5fxpkAVeXQS6Es4u5Q4',
  authDomain: 'geowork-time-tracker.firebaseapp.com',
  projectId: 'geowork-time-tracker',
  storageBucket: 'geowork-time-tracker.firebasestorage.app',
  messagingSenderId: '681589331619',
  appId: '1:681589331619:web:22ff63704c062ee3c35116',
};

firebase.initializeApp(firebaseConfig);

// Retrieve messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(({ notification, data }) => {
  // Fallback notification if the page is not in focus
  if (notification) {
    self.registration.showNotification(notification.title, {
      body: notification.body,
      data, // useful to open appropriate route when clicked
      icon: '/vite.svg',
      badge: '/vite.svg',
    });
  }
});

// Click handler to focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    }),
  );
}); 