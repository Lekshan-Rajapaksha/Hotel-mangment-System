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
  // No orderBy to avoid requiring a composite index — sort client-side
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort by createdAt descending on the client
  return bookings.sort((a, b) => {
    const aTs = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const bTs = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return bTs - aTs;
  });
}

/** Real-time listener for all active bookings */
export function subscribeBookings(callback, onError) {
  // No orderBy — avoids requiring a Firestore composite index; sort client-side
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active')
  );
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by createdAt descending on the client
      bookings.sort((a, b) => {
        const aTs = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const bTs = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return bTs - aTs;
      });
      callback(bookings);
    },
    (err) => {
      console.error('[subscribeBookings] Firestore error:', err);
      if (onError) onError(err);
    }
  );
}

/** Get all bookings (including cancelled) for admin */
export function subscribeAllBookings(callback, onError) {
  // No orderBy — avoids requiring a Firestore index; sort client-side
  const q = query(collection(db, COLLECTION));
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by createdAt descending on the client
      bookings.sort((a, b) => {
        const aTs = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const bTs = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return bTs - aTs;
      });
      callback(bookings);
    },
    (err) => {
      console.error('[subscribeAllBookings] Firestore error:', err);
      if (onError) onError(err);
    }
  );
}

// TEMPORARY MIGRATION SCRIPT
setTimeout(async () => {
  try {
    const q = query(collection(db, COLLECTION));
    const snap = await getDocs(q);
    let migratedCount = 0;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      let rNum = data.roomNumber;
      if (typeof rNum === 'string') rNum = parseInt(rNum, 10);
      if (rNum >= 1 && rNum <= 7) {
        updateDoc(doc(db, COLLECTION, docSnap.id), {
          roomNumber: rNum + 99
        });
        migratedCount++;
      }
    });
    if (migratedCount > 0) {
      alert(`Successfully migrated ${migratedCount} bookings to new room numbers. Please refresh the page.`);
    }
  } catch (err) {
    console.error("Migration failed:", err);
    alert("Migration failed: " + err.message);
  }
}, 3000);
