import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

const COLLECTION_NAME = 'utilityBills';

export async function addUtilityBill(billData) {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...billData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding utility bill: ', error);
    throw error;
  }
}

export function subscribeUtilityBills(callback) {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const bills = [];
    snapshot.forEach((doc) => {
      bills.push({ id: doc.id, ...doc.data() });
    });
    callback(bills);
  }, (error) => {
    console.error('Error listening to utility bills: ', error);
  });
}

export async function deleteUtilityBill(billId) {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, billId));
  } catch (error) {
    console.error('Error deleting utility bill: ', error);
    throw error;
  }
}
