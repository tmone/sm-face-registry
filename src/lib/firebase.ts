

import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, Firestore } from "firebase/firestore"; // Removed enableIndexedDbPersistence import
import { getStorage } from "firebase/storage";

// Define required Firebase environment variable keys
const firebaseEnvVarKeys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const; // Use "as const" for stricter typing

type FirebaseEnvVarKey = typeof firebaseEnvVarKeys[number];

// Construct the firebaseConfig object ensuring type safety
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional, can be undefined
};

// --- Environment Variable Validation ---
// Check for missing variables only on the client-side after initial load
if (typeof window !== 'undefined') {
  // Use setTimeout to delay the check slightly, allowing hydration to complete
  setTimeout(() => {
    const missingEnvVars = firebaseEnvVarKeys.filter(key => !firebaseConfig[key as keyof FirebaseOptions]);

    if (missingEnvVars.length > 0) {
      console.warn(
        `⚠️ Missing Firebase environment variables: ${missingEnvVars.join(', ')}. ` +
        `Please ensure they are set in your .env.local file and prefixed with NEXT_PUBLIC_. ` +
        `Check the Firebase project settings and the example in .env.local.`
      );
      // You might want to display a user-friendly message in the UI as well
      // For example, using a state variable and displaying an Alert component.
    }

    // Specifically check API key validity as it's a common error
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY' || firebaseConfig.apiKey.length < 10) { // Added length check
        console.error(
            "🚨 Firebase API Key is missing, invalid, or using the placeholder value. " +
            "Please provide a valid API key in your .env.local file for Firebase Authentication to work."
        );
        // Consider throwing an error or showing a blocking UI message here
        // if the API key is absolutely essential for the app's core functionality.
    }
  }, 100); // Delay check slightly
}


// --- Initialize Firebase ---
// IMPORTANT: Ensure your .env or .env.local file has the correct Firebase config values.
// Use getApps() to check if Firebase is already initialized.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);

// --- Initialize Firestore with Persistence ---
let db: Firestore;
// Only attempt to enable persistence on the client-side.
if (typeof window !== 'undefined') {
    try {
        // Use initializeFirestore to enable persistence settings reliably.
        // This function should only be called once.
        db = initializeFirestore(app, {
            localCache: { kind: 'persistent' } // Recommended persistence setting
        });
        console.log("Firestore persistence initialized via initializeFirestore.");

    } catch (error: any) {
        // Handle cases where initializeFirestore might fail (e.g., called again)
        if (error.message.includes("Firestore has already been started")) {
            console.warn("Firestore already initialized. Using existing instance.");
            db = getFirestore(app); // Get the existing instance
        } else {
            console.error("Error initializing Firestore with persistence:", error.message);
            // Fallback to default Firestore instance if persistence initialization fails unexpectedly
            db = getFirestore(app);
        }
    }
} else {
    // For server-side rendering or environments without window object (e.g., build process)
    // Initialize without persistence settings here
    db = getFirestore(app);
}


// REMOVED: Redundant call to enableIndexedDbPersistence
// enableIndexedDbPersistence(db)
//       .catch((err) => {
//         if (err.code == 'failed-precondition') {
//           // Multiple tabs open, persistence can only be enabled
//           // in one tab at a a time.
//           console.warn("Firestore persistence failed-precondition", err);
//         } else if (err.code == 'unimplemented') {
//           // The current browser does not support all of the
//           // features required to enable persistence
//           console.warn("Firestore persistence unimplemented", err);
//         }
//       });

const storage = getStorage(app);

export { app, auth, db, storage };

