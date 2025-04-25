import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
// Initialize Firestore with persistence
// Use initializeFirestore for settings, getFirestore for basic instance
let db;
if (typeof window !== 'undefined') {
    // Enable persistence only on the client-side
    db = initializeFirestore(app, {
        localCache: { kind: 'persistent' } // Modern way to enable persistence
    });
    // Optional: enableIndexedDbPersistence is still valid but initializeFirestore is preferred
    // try {
    //     enableIndexedDbPersistence(getFirestore(app))
    //         .catch((err) => {
    //             if (err.code == 'failed-precondition') {
    //                 // Multiple tabs open, persistence can only be enabled
    //                 // in one tab at a time.
    //                 console.warn('Firestore persistence failed: Multiple tabs open.');
    //             } else if (err.code == 'unimplemented') {
    //                 // The current browser does not support all of the
    //                 // features required to enable persistence
    //                 console.warn('Firestore persistence failed: Browser does not support persistence.');
    //             }
    //         });
    // } catch (error) {
    //      console.error("Error enabling Firestore persistence:", error);
    // }
} else {
    // For server-side rendering or environments without window
    db = getFirestore(app);
}


const storage = getStorage(app);

export { app, auth, db, storage };
