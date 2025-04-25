
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Ensure environment variables are defined
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// Check if running on the client side before logging potentially missing variables
// This prevents server-side logs during build/SSR if env vars are only meant for client
if (typeof window !== 'undefined' && missingEnvVars.length > 0) {
  console.warn(
    `Missing Firebase environment variables: ${missingEnvVars.join(', ')}. ` +
    `Please ensure they are set in your .env.local file and prefixed with NEXT_PUBLIC_. ` +
    `Check the example in .env.local.`
  );
  // It's generally better to warn than throw an error here,
  // allowing the app to load and potentially show a more user-friendly message.
}


const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase
// IMPORTANT: Ensure your .env.local file has the correct Firebase config values.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);

// Initialize Firestore with persistence
let db: Firestore;
if (typeof window !== 'undefined') {
    // Enable persistence only on the client-side
    try {
        // Prefer initializeFirestore for enabling persistence
        // Note: Persistence might require Firestore to be enabled in your Firebase project.
        db = initializeFirestore(app, {
            localCache: { kind: 'persistent' }
        });
        console.log("Firestore persistence initialized.");

        // You can also use enableIndexedDbPersistence directly if preferred or if initializeFirestore causes issues.
        // enableIndexedDbPersistence(getFirestore(app))
        //   .then(() => console.log("Firestore persistence enabled."))
        //   .catch((err) => {
        //       if (err.code == 'failed-precondition') {
        //         console.warn("Firestore persistence failed: Multiple tabs open? Only one tab can have persistence enabled.");
        //       } else if (err.code == 'unimplemented') {
        //         console.warn("Firestore persistence failed: Browser does not support IndexedDB.");
        //       } else {
        //         console.warn("Firestore persistence enabling failed:", err.code, err.message);
        //       }
        //   });

    } catch (error: any) {
        console.error("Error initializing Firestore with persistence:", error.message);
        // Fallback to default Firestore instance if persistence fails
        db = getFirestore(app);
    }
} else {
    // For server-side rendering or environments without window
    db = getFirestore(app);
}


const storage = getStorage(app);

export { app, auth, db, storage };
