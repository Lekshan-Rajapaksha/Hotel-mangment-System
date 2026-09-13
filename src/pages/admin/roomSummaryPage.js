// src/pages/admin/roomSummaryPage.js — Room-by-room booking calendar summary (Admin only)
import { subscribeAllBookings } from '../../services/bookingService.js';
import { toDateStr, MONTHS } from '../../utils/dateHelpers.js';

const ROOMS = [100, 101, 102, 103, 104, 105, 106];
let unsubscribe = null;
let currentView = 'monthly';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedYearRoom = 100;   // for yearly single-room view
let allBookings = [];

export function renderRoomSummaryPage(container) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  currentView = 'monthly';
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  selectedYearRoom = 100;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🏨 Room Summary</h1>
        <div style="font-size:0.82rem;color:var(--clr-text-muted);margin-top:2px">Booking occupancy by room — colour-coded calendar view</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <!-- View toggle -->
        <div class="rs-toggle-group" id="rs-view-toggle">
          <button class="rs-toggle-btn active" data-view="monthly">Monthly</button>
          <button class="rs-toggle-btn" data-view="yearly">Yearly</button>
        </div>
        <!-- Navigator (hidden in yearly) -->
        <div style="display:flex;align-items:center;gap:6px" id="rs-nav-bar">
          <button class="btn btn-ghost btn-sm" id="rs-prev" style="padding:6px 12px">◀</button>
          <span id="rs-period-label" style="font-weight:600;font-size:0.9rem;min-width:160px;text-align:center;color:var(--clr-text)"></span>
          <button class="btn btn-ghost btn-sm" id="rs-next" style="padding:6px 12px">▶</button>
          <button class="btn btn-ghost btn-sm" id="rs-today" style="padding:6px 12px;font-size:0.78rem">Today</button>
        </div>
        <!-- Yearly room dropdown (only shown in yearly view) -->
        <div id="rs-yearly-controls" style="display:none;align-items:center;gap:8px">
          <label style="font-size:0.82rem;font-weight:600;color:var(--clr-text-muted)">Room:</label>
          <select id="rs-year-room-select" class="form-control" style="width:110px;height:36px;font-size:0.85rem">
            ${ROOMS.map(r => `<option value="${r}" ${r === selectedYearRoom ? 'selected' : ''}>Room ${r}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" id="rs-year-prev" style="padding:6px 12px">◀</button>
          <span id="rs-year-label" style="font-weight:600;font-size:0.9rem;color:var(--clr-text);min-width:48px;text-align:center"></span>
          <button class="btn btn-ghost btn-sm" id="rs-year-next" style="padding:6px 12px">▶</button>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div style="display:flex;align-items:center;gap:16px;padding:0 0 18px 0;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--clr-text-muted)">
        <span class="rs-dot rs-dot-booked"></span> Booked
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--clr-text-muted)">
        <span class="rs-dot rs-dot-free"></span> Available
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--clr-text-muted)">
        <span class="rs-dot rs-dot-checkout"></span> Check-out day
      </div>
    </div>

    <div class="page-body" style="padding-top:0">
      <div id="rs-rooms-grid" class="rs-rooms-grid">
        ${ROOMS.map(() => `<div class="rs-room-card rs-skeleton"></div>`).join('')}
      </div>
    </div>
  `;

  bindControls();
  updatePeriodLabel();

  unsubscribe = subscribeAllBookings((bookings) => {
    allBookings = bookings.filter(b => b.status !== 'cancelled');
    renderRooms();
  });
}

/* ───────────────────────── Controls ───────────────────────── */
function bindControls() {
  // View toggle
  document.querySelectorAll('.rs-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rs-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
      toggleYearlyUI();
      updatePeriodLabel();
      renderRooms();
    });
  });

  // Monthly/weekly nav
  document.getElementById('rs-prev')?.addEventListener('click', () => navigate(-1));
  document.getElementById('rs-next')?.addEventListener('click', () => navigate(1));
  document.getElementById('rs-today')?.addEventListener('click', () => {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    updatePeriodLabel();
    renderRooms();
  });

  // Yearly controls
  document.getElementById('rs-year-room-select')?.addEventListener('change', (e) => {
    selectedYearRoom = parseInt(e.target.value);
    renderRooms();
  });
  document.getElementById('rs-year-prev')?.addEventListener('click', () => {
    currentYear--;
    document.getElementById('rs-year-label').textContent = currentYear;
    renderRooms();
  });
  document.getElementById('rs-year-next')?.addEventListener('click', () => {
    currentYear++;
    document.getElementById('rs-year-label').textContent = currentYear;
    renderRooms();
  });
}

function toggleYearlyUI() {
  const navBar = document.getElementById('rs-nav-bar');
  const yearlyControls = document.getElementById('rs-yearly-controls');
  if (currentView === 'yearly') {
    if (navBar) navBar.style.display = 'none';
    if (yearlyControls) { yearlyControls.style.display = 'flex'; }
    const lbl = document.getElementById('rs-year-label');
    if (lbl) lbl.textContent = currentYear;
  } else {
    if (navBar) navBar.style.display = 'flex';
    if (yearlyControls) yearlyControls.style.display = 'none';
  }
}

