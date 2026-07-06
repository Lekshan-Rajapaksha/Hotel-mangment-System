// src/services/deleteRequestService.js — Firestore operations for delete requests
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const COLLECTION = 'deleteRequests';

/**
 * Submit a delete request for a future booking.
 * Called by receptionist; awaits admin approval.
 */
export async function submitDeleteRequest(booking, reason = '') {
  const user = auth.currentUser;
  return addDoc(collection(db, COLLECTION), {
    bookingId: booking.id,
    bookingSnapshot: {
      guestName: booking.guestName,
      phone: booking.phone,
      roomNumber: booking.roomNumber,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      fullPrice: booking.fullPrice,
      source: booking.source || 'Direct',
    },
    reason,
    requestedBy: user?.email || user?.uid || 'unknown',
    requestedAt: serverTimestamp(),
    status: 'pending', // 'pending' | 'approved' | 'rejected'
  });
}

/** Real-time listener for ALL delete requests (admin use) */
export function subscribeDeleteRequests(callback, onError) {
  // Simple query with no compound index required
  const q = query(collection(db, COLLECTION));
  return onSnapshot(
    q,
    (snap) => {
      const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort: pending first, then by requestedAt desc
      requests.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        const aTs = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt || 0);
        const bTs = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt || 0);
        return bTs - aTs;
      });
      callback(requests);
    },
    (err) => {
      console.error('[subscribeDeleteRequests] Firestore error:', err);
      if (onError) onError(err);
    }
  );
}

/** Count of pending delete requests (for badge) */
export function subscribePendingCount(callback) {
  const q = query(collection(db, COLLECTION), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => callback(snap.size), () => callback(0));
}

/** Admin approves → mark resolved (actual booking delete done separately) */
export async function approveDeleteRequest(requestId) {
  return updateDoc(doc(db, COLLECTION, requestId), {
    status: 'approved',
    resolvedAt: serverTimestamp(),
  });
}

/** Admin rejects → mark rejected */
export async function rejectDeleteRequest(requestId) {
  return updateDoc(doc(db, COLLECTION, requestId), {
    status: 'rejected',
    resolvedAt: serverTimestamp(),
  });
}

/** Remove a resolved request from the list */
export async function dismissDeleteRequest(requestId) {
  return deleteDoc(doc(db, COLLECTION, requestId));
}
