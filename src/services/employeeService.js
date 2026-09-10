import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase.js';

const EMPLOYEES_COL = 'employees';
const ATTENDANCE_COL = 'employeeAttendance';
const SALARY_COL = 'employeeSalaryPayments';

// --- Employees ---

export async function addEmployee(employeeData) {
  try {
    const docRef = await addDoc(collection(db, EMPLOYEES_COL), {
      ...employeeData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding employee:', error);
    throw error;
  }
}

export function subscribeEmployees(callback) {
  const q = query(collection(db, EMPLOYEES_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const employees = [];
    snapshot.forEach(doc => {
      employees.push({ id: doc.id, ...doc.data() });
    });
    callback(employees);
  }, error => {
    console.error('Error listening to employees:', error);
  });
}

export async function deleteEmployee(employeeId) {
  try {
    await deleteDoc(doc(db, EMPLOYEES_COL, employeeId));
  } catch (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }
}

// --- Attendance ---

export async function addAttendance(employeeId, dateStr, status) {
  // dateStr format: YYYY-MM-DD
  try {
    // Check if an attendance record already exists for this date and employee
    const q = query(
      collection(db, ATTENDANCE_COL),
      where('employeeId', '==', employeeId),
      where('date', '==', dateStr)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Update existing
      const existingDocId = querySnapshot.docs[0].id;
      await updateDoc(doc(db, ATTENDANCE_COL, existingDocId), { status });
    } else {
      // Add new
      await addDoc(collection(db, ATTENDANCE_COL), {
        employeeId,
        date: dateStr,
        status, // 'Full Day', 'Half Day', 'Absent'
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error adding attendance:', error);
    throw error;
  }
}

export function subscribeAttendance(employeeId, callback) {
  const q = query(
    collection(db, ATTENDANCE_COL),
    where('employeeId', '==', employeeId)
  );
  return onSnapshot(q, (snapshot) => {
    const attendance = [];
    snapshot.forEach(doc => {
      attendance.push({ id: doc.id, ...doc.data() });
    });
    // Sort descending by date
    attendance.sort((a, b) => b.date.localeCompare(a.date));
    callback(attendance);
  }, error => {
    console.error('Error listening to attendance:', error);
  });
}

export async function deleteAttendance(employeeId, dateStr) {
  try {
    const q = query(
      collection(db, ATTENDANCE_COL),
      where('employeeId', '==', employeeId),
      where('date', '==', dateStr)
    );
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, ATTENDANCE_COL, docSnap.id)));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting attendance:', error);
    throw error;
  }
}

// Subscribe to all attendance across all employees
export function subscribeAllAttendance(callback) {
  const q = query(
    collection(db, ATTENDANCE_COL),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const attendance = [];
    snapshot.forEach(doc => {
      attendance.push({ id: doc.id, ...doc.data() });
    });
    callback(attendance);
  }, error => {
    console.error('Error listening to all attendance:', error);
  });
}

// Subscribe to all attendance for the current month across all employees (useful for salary calculations)
export function subscribeAttendanceByMonth(monthStr, callback) {
  // We'll just fetch all and filter client-side to keep it simple, or filter by a prefix
  // Since date is YYYY-MM-DD, we can check if date starts with YYYY-MM
  const q = query(
    collection(db, ATTENDANCE_COL),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const attendance = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.date.startsWith(monthStr)) {
        attendance.push({ id: doc.id, ...data });
      }
    });
    callback(attendance);
  }, error => {
    console.error('Error listening to monthly attendance:', error);
  });
}


// --- Salary Payments ---

// Calculate salary breakdown based on Basic ÷ 26 per day (Half Day = 0.5 * dailyRate)
export function calculateSalaryBreakdown({ basic, fullDays = 0, halfDays = 0, serviceCharge = 0, alreadyPaid = 0 }) {
  const basicSalary = Number(basic) || 0;
  const dailyRate = Math.round((basicSalary / 26) * 100) / 100;
  const fDays = Number(fullDays) || 0;
  const hDays = Number(halfDays) || 0;
  const effectiveDays = fDays + (hDays * 0.5);
  const earnedBasic = Math.round(effectiveDays * (basicSalary / 26));
  const sc = Number(serviceCharge) || 0;
  const totalOwed = Math.round(earnedBasic + sc);
  const paid = Number(alreadyPaid) || 0;
  const remaining = Math.max(0, totalOwed - paid);

  return {
    basicSalary,
    dailyRate,
    fullDays: fDays,
    halfDays: hDays,
    effectiveDays,
    earnedBasic,
    serviceCharge: sc,
    totalOwed,
    alreadyPaid: paid,
    remaining
  };
}

export async function paySalary(employeeId, paymentData) {
  try {
    const docRef = await addDoc(collection(db, SALARY_COL), {
      employeeId,
      ...paymentData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error recording salary payment:', error);
    throw error;
  }
}

export function subscribeSalaryPayments(employeeId, callback) {
  const q = query(
    collection(db, SALARY_COL),
    where('employeeId', '==', employeeId)
  );
  return onSnapshot(q, (snapshot) => {
    const payments = [];
    snapshot.forEach(doc => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    // Sort descending by createdAt
    payments.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0;
      const timeB = b.createdAt?.toMillis() || 0;
      return timeB - timeA;
    });
    callback(payments);
  }, error => {
    console.error('Error listening to salary payments:', error);
  });
}

export async function deleteSalaryPayment(paymentId) {
  try {
    await deleteDoc(doc(db, SALARY_COL, paymentId));
  } catch (error) {
    console.error('Error deleting salary payment:', error);
    throw error;
  }
}

export function subscribeAllSalaryPayments(callback) {
  const q = query(collection(db, SALARY_COL));
  return onSnapshot(q, (snapshot) => {
    const payments = [];
    snapshot.forEach(doc => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    callback(payments);
  }, error => {
    console.error('Error listening to all salary payments:', error);
  });
}
