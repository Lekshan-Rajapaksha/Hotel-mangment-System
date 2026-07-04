// src/services/bookingService.js — Firestore operations for bookings
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, onSnapshot, query, where, orderBy,
  Timestamp, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const COLLECTION = 'bookings';

/** Create a new booking */
export async function createBooking(data) {
  const user = auth.currentUser;
  const payload = {
    ...data,
    checkIn: Timestamp.fromDate(new Date(data.checkIn)),
    checkOut: Timestamp.fromDate(new Date(data.checkOut)),
    createdAt: serverTimestamp(),
    createdBy: user?.uid || 'unknown',
    status: 'active'
  };
  return addDoc(collection(db, COLLECTION), payload);
}

/** Update an existing booking */
export async function updateBooking(id, data) {
  const payload = { ...data };
  if (data.checkIn) payload.checkIn = Timestamp.fromDate(new Date(data.checkIn));
  if (data.checkOut) payload.checkOut = Timestamp.fromDate(new Date(data.checkOut));
  payload.updatedAt = serverTimestamp();
  return updateDoc(doc(db, COLLECTION, id), payload);
}

/** Soft-delete: mark as cancelled */
export async function cancelBooking(id) {
  return updateDoc(doc(db, COLLECTION, id), {
    status: 'cancelled',
    cancelledAt: serverTimestamp()
  });
}

/** Hard delete */
export async function deleteBooking(id) {
  return deleteDoc(doc(db, COLLECTION, id));
}

/** Get all active bookings once */
export async function getBookings() {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active'),
    orderBy('checkIn', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Real-time listener for all active bookings */
export function subscribeBookings(callback) {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active'),
    orderBy('checkIn', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(bookings);
  });
}

/** Get all bookings (including cancelled) for admin */
export function subscribeAllBookings(callback) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(bookings);
  });
}
