// src/services/userService.js — User role management in Firestore
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

/** Get user role from Firestore (returns 'receptionist' | 'admin' | null) */
export async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return snap.data().role;
  return null;
}

/** Create or update user profile */
export async function setUserProfile(uid, data) {
  return setDoc(doc(db, 'users', uid), data, { merge: true });
}
