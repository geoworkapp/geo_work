// Firebase configuration for GeoWork Admin Dashboard
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { 
  getFirestore,
  connectFirestoreEmulator,
  terminate,
  clearIndexedDbPersistence
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import type { FirebaseApp } from 'firebase/app';

// 🔥 FIREBASE CONFIG - Using environment variables for security
// Create a .env.local file based on .env.example and fill in your values
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate configuration
const requiredEnvVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID'];
const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  console.warn('⚠️ Missing Firebase environment variables:', missingVars);
  console.warn('📝 Using fallback configuration for development');
  console.warn('🔧 Add your Firebase config to .env file for full functionality');
}

// Prevent multiple Firebase app initialization
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase services with singleton pattern
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_REGION || 'us-central1');

// Development mode emulator connections (only in development)
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    // Connect to emulators with proper error handling
    try {
      connectAuthEmulator(auth, 'http://localhost:9099');
    } catch (error) {
      // Emulator already connected or not available
      console.log('Auth emulator connection skipped');
    }
    
    // Firestore emulator connection
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (error) {
      // Emulator already connected
      console.log('Firestore emulator already connected');
    }
    
    // Functions emulator connection
    try {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    } catch (error) {
      // Emulator already connected
      console.log('Functions emulator already connected');
    }
    
    console.log('🔧 Connected to Firebase emulators');
  } catch (error) {
    console.warn('⚠️ Failed to connect to emulators:', error);
  }
}

// Enhanced error handling for development
if (import.meta.env.DEV) {
  // Handle hot module replacement cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(async () => {
      try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
      } catch (error) {
        console.log('Firebase cleanup completed');
      }
    });
  }
  
  // Handle page unload cleanup
  window.addEventListener('beforeunload', async () => {
    try {
      await terminate(db);
    } catch (error) {
      // Ignore errors during cleanup
    }
  });
}

console.log('✅ Firebase initialized successfully');

export { app };
export default app; 