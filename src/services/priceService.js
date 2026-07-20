// src/services/priceService.js — Firestore CRUD for hotel pricing config
import {
  doc, getDoc, setDoc, addDoc, onSnapshot,
  collection, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const SETTINGS_DOC    = doc(db, 'settings', 'pricing');
const NOTIF_COLLECTION = collection(db, 'notifications');

/** Default price structure */
export const DEFAULT_PRICES = {
  // Room base prices per night (AC)
  ac: {
    single: 5000,
    double: 7500,
    triple: 10000,
  },
  // Room base prices per night (Non-AC)
  nonAc: {
    single: 3500,
    double: 5500,
    triple: 7500,
  },
  // Meal plan add-ons per person per night
  meals: {
    bb: 800,  // Bed & Breakfast
    hb: 1500, // Half Board
    fb: 2200, // Full Board
  },
  // Extra person charge per night
  extraPerson: 1500,
};

/** Friendly label map for price fields */
const PRICE_LABELS = {
  'ac.single':    'AC Single Room',
  'ac.double':    'AC Double Room',
  'ac.triple':    'AC Triple Room',
  'nonAc.single': 'Non-AC Single Room',
  'nonAc.double': 'Non-AC Double Room',
  'nonAc.triple': 'Non-AC Triple Room',
  'meals.bb':     'BB — Bed & Breakfast (per pax/night)',
  'meals.hb':     'HB — Half Board (per pax/night)',
  'meals.fb':     'FB — Full Board (per pax/night)',
  'extraPerson':  'Extra Person Charge',
};

/** Fetch prices once */
export async function getPrices() {
  const snap = await getDoc(SETTINGS_DOC);
  if (snap.exists()) {
    return { ...DEFAULT_PRICES, ...snap.data() };
  }
  return { ...DEFAULT_PRICES };
}

/** Real-time listener for price changes, falls back gracefully on error */
export function subscribePrices(callback, onError) {
  return onSnapshot(
    SETTINGS_DOC,
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_PRICES, ...snap.data() });
      } else {
        // Document doesn't exist yet — use defaults
        callback({ ...DEFAULT_PRICES });
      }
    },
    (err) => {
      console.warn('[subscribePrices] Firestore error:', err.code, err.message);
      // Fall back to defaults so the UI still renders
      callback({ ...DEFAULT_PRICES });
      if (onError) onError(err);
    }
  );
}

/**
 * Save prices and emit a notification with a diff of what changed.
 * @param {object} newPrices - The full new price object
 */
export async function savePrices(newPrices) {
  const user = auth.currentUser;

  // 1. Fetch current prices to diff against
  let oldPrices = { ...DEFAULT_PRICES };
  try {
    const snap = await getDoc(SETTINGS_DOC);
    if (snap.exists()) oldPrices = { ...DEFAULT_PRICES, ...snap.data() };
  } catch (_) { /* use defaults if fetch fails */ }

  // 2. Compute diff
  const changes = diffPrices(oldPrices, newPrices);

  // 3. Save new prices
  await setDoc(SETTINGS_DOC, {
    ...newPrices,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // 4. Write notification only if something actually changed
  if (changes.length > 0) {
    await addDoc(NOTIF_COLLECTION, {
      type: 'price_change',
      changedBy: user?.email || user?.uid || 'unknown',
      changedAt: serverTimestamp(),
      changes,            // array of { field, label, oldVal, newVal }
      status: 'unread',  // 'unread' | 'read'
    });
  }
}

/**
 * Produce an array of changed fields between old and new price objects.
 * Compares flat fields: ac.*, nonAc.*, meals.*, extraPerson
 */
function diffPrices(old, next) {
  const changes = [];

  const flat = (obj, prefix = '') =>
    Object.entries(obj).forEach(([k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        flat(v, key);
      } else if (typeof v === 'number') {
        const oldVal = getNestedVal(old, key);
        const newVal = getNestedVal(next, key);
        if (typeof oldVal === 'number' && typeof newVal === 'number' && oldVal !== newVal) {
          changes.push({
            field: key,
            label: PRICE_LABELS[key] || key,
            oldVal,
            newVal,
          });
        }
      }
    });

  // Only diff the known price sections
  ['ac', 'nonAc', 'meals'].forEach(section => {
    flat(next[section] || {}, section);
  });
  // Extra person (top-level number)
  const oldEP = typeof old.extraPerson === 'number' ? old.extraPerson : DEFAULT_PRICES.extraPerson;
  const newEP = typeof next.extraPerson === 'number' ? next.extraPerson : DEFAULT_PRICES.extraPerson;
  if (oldEP !== newEP) {
    changes.push({ field: 'extraPerson', label: PRICE_LABELS['extraPerson'], oldVal: oldEP, newVal: newEP });
  }

  return changes;
}

function getNestedVal(obj, dotKey) {
  return dotKey.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
}

/* ── Notification helpers ────────────────────────────────────── */

/** Real-time listener for ALL notifications */
export function subscribeNotifications(callback, onError) {
  return onSnapshot(
    NOTIF_COLLECTION,
    (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first
      notifs.sort((a, b) => {
        const aT = a.changedAt?.toDate ? a.changedAt.toDate() : new Date(a.changedAt || 0);
        const bT = b.changedAt?.toDate ? b.changedAt.toDate() : new Date(b.changedAt || 0);
        return bT - aT;
      });
      callback(notifs);
    },
    (err) => {
      console.error('[subscribeNotifications]', err);
      if (onError) onError(err);
    }
  );
}

/** Count of unread price-change notifications */
export function subscribeUnreadPriceNotifCount(callback) {
  // Client-side count — avoids needing a composite Firestore index
  return onSnapshot(NOTIF_COLLECTION, (snap) => {
    const count = snap.docs.filter(d => d.data().status === 'unread').length;
    callback(count);
  }, () => callback(0));
}

/** Mark a notification as read */
export async function markNotificationRead(id) {
  const { updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'notifications', id), { status: 'read' });
}

/** Delete (dismiss) a notification */
export async function dismissNotification(id) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'notifications', id));
}
