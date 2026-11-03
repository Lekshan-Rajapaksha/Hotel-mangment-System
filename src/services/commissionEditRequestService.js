// src/services/commissionEditRequestService.js — Firestore operations for commission edit requests
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, where, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { updateCommission } from './commissionService.js';

const COLLECTION = 'commissionEditRequests';

/**
 * Submit an edit request for a commission.
 * Called by receptionist/staff; awaits admin approval.
 * Also flags the commission document with pending edit details.
 */
export async function submitCommissionEditRequest(commission, newValues, reason = '') {
  const user = auth.currentUser;
  const requestedBy = user?.email || user?.uid || 'Staff';

  const oldData = {
    bookingNumber: commission.bookingNumber || '',
    bookingNumbers: commission.bookingNumbers || [],
    amount: Number(commission.amount || 0),
    date: commission.date || '',
    details: commission.details || '',
    guestName: commission.guestName || '',
    roomNumber: commission.roomNumber || ''
  };

  const newData = {
    bookingNumber: newValues.bookingNumber || oldData.bookingNumber,
    bookingNumbers: newValues.bookingNumbers || oldData.bookingNumbers,
    amount: Number(newValues.amount !== undefined ? newValues.amount : oldData.amount),
    date: newValues.date || oldData.date,
    details: (newValues.details !== undefined ? newValues.details : oldData.details).trim(),
    guestName: newValues.guestName !== undefined ? newValues.guestName : oldData.guestName,
    roomNumber: newValues.roomNumber !== undefined ? newValues.roomNumber : oldData.roomNumber
  };

  // 1. Create document in commissionEditRequests
  const docRef = await addDoc(collection(db, COLLECTION), {
    commissionId: commission.id,
    oldData,
    newData,
    reason: (reason || '').trim(),
    requestedBy,
    requestedAt: serverTimestamp(),
    status: 'pending' // 'pending' | 'approved' | 'rejected'
  });

  // 2. Mark commission document as having a pending edit
  await updateCommission(commission.id, {
    hasPendingEdit: true,
    pendingEditId: docRef.id,
    pendingEditData: newData,
    pendingEditRequestedBy: requestedBy,
    pendingEditRequestedAt: serverTimestamp(),
    pendingEditReason: (reason || '').trim()
  });

  return docRef;
}

/** Real-time listener for ALL commission edit requests (admin notifications page) */
export function subscribeCommissionEditRequests(callback, onError) {
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
      console.error('[subscribeCommissionEditRequests] Firestore error:', err);
      if (onError) onError(err);
    }
  );
}

/** Count of pending commission edit requests (for admin badge) */
export function subscribePendingCommissionEditCount(callback) {
  const q = query(collection(db, COLLECTION), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => callback(snap.size), () => callback(0));
}

/**
 * Admin approves edit request:
 * 1. Mark request as approved
 * 2. Apply newData to the commission and clear pendingEdit fields
 */
export async function approveCommissionEditRequest(requestId, commissionId, newData) {
  const user = auth.currentUser;
  const adminName = user?.email || user?.uid || 'Admin';

  // 1. Mark request as approved
  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'approved',
    resolvedAt: serverTimestamp(),
    resolvedBy: adminName
  });

  // 2. Apply to commission
  await updateCommission(commissionId, {
    bookingNumber: newData.bookingNumber,
    bookingNumbers: newData.bookingNumbers || [],
    amount: Number(newData.amount),
    date: newData.date,
    details: newData.details,
    guestName: newData.guestName || '',
    roomNumber: newData.roomNumber || '',
    hasPendingEdit: false,
    pendingEditId: null,
    pendingEditData: null,
    pendingEditRequestedBy: null,
    pendingEditRequestedAt: null,
    pendingEditReason: null,
    lastEditedBy: adminName
  });
}

/**
 * Admin rejects edit request:
 * 1. Mark request as rejected
 * 2. Clear pendingEdit fields on commission (reverting back to old values)
 */
export async function rejectCommissionEditRequest(requestId, commissionId) {
  const user = auth.currentUser;
  const adminName = user?.email || user?.uid || 'Admin';

  // 1. Mark request as rejected
  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'rejected',
    resolvedAt: serverTimestamp(),
    resolvedBy: adminName
  });

  // 2. Clear pending flags on commission
  await updateCommission(commissionId, {
    hasPendingEdit: false,
    pendingEditId: null,
    pendingEditData: null,
    pendingEditRequestedBy: null,
    pendingEditRequestedAt: null,
    pendingEditReason: null
  });
}

/** Remove a resolved edit request from list */
export async function dismissCommissionEditRequest(requestId) {
  return deleteDoc(doc(db, COLLECTION, requestId));
}

