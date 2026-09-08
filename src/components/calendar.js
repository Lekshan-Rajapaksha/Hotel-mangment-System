// src/components/calendar.js — Room × Day calendar grid
import {
  toDateStr, formatDate, getDatesInRange,
  getWeekRange, getMonthDays, getYearMonths,
  MONTHS, DAYS_SHORT
} from '../utils/dateHelpers.js';
import { openBookingModal } from './bookingModal.js';
import { openPrintBill } from './printBill.js';
import { subscribeBookings } from '../services/bookingService.js';
import { deleteBooking } from '../services/bookingService.js';
import { showToast, showSpinner, hideSpinner } from '../utils/toast.js';

const ROOMS = [1,2,3,4,5,6,7];

// Per-room color palettes for admin compact view
const ROOM_COLORS = [
  { bg: 'linear-gradient(135deg,#4f72f5,#7c5cf6)', dot: '#4f72f5' }, // Room 1 — indigo/purple
  { bg: 'linear-gradient(135deg,#f5692a,#f53e7a)', dot: '#f5692a' }, // Room 2 — orange/pink
  { bg: 'linear-gradient(135deg,#22c55e,#16a34a)', dot: '#22c55e' }, // Room 3 — green
  { bg: 'linear-gradient(135deg,#06b6d4,#0284c7)', dot: '#06b6d4' }, // Room 4 — cyan/blue
  { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', dot: '#f59e0b' }, // Room 5 — amber
  { bg: 'linear-gradient(135deg,#ec4899,#a855f7)', dot: '#ec4899' }, // Room 6 — pink/violet
  { bg: 'linear-gradient(135deg,#14b8a6,#0d9488)', dot: '#14b8a6' }, // Room 7 — teal
];

// DOW header colors for admin view (Sun-Sat)
const DOW_COLORS = [
  '#ef4444', // Sun — red
  '#4f72f5', // Mon — blue
  '#7c5cf6', // Tue — purple
  '#22c55e', // Wed — green
  '#f59e0b', // Thu — amber
  '#06b6d4', // Fri — cyan
  '#ec4899', // Sat — pink
];
let currentView = 'weekly';
let currentRef = new Date();
let bookingsMap = {}; // { "roomX_dateY": booking }
let allBookings = [];
let unsubscribe = null;
let isAdmin = false;

export function renderCalendar(container, role) {
  isAdmin = role === 'admin';

  const adminClass = isAdmin ? 'admin-cal' : '';

  const html = `
    <div class="cal-wrapper ${adminClass}" id="cal-wrapper">
      <div class="cal-toolbar">
        <div class="cal-nav">
          <button class="cal-nav-btn" id="cal-prev" title="Previous">◀</button>
          <button class="cal-nav-btn" id="cal-today-btn" title="Today" style="width:auto;padding:0 12px;font-size:0.8rem;font-weight:600">Today</button>
          <button class="cal-nav-btn" id="cal-next" title="Next">▶</button>
        </div>
        <div class="cal-title" id="cal-title">Loading…</div>
        <div class="view-toggle">
          <button class="view-toggle-btn ${currentView==='weekly'?'active':''}" data-view="weekly" id="view-weekly">Week</button>
          <button class="view-toggle-btn ${currentView==='monthly'?'active':''}" data-view="monthly" id="view-monthly">Month</button>
          <button class="view-toggle-btn ${currentView==='yearly'?'active':''}" data-view="yearly" id="view-yearly">Year</button>
        </div>
      </div>
      <div class="cal-scroll" id="cal-scroll">
        <div id="cal-grid-container"></div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  bindCalendarEvents();

  // Subscribe to real-time bookings
  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeBookings(
    (bookings) => {
      allBookings = bookings;
      buildBookingsMap(bookings);
      renderGrid();
    },
    (err) => {
      // Show a visible error in the grid instead of staying stuck on "Loading…"
      const gc = document.getElementById('cal-grid-container');
      if (gc) {
        gc.innerHTML = `
          <div style="padding:40px; text-align:center; color:var(--clr-danger, #ef4444);">
            <div style="font-size:2rem; margin-bottom:12px;">⚠️</div>
            <div style="font-weight:700; margin-bottom:6px;">Failed to load bookings</div>
            <div style="font-size:0.82rem; color:var(--clr-text-muted, #888);">${err.message}</div>
            <div style="font-size:0.78rem; color:var(--clr-text-muted, #888); margin-top:8px;">Check the browser console for details.</div>
          </div>`;
      }
      const titleEl = document.getElementById('cal-title');
      if (titleEl) titleEl.textContent = 'Error loading data';
    }
  );
}

export function destroyCalendar() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function buildBookingsMap(bookings) {
  bookingsMap = {};
  bookings.forEach(b => {
    const dates = getDatesInRange(b.checkIn, b.checkOut);
    dates.forEach(dateStr => {
      const key = `room${b.roomNumber}_${dateStr}`;
      bookingsMap[key] = b;
    });
  });
}

function bindCalendarEvents() {
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    navigatePrev();
    renderGrid();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    navigateNext();
    renderGrid();
  });
  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    currentRef = new Date();
    renderGrid();
  });

  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRef = new Date();
      renderGrid();
    });
  });
}

function navigatePrev() {
  if (currentView === 'weekly') {
    currentRef = new Date(currentRef.getTime() - 7 * 86400000);
  } else if (currentView === 'monthly') {
    currentRef = new Date(currentRef.getFullYear(), currentRef.getMonth() - 1, 1);
  } else {
    currentRef = new Date(currentRef.getFullYear() - 1, 0, 1);
  }
}

function navigateNext() {
  if (currentView === 'weekly') {
    currentRef = new Date(currentRef.getTime() + 7 * 86400000);
  } else if (currentView === 'monthly') {
    currentRef = new Date(currentRef.getFullYear(), currentRef.getMonth() + 1, 1);
  } else {
    currentRef = new Date(currentRef.getFullYear() + 1, 0, 1);
  }
}

function getDays() {
  if (currentView === 'weekly') return getWeekRange(currentRef);
  if (currentView === 'monthly') return getMonthDays(currentRef.getFullYear(), currentRef.getMonth());
  // Yearly: show all months as columns (just labels for month summary)
  return getYearMonths(currentRef.getFullYear());
}

function renderGrid() {
  const container = document.getElementById('cal-grid-container');
  if (!container) return;

  const todayStr = toDateStr(new Date());
  const days = getDays();

  let titleText = '';
  if (currentView === 'weekly') {
    const first = days[0];
    const last  = days[days.length-1];
    titleText = `${formatDate(first)} — ${formatDate(last, true)}`;
  } else if (currentView === 'monthly') {
    titleText = `${MONTHS[currentRef.getMonth()]} ${currentRef.getFullYear()}`;
  } else {
    titleText = `Year ${currentRef.getFullYear()} — Overview`;
  }
  const titleEl = document.getElementById('cal-title');
  if (titleEl) titleEl.textContent = titleText;

  // Build column count
  const cols = days.length;

  // Admin compact view: weekly fits all 7 days with no scroll; monthly/yearly allow a small scroll
  let colsTemplate;
  if (isAdmin) {
    if (currentView === 'weekly') {
      // 7 days — always fits on screen, no scroll needed
      colsTemplate = `36px repeat(${cols}, minmax(0, 1fr))`;
    } else {
      // Monthly (28–31 cols) or yearly (12 cols) — allow a small scroll with min cell size
      colsTemplate = `36px repeat(${cols}, minmax(28px, 1fr))`;
    }
  } else {
    colsTemplate = `110px repeat(${cols}, minmax(100px, 1fr))`;
  }

  let html = `<div class="cal-grid" style="grid-template-columns:${colsTemplate}">`;

  // --- Header row ---
  html += `<div class="cal-header-cell" style="grid-column:1">#</div>`;
  days.forEach((day, i) => {
    let label = '';
    let isToday = false;
    if (currentView === 'weekly' || currentView === 'monthly') {
      const d = day;
      const ds = toDateStr(d);
      isToday = ds === todayStr;
      const dowIdx = d.getDay();
      const dowColor = isAdmin ? DOW_COLORS[dowIdx] : 'inherit';
      const dayName = DAYS_SHORT[d.getDay()];
      if (isAdmin) {
        label = `<div style="font-weight:800;font-size:0.7rem">${d.getDate()}</div><div style="font-size:0.6rem;font-weight:700;color:${dowColor}">${dayName}</div>`;
        if (isToday) label += `<div style="width:5px;height:5px;background:var(--clr-primary);border-radius:50%;margin:1px auto 0"></div>`;
      } else {
        label = `<div style="font-weight:800">${d.getDate()}</div><div style="font-size:0.68rem;opacity:0.8">${dayName}</div>`;
        if (isToday) label += `<div style="width:6px;height:6px;background:var(--clr-primary);border-radius:50%;margin:2px auto 0"></div>`;
      }
    } else {
      label = `<div style="font-weight:800">${day.label}</div><div style="font-size:0.68rem;opacity:0.7">${day.year}</div>`;
    }
    html += `<div class="cal-header-cell ${isToday ? 'today-header' : ''}" style="grid-column:${i+2}">${label}</div>`;
  });

  // --- Room rows ---
  ROOMS.forEach((room, roomIdx) => {
    const roomColor = ROOM_COLORS[(roomIdx) % ROOM_COLORS.length];

    if (isAdmin) {
      // Admin: compact label — just the room number with room color dot
      html += `
        <div class="cal-room-label admin-room-label" style="grid-column:1; grid-row:auto">
          <span class="admin-room-dot" style="background:${roomColor.dot}"></span>
          <span class="cal-room-num">${room}</span>
        </div>
      `;
    } else {
      html += `
        <div class="cal-room-label" style="grid-column:1; grid-row:auto">
          <span class="cal-room-icon">🚪</span>
          <span class="cal-room-word">Room </span><span class="cal-room-num">${room}</span>
        </div>
      `;
    }

    days.forEach((day, i) => {
      let dateStr = '';
      let isToday = false;
      if (currentView === 'weekly' || currentView === 'monthly') {
        dateStr = toDateStr(day);
        isToday = dateStr === todayStr;
      } else {
        // For yearly: check if any booking exists in that month for that room
        dateStr = `${day.year}-${String(day.month+1).padStart(2,'0')}`;
      }

      // For yearly view: look for any booking in that month
      let booking = null;
      if (currentView === 'yearly') {
        booking = allBookings.find(b => {
          const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
          const co = b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut);
          const monthStart = new Date(day.year, day.month, 1);
          const monthEnd   = new Date(day.year, day.month + 1, 0);
          return b.roomNumber === room && ci <= monthEnd && co >= monthStart;
        });
      } else {
        booking = bookingsMap[`room${room}_${dateStr}`];
      }

      const isBooked = !!booking;

      // Compute occasion badges (shared logic)
      let occasionBadge = '';
      if (isBooked && booking) {
        const checkOutDate = booking.checkOut?.toDate ? booking.checkOut.toDate() : new Date(booking.checkOut);
        const lastBookedDate = new Date(checkOutDate);
        lastBookedDate.setDate(lastBookedDate.getDate() - 1);
        const lastBookedStr = toDateStr(lastBookedDate);

        const resolveDateStr = (savedDate) => {
          if (!savedDate) return lastBookedStr;
          const checkOutStr = toDateStr(checkOutDate);
          if (savedDate === checkOutStr) return lastBookedStr;
          return savedDate;
        };

        const bdayDisplayDate  = booking.specialBirthday    ? resolveDateStr(booking.birthdayDate)    : null;
        const annivDisplayDate = booking.specialAnniversary ? resolveDateStr(booking.anniversaryDate) : null;

        const isBdayCell  = bdayDisplayDate  && dateStr === bdayDisplayDate;
        const isAnnivCell = annivDisplayDate && dateStr === annivDisplayDate;

        if (isBdayCell && isAnnivCell) {
          occasionBadge = `<span class="cal-occasion-badge" title="Birthday & Anniversary">🎂💑</span>`;
        } else if (isBdayCell) {
          occasionBadge = `<span class="cal-occasion-badge" title="Birthday 🎂">🎂</span>`;
        } else if (isAnnivCell) {
          occasionBadge = `<span class="cal-occasion-badge" title="Anniversary 💑">💑</span>`;
        }
      }

      let cellContent = '';

      if (isAdmin) {
        // Admin view: color-coded cells + name detail (hidden on mobile via CSS)
        const bookedStyle = isBooked
          ? `background:${roomColor.bg};`
          : '';
        const todayStyle = isToday && !isBooked ? 'background:#eef2ff;' : '';
        const cellClass = `cal-cell admin-cell ${isBooked ? 'booked' : ''} ${isToday ? 'today-col' : ''}`;
        if (isBooked && booking) {
          const src = booking.source || '';
          const acBed = `${booking.acType||'N/A'} · ${booking.bedType||'N/A'}`;
          cellContent = `
            <div class="admin-cell-detail">
              <div class="admin-cell-name">${booking.guestName}${occasionBadge}</div>
              <div class="admin-cell-sub">${src ? src + ' · ' : ''}${acBed}</div>
            </div>
            ${occasionBadge ? `<span class="admin-occasion admin-occasion-mobile">${occasionBadge}</span>` : ''}
          `;
        }
        html += `
          <div
            class="${cellClass}"
            data-room="${room}"
            data-date="${dateStr}"
            data-booking-id="${booking?.id || ''}"
            title="${isBooked ? `${booking.guestName} · Room ${room}` : `Room ${room} · ${dateStr}`}"
            style="${bookedStyle}${todayStyle}"
          >
            ${cellContent}
          </div>
        `;
      } else {
        // Standard receptionist view
        const cellClass = `cal-cell ${isBooked ? 'booked' : ''} ${isToday ? 'today-col' : ''}`;
        if (isBooked && booking) {
          const acBed = `${booking.acType||'N/A'} · ${booking.bedType||'N/A'}`;
          const meals = booking.meals && booking.meals !== 'None' ? ` · 🍽️ ${booking.meals}` : '';
          const src = booking.source || '';
          cellContent = `
            <div class="cal-cell-info">
              <div class="cal-cell-name">${booking.guestName}${occasionBadge}</div>
              <div class="cal-cell-sub">${src ? src + ' · ' : ''}${acBed}${meals}</div>
            </div>
          `;
        }
        if (isToday && !isBooked) {
          cellContent += `<span class="cal-today-badge">Today</span>`;
        }
        html += `
          <div
            class="${cellClass}"
            data-room="${room}"
            data-date="${dateStr}"
            data-booking-id="${booking?.id || ''}"
            title="${isBooked ? `${booking.guestName} · Room ${room}` : `Room ${room} · ${dateStr}`}"
          >
            ${cellContent}
          </div>
        `;
      }
    });
  });

  html += `</div>`;
  container.innerHTML = html;

  // Bind cell clicks
  container.querySelectorAll('.cal-cell').forEach(cell => {
    cell.addEventListener('click', () => handleCellClick(cell));
  });
}