function navigate(dir) {
  if (currentView === 'monthly') {
    currentMonth += dir;
    if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0;  currentYear++; }
  } else {
    currentYear += dir;
  }
  updatePeriodLabel();
  renderRooms();
}

/* ───────────────────────── Booked-date lookup ───────────────────────── */
function buildBookedMap() {
  const map = new Map();
  for (const b of allBookings) {
    const room = b.roomNumber;
    if (!map.has(room)) map.set(room, new Set());
    const start = b.checkIn?.toDate  ? b.checkIn.toDate()  : new Date(b.checkIn);
    const end   = b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut);
    const cur = new Date(start); cur.setHours(0,0,0,0);
    const endD = new Date(end);  endD.setHours(0,0,0,0);
    while (cur < endD) {
      map.get(room).add(toDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    map.get(room).add('co:' + toDateStr(endD));
  }
  return map;
}

/* ───────────────────────── Period label ───────────────────────── */
function updatePeriodLabel() {
  const label = document.getElementById('rs-period-label');
  if (!label) return;
  label.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
}

/* ───────────────────────── Render ───────────────────────── */
function renderRooms() {
  const bookedMap = buildBookedMap();
  const grid = document.getElementById('rs-rooms-grid');
  if (!grid) return;

  if (currentView === 'yearly') {
    const bookedDates = bookedMap.get(selectedYearRoom) || new Set();
    const bookingsForRoom = allBookings.filter(b => b.roomNumber === selectedYearRoom);
    grid.className = 'rs-yearly-single-container';
    grid.innerHTML = `
      <div class="rs-yearly-single-card">
        <div class="rs-room-header" style="margin-bottom:20px">
          <div class="rs-room-badge" style="font-size:1rem;padding:6px 18px">Room ${selectedYearRoom} — ${currentYear}</div>
          <span class="rs-stat-pill">${bookingsForRoom.length} booking${bookingsForRoom.length !== 1 ? 's' : ''} this year</span>
        </div>
        ${renderYearlyCalendar(currentYear, bookedDates)}
      </div>
    `;
  } else {
    grid.className = 'rs-rooms-grid';
    grid.innerHTML = ROOMS.map(room => {
      const bookedDates = bookedMap.get(room) || new Set();
      return renderRoomCard(room, bookedDates);
    }).join('');
  }
}

/* ───────────────────────── Room card (weekly/monthly) ───────────────────────── */
function renderRoomCard(roomNum, bookedDates) {
  const bookingsForRoom = allBookings.filter(b => b.roomNumber === roomNum);
  const bookedCount = bookingsForRoom.length;

  const calendarHTML = renderMonthCalendar(currentYear, currentMonth, bookedDates);

  return `
    <div class="rs-room-card">
      <div class="rs-room-header">
        <div class="rs-room-badge">Room ${roomNum}</div>
        <span class="rs-stat-pill">${bookedCount} booking${bookedCount !== 1 ? 's' : ''}</span>
      </div>
      ${calendarHTML}
    </div>
  `;
}

/* ───────────────────────── Month calendar ───────────────────────── */
function renderMonthCalendar(year, month, bookedDates) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const startMon = new Date(firstDay);
  const dow = startMon.getDay();
  startMon.setDate(startMon.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks = [];
  const cur = new Date(startMon);
  while (cur <= lastDay || weeks.length < 4) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur > lastDay && weeks.length >= 4) break;
  }

  return `
    <div class="rs-mini-cal">
      <div class="rs-cal-head">${DAY_LABELS.map(d => `<span>${d}</span>`).join('')}</div>
      ${weeks.map(week => `
        <div class="rs-cal-week">
          ${week.map(date => {
            const ds = toDateStr(date);
            const inMonth = date.getMonth() === month;
            const isBooked   = bookedDates.has(ds);
            const isCheckout = bookedDates.has('co:' + ds) && !isBooked;
            let cls = 'rs-cal-day';
            if (!inMonth)   cls += ' rs-day-other';
            if (isBooked)   cls += ' rs-day-booked';
            if (isCheckout) cls += ' rs-day-checkout';
            return `<span class="${cls}" title="${ds}">${date.getDate()}</span>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

/* ───────────────────────── Yearly — 12 months grid for 1 room ───────────────────────── */
function renderYearlyCalendar(year, bookedDates) {
  const monthsHTML = MONTHS.map((mName, mi) => `
    <div class="rs-year-month">
      <div class="rs-year-month-label">${mName}</div>
      ${renderMonthCalendar(year, mi, bookedDates)}
    </div>
  `).join('');

  return `<div class="rs-yearly-grid">${monthsHTML}</div>`;
}
