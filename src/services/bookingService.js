// src/services/bookingService.js — Firestore operations for bookings
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, onSnapshot, query, where, orderBy,
  Timestamp, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const COLLECTION = 'bookings';

/** Format a numeric booking number to 2-digit padded string (01, 02, ... 10, ...) */
export function formatBookingNumber(num) {
  const n = parseInt(num, 10);
  if (isNaN(n) || n <= 0) return '01';
  return String(n).padStart(2, '0');
}

/** Get the next sequential booking number starting from 01 */
export async function getNextBookingNumber() {
  try {
    const q = query(collection(db, COLLECTION));
    const snap = await getDocs(q);
    let maxNo = 0;
    snap.forEach(d => {
      const bData = d.data();
      if (bData.bookingNumber !== undefined && bData.bookingNumber !== null) {
        const val = parseInt(bData.bookingNumber, 10);
        if (!isNaN(val) && val > maxNo) {
          maxNo = val;
        }
      }
    });
    return formatBookingNumber(maxNo + 1);
  } catch (err) {
    console.error('Failed to get next booking number:', err);
    return '01';
  }
}

/** Create a new booking with automatic sequential bookingNumber starting from 01 */
export async function createBooking(data) {
  const user = auth.currentUser;
  
  let bookingNo = data.bookingNumber;
  if (!bookingNo) {
    bookingNo = await getNextBookingNumber();
  } else {
    bookingNo = formatBookingNumber(bookingNo);
  }

  const payload = {
    ...data,
    bookingNumber: bookingNo,
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
  if (data.bookingNumber !== undefined) {
    payload.bookingNumber = formatBookingNumber(data.bookingNumber);
  }
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
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return bookings.sort((a, b) => {
    const aTs = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const bTs = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return bTs - aTs;
  });
}

/** Real-time listener for all active bookings */
export function subscribeBookings(callback, onError) {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active')
  );
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  const q = query(collection(db, COLLECTION));
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

/**
 * Auto-assign sequential booking numbers (starting from 01)
 * to existing bookings in the database that don't have one yet.
 */
export async function ensureBookingNumbers() {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION)));
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Check if any booking is missing bookingNumber
    const missing = allDocs.filter(d => !d.bookingNumber);
    if (missing.length === 0) return;

    // Find highest existing bookingNumber
    let maxNo = 0;
    allDocs.forEach(d => {
      if (d.bookingNumber) {
        const n = parseInt(d.bookingNumber, 10);
        if (!isNaN(n) && n > maxNo) maxNo = n;
      }
    });

    // Sort missing chronologically by createdAt (or checkIn)
    missing.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.checkIn?.toDate ? a.checkIn.toDate().getTime() : 0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.checkIn?.toDate ? b.checkIn.toDate().getTime() : 0);
      return aTime - bTime;
    });

    // Assign sequential numbers
    for (const item of missing) {
      maxNo += 1;
      const numStr = formatBookingNumber(maxNo);
      await updateDoc(doc(db, COLLECTION, item.id), {
        bookingNumber: numStr
      });
    }
  } catch (err) {
    console.warn('Booking number auto-assign check error:', err);
  }
}

// Run auto-assignment in background on startup
setTimeout(() => {
  ensureBookingNumbers();
}, 2000);
