// src/utils/dateHelpers.js — Date utility functions

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** Format a JS Date to YYYY-MM-DD string */
export function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** Format a JS Date or Firestore timestamp to display string */
export function formatDate(date, includeYear = false) {
  const d = date?.toDate ? date.toDate() : new Date(date);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()].slice(0,3);
  const year = d.getFullYear();
  return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
}

/** Get all date strings in a range [checkIn, checkOut) — checkout day excluded */
export function getDatesInRange(checkIn, checkOut) {
  const dates = [];
  const start = checkIn?.toDate ? checkIn.toDate() : new Date(checkIn);
  const end   = checkOut?.toDate ? checkOut.toDate() : new Date(checkOut);
  const cur = new Date(start);
  cur.setHours(0,0,0,0);
  const endD = new Date(end);
  endD.setHours(0,0,0,0);
  while (cur < endD) {   // strict < excludes the checkout date
    dates.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}


/** Number of nights between two dates */
export function nightCount(checkIn, checkOut) {
  const start = checkIn?.toDate ? checkIn.toDate() : new Date(checkIn);
  const end   = checkOut?.toDate ? checkOut.toDate() : new Date(checkOut);
  return Math.max(1, Math.round((end - start) / 86400000));
}

/** Get start/end of current week (Mon–Sun) */
export function getWeekRange(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // make Mon first
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0,0,0,0);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    dates.push(dd);
  }
  return dates;
}

/** Get all days in a month */
export function getMonthDays(year, month) {
  const days = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

/** Get all months labels for yearly view */
export function getYearMonths(year) {
  return Array.from({length:12}, (_,i) => ({
    label: MONTHS[i].slice(0,3),
    year,
    month: i
  }));
}

/** Format currency */
export function formatCurrency(amount) {
  return `LKR ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}
