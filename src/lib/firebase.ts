
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

if (missingEnvVars.length > 0 && typeof window !== 'undefined') {
  // Only throw error on client-side where these are expected
  console.error(
    `Missing Firebase environment variables: ${missingEnvVars.join(', ')}. ` +
    `Please ensure they are set in your .env.local file and prefixed with NEXT_PUBLIC_.`
  );
  // Optionally, throw an error to halt execution if Firebase is critical
  // throw new Error(`Missing Firebase environment variables: ${missingEnvVars.join(', ')}`);
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
// IMPORTANT: Check your `.env.local` file and ensure all NEXT_PUBLIC_FIREBASE_ variables are correctly set.
// Also, verify your Firestore Security Rules in the Firebase console to allow authenticated reads/writes.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);

// Initialize Firestore with persistence
let db: Firestore;
if (typeof window !== 'undefined') {
    // Enable persistence only on the client-side
    try {
        // Prefer initializeFirestore for enabling persistence
        db = initializeFirestore(app, {
            localCache: { kind: 'persistent' }
        });
        console.log("Firestore persistence initialized.");

        // Keep enableIndexedDbPersistence as a fallback or for specific scenarios if needed,
        // but initializeFirestore should handle it. Check console logs for success/errors.
        // enableIndexedDbPersistence(getFirestore(app)) // Already initialized with persistence above
        //   .then(() => console.log("Firestore persistence enabled."))
        //   .catch((err) => {
        //     console.warn("Firestore persistence enabling failed:", err.code, err.message);
        //   });

    } catch (error) {
        console.error("Error initializing Firestore with persistence:", error);
        // Fallback to default Firestore instance if persistence fails
        db = getFirestore(app);
    }
} else {
    // For server-side rendering or environments without window
    db = getFirestore(app);
}


const storage = getStorage(app);

export { app, auth, db, storage };
