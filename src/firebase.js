// src/firebase.js — Firebase initialization
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyABAGSmQdOpEXbsuZcdXGzbc9rDTEGht9A",
  authDomain: "blue-cove-hiriketiya.firebaseapp.com",
  projectId: "blue-cove-hiriketiya",
  storageBucket: "blue-cove-hiriketiya.firebasestorage.app",
  messagingSenderId: "1032799528049",
  appId: "1:1032799528049:web:3e9ae31a2cee2e820ae7d0",
  measurementId: "G-C989KHHGPM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics only in production
try { getAnalytics(app); } catch (_) {}

export default app;
