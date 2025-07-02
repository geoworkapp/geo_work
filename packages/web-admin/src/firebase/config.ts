// Firebase configuration for GeoWork Admin Dashboard
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// 🔥 FIREBASE CONFIG - Using environment variables for security
// Create a .env.local file based on .env.example and fill in your values
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIza...", // 🔑 Add to .env.local
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "geowork-time-tracker.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "geowork-time-tracker",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "geowork-time-tracker.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "681589331619",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:681589331619:web:...", // 🔑 Add to .env.local
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Optional: Google Analytics
};

// Validate configuration
const requiredEnvVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID'];
const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  console.warn('⚠️ Missing Firebase environment variables:', missingVars);
  console.warn('📝 Using fallback configuration for development');
  console.warn('🔧 Add your Firebase config to .env file for full functionality');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Functions
export const functions = getFunctions(app);

// 🛠️ Connect to emulators in development (for testing without hitting production)
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('🔧 Connected to Firebase emulators');
  } catch (error) {
    console.log('📡 Firebase emulators not available or already connected');
  }
}

export default app; 