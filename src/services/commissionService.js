// src/services/commissionService.js — Firestore operations for commissions
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, onSnapshot, query, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const COLLECTION = 'commissions';

/**
 * Add a new commission record (supports single or multiple bookings)
 * @param {Object} data - { bookingNumber, bookingNumbers, amount, date, details, status, bookingId, bookingIds, guestName, guestNames, roomNumber }
 */
export async function addCommission(data) {
  const user = auth.currentUser;
  const isPaid = data.status === 'paid';

  // Normalize booking numbers (array and comma-separated string)
  let bookingNumbers = [];
  if (Array.isArray(data.bookingNumbers) && data.bookingNumbers.length > 0) {
    bookingNumbers = data.bookingNumbers.map(n => String(n).trim().replace(/^#/, '')).filter(Boolean);
  } else if (data.bookingNumber) {
    bookingNumbers = String(data.bookingNumber).split(',').map(n => n.trim().replace(/^#/, '')).filter(Boolean);
  }

  const bookingNumberStr = bookingNumbers.join(', ') || String(data.bookingNumber || '').trim();

  // Normalize guest names
  let guestNames = [];
  if (Array.isArray(data.guestNames) && data.guestNames.length > 0) {
    guestNames = data.guestNames.map(g => String(g).trim()).filter(Boolean);
  } else if (data.guestName) {
    guestNames = [String(data.guestName).trim()];
  }

  // Normalize booking IDs
  let bookingIds = [];
  if (Array.isArray(data.bookingIds) && data.bookingIds.length > 0) {
    bookingIds = data.bookingIds.filter(Boolean);
  } else if (data.bookingId) {
    bookingIds = [data.bookingId];
  }

  const payload = {
    bookingNumber: bookingNumberStr,
    bookingNumbers,
    bookingId: bookingIds[0] || '',
    bookingIds,
    guestName: guestNames.join(', '),
    guestNames,
    roomNumber: data.roomNumber || '',
    amount: Number(data.amount || 0),
    date: data.date || new Date().toISOString().split('T')[0],
    details: (data.details || '').trim(),
    status: isPaid ? 'paid' : 'unpaid',
    createdAt: serverTimestamp(),
    createdBy: user?.uid || 'unknown',
    paidAt: isPaid ? serverTimestamp() : null,
    paidBy: isPaid ? (user?.email?.split('@')[0] || user?.uid || 'Staff') : null
  };

  return addDoc(collection(db, COLLECTION), payload);
}

/**
 * Mark a commission as paid or unpaid
 * When marked paid, records paidAt timestamp and current user
 */
export async function markCommissionPaid(id, isPaid = true) {
  const user = auth.currentUser;
  const payload = {
    status: isPaid ? 'paid' : 'unpaid',
    updatedAt: serverTimestamp()
  };

  if (isPaid) {
    payload.paidAt = serverTimestamp();
    payload.paidBy = user?.email?.split('@')[0] || user?.uid || 'Staff';
  } else {
    payload.paidAt = null;
    payload.paidBy = null;
  }

  return updateDoc(doc(db, COLLECTION, id), payload);
}

/** Update commission details */
export async function updateCommission(id, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (data.amount !== undefined) payload.amount = Number(data.amount || 0);
  return updateDoc(doc(db, COLLECTION, id), payload);
}

/** Delete a commission */
export async function deleteCommission(id) {
  return deleteDoc(doc(db, COLLECTION, id));
}

/** Get all commissions once */
export async function getCommissions() {
  const snap = await getDocs(collection(db, COLLECTION));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return sortCommissions(list);
}

/**
 * Subscribe to all commissions in real-time
 * Unpaid commissions are sorted first, Paid commissions go to the bottom ("go down")
 */
export function subscribeCommissions(callback, onError) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = sortCommissions(list);
      callback(sorted);
    },
    (err) => {
      console.error('[subscribeCommissions] Firestore error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Sorting logic:
 * 1. Non-Paid ('unpaid') commissions appear first at the top.
 * 2. Paid ('paid') commissions appear at the bottom ("go down").
 * 3. Within each group, sort by date / createdAt descending (most recent first).
 */
export function sortCommissions(list) {
  return [...list].sort((a, b) => {
    const aPaid = a.status === 'paid' ? 1 : 0;
    const bPaid = b.status === 'paid' ? 1 : 0;

    if (aPaid !== bPaid) {
      return aPaid - bPaid; // 0 (unpaid) comes before 1 (paid)
    }

    // Within same status, sort by date/createdAt descending
    const aDate = a.date ? new Date(a.date).getTime() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
    const bDate = b.date ? new Date(b.date).getTime() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
    return bDate - aDate;
  });
}