function handleCellClick(cell) {
  const room = parseInt(cell.dataset.room);
  const date = cell.dataset.date;
  const bookingId = cell.dataset.bookingId;

  if (bookingId) {
    // Find booking
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) return;

    if (isAdmin) {
      showAdminBookingModal(booking);
    } else {
      openBookingModal({
        booking,
        allBookings,
        onSaved: () => {} // real-time listener will refresh
      });
    }
  } else {
    if (isAdmin) {
      showToast('Admins can view & delete bookings only', 'info');
      return;
    }
    // New booking
    openBookingModal({
      defaultRoom: room,
      defaultDate: date,
      allBookings,
      onSaved: () => {}
    });
  }
}

function showAdminBookingModal(booking) {
  document.querySelector('#admin-booking-view')?.remove();

  const nights = Math.round(
    (new Date(booking.checkOut?.toDate ? booking.checkOut.toDate() : booking.checkOut) -
     new Date(booking.checkIn?.toDate ? booking.checkIn.toDate() : booking.checkIn)) / 86400000
  );

  const html = `
    <div class="modal-overlay" id="admin-booking-view">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">📋 Booking Details</h2>
          <button class="modal-close" id="abv-close">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px">
            ${infoRow('Guest', booking.guestName)}
            ${infoRow('Phone', booking.phone)}
            ${infoRow('Room', `Room ${booking.roomNumber}`)}
            ${infoRow('Check-In', formatDate(booking.checkIn, true))}
            ${infoRow('Check-Out', formatDate(booking.checkOut, true))}
            ${infoRow('Nights', `${nights} night${nights>1?'s':''}`)}
            ${infoRow('Bed Type', booking.bedType)}
            ${infoRow('AC', booking.acType)}
            ${infoRow('Meals', booking.meals)}
            ${infoRow('Source', booking.source || 'Direct')}
            ${infoRow('Full Price', `LKR ${Number(booking.fullPrice||0).toLocaleString()}`)}
            ${infoRow('Advance', `LKR ${Number(booking.advancePaid||0).toLocaleString()}`)}
            ${infoRow('Remaining', `LKR ${Number(booking.remaining||0).toLocaleString()}`)}
            ${booking.specialBirthday ? infoRow('🎂 Birthday', booking.birthdayDate ? new Date(booking.birthdayDate).toLocaleDateString('en-LK', {day:'numeric',month:'long',year:'numeric'}) : 'Date not set') : ''}
            ${booking.specialAnniversary ? infoRow('💑 Anniversary', booking.anniversaryDate ? new Date(booking.anniversaryDate).toLocaleDateString('en-LK', {day:'numeric',month:'long',year:'numeric'}) : 'Date not set') : ''}
            ${booking.passportNumber ? infoRow('Passport', booking.passportNumber) : ''}
            ${booking.companyName ? infoRow('Company', booking.companyName) : ''}
          </div>
          ${booking.additionalGuests?.length ? `
            <div class="section-title">Additional Guests</div>
            ${booking.additionalGuests.map(g => `<div style="font-size:0.85rem;margin-bottom:4px">👤 ${g.name} ${g.passport ? '— '+g.passport : ''}</div>`).join('')}
          ` : ''}
          ${booking.notes ? `<div style="margin-top:12px;padding:10px;background:var(--clr-surface);border-radius:6px;font-size:0.85rem;color:var(--clr-text-muted)">📝 ${booking.notes}</div>` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="abv-close-2">Close</button>
          <button class="btn btn-secondary" id="abv-print-btn" style="display:inline-flex;align-items:center;gap:6px">🖨️ Print Bill</button>
          <button class="btn btn-danger" id="abv-delete-btn">🗑 Delete Booking</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const closeAdminView = () => document.getElementById('admin-booking-view')?.remove();
  document.getElementById('abv-close')?.addEventListener('click', closeAdminView);
  document.getElementById('abv-close-2')?.addEventListener('click', closeAdminView);
  document.getElementById('abv-print-btn')?.addEventListener('click', () => {
    openPrintBill(booking);
  });
  document.getElementById('admin-booking-view')?.addEventListener('click', e => {
    if (e.target.id === 'admin-booking-view') closeAdminView();
  });



  document.getElementById('abv-delete-btn')?.addEventListener('click', async () => {
    if (!confirm(`Delete booking for "${booking.guestName}"? This is permanent.`)) return;
    showSpinner();
    try {
      await deleteBooking(booking.id);
      showToast('Booking deleted', 'info');
      hideSpinner();
      closeAdminView();
    } catch (err) {
      hideSpinner();
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

function infoRow(label, value) {
  return `
    <div>
      <div style="font-size:0.72rem;color:var(--clr-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">${label}</div>
      <div style="font-size:0.9rem;font-weight:600;color:var(--clr-text)">${value || '—'}</div>
    </div>
  `;
}
