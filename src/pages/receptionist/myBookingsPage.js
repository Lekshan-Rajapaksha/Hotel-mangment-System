// src/pages/receptionist/myBookingsPage.js — All bookings list for receptionist
import { subscribeBookings } from '../../services/bookingService.js';
import { openBookingModal } from '../../components/bookingModal.js';
import { openPrintBill, openConsolidatedPrintBill, openEditGroupAdvanceModal } from '../../components/printBill.js';
import { formatDate, formatCurrency, nightCount, getBookingGuestCount, toDateStr } from '../../utils/dateHelpers.js';
import { icon } from '../../components/icons.js';

let unsubscribe = null;
let allBookings = [];
const selectedBookingIds = new Set();

function getBookingDateStr(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    return dateVal.slice(0, 10);
  }
  const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return toDateStr(d);
}

export function renderMyBookingsPage(container) {
  selectedBookingIds.clear();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('ticket', { size: 26 })} My Bookings</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">All current & upcoming reservations</div>
      </div>
      <div class="flex gap-2 items-center" style="flex-wrap:wrap">
        <div class="search-bar">
          <span style="display:inline-flex; align-items:center">${icon('search', { size: 16 })}</span>
          <input type="text" id="booking-search" placeholder="Search guest, room…" />
        </div>
        <!-- Date filter container -->
        <div class="flex gap-1 items-center" style="background:var(--clr-surface); border:1.5px solid var(--clr-border); border-radius:var(--radius); padding:2px 8px; flex-wrap:wrap">
          <span style="color:var(--clr-text-muted); display:inline-flex; align-items:center" title="Filter by Day">${icon('calendar', { size: 16 })}</span>
          <input type="date" id="booking-date-filter" style="border:none; background:transparent; padding:6px 6px; font-size:0.85rem; color:var(--clr-text); font-family:var(--font); outline:none; cursor:pointer" title="Select day to filter bookings" />
          <select id="booking-date-mode" style="border:none; border-left:1px solid var(--clr-border); background:transparent; padding:6px 8px; font-size:0.8rem; color:var(--clr-text); font-family:var(--font); outline:none; cursor:pointer" title="Date filter criteria">
            <option value="staying">Staying (Active)</option>
            <option value="checkIn">Check-In</option>
            <option value="checkOut">Check-Out</option>
          </select>
          <button class="btn btn-sm btn-ghost" id="booking-date-today-btn" type="button" style="padding:3px 8px; font-size:0.75rem; border:1px solid var(--clr-border); border-radius:4px" title="Filter by Today">Today</button>
          <button class="btn btn-sm btn-ghost" id="booking-date-clear-btn" type="button" style="padding:3px 6px; font-size:0.75rem; display:none; border:1px solid var(--clr-border); border-radius:4px" title="Clear Date Filter">✕</button>
        </div>
        <button class="btn btn-accent" id="new-booking-btn2">${icon('plus', { size: 16 })} New</button>
      </div>
    </div>
    <div class="page-body">
      <!-- Active Filter Status Indicator -->
      <div id="booking-filter-status" style="display:none; margin-bottom:12px; font-size:0.84rem; color:var(--clr-text); background:var(--clr-surface); border:1px solid var(--clr-border); border-radius:var(--radius-sm); padding:8px 14px; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px"></div>

      <div class="card" style="padding:0; overflow:hidden">
        <div style="overflow-x:auto">
          <table class="data-table" id="bookings-table">
            <thead>
              <tr>
                <th style="width:36px; text-align:center">
                  <input type="checkbox" id="th-select-all" title="Select all" style="cursor:pointer" />
                </th>
                <th>Booking #</th>
                <th>Guest</th>
                <th>Guests</th>
                <th>Room</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Nights</th>
                <th>Meal</th>
                <th>Type</th>
                <th>Full Price</th>
                <th>Remaining</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="bookings-tbody">
              <tr><td colspan="13" style="text-align:center; color:var(--clr-text-muted); padding:40px">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bulk Action Bar for Multi-Room / Event Printing -->
      <div id="bookings-bulk-bar" style="display:none; position:sticky; bottom:16px; margin-top:14px; z-index:15; background:var(--clr-surface); border:1px solid var(--clr-primary); border-radius:12px; padding:10px 18px; box-shadow:0 8px 24px rgba(79,114,245,0.18); align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div style="font-size:0.88rem; font-weight:700; color:var(--clr-text); display:inline-flex; align-items:center; gap:6px">
          ${icon('ticket', { size: 16 })} <span id="bulk-selected-count" style="color:var(--clr-primary)">0</span> bookings selected
        </div>
        <div class="flex gap-2 items-center">
          <button class="btn btn-ghost btn-sm" id="bulk-edit-advance-btn" style="display:inline-flex; align-items:center; gap:6px" title="Edit and distribute advance payments proportionally, sequentially, or equally">
            ${icon('dollar-sign', { size: 14 })} Edit Group Advance
          </button>
          <button class="btn btn-primary btn-sm" id="bulk-print-combined-btn" style="display:inline-flex; align-items:center; gap:6px">
            ${icon('receipt', { size: 14 })} Print Combined Bill
          </button>
          <button class="btn btn-ghost btn-sm" id="bulk-clear-btn">✕ Clear</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('new-booking-btn2')?.addEventListener('click', () => {
    openBookingModal({ allBookings, onSaved: () => {} });
  });

  document.getElementById('booking-search')?.addEventListener('input', applyFilters);

  ['booking-date-filter', 'booking-date-mode'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
    document.getElementById(id)?.addEventListener('input', applyFilters);
  });

  document.getElementById('booking-date-today-btn')?.addEventListener('click', () => {
    const dateInput = document.getElementById('booking-date-filter');
    if (dateInput) {
      dateInput.value = toDateStr(new Date());
      applyFilters();
    }
  });

  document.getElementById('booking-date-clear-btn')?.addEventListener('click', () => {
    const dateInput = document.getElementById('booking-date-filter');
    if (dateInput) {
      dateInput.value = '';
      applyFilters();
    }
  });

  document.getElementById('th-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll('.booking-row-cb');
    checkboxes.forEach(cb => {
      const row = cb.closest('tr');
      if (row && row.style.display !== 'none') {
        cb.checked = checked;
        if (checked) selectedBookingIds.add(cb.dataset.id);
        else selectedBookingIds.delete(cb.dataset.id);
      }
    });
    updateBulkBar();
  });

  document.getElementById('bulk-clear-btn')?.addEventListener('click', () => {
    selectedBookingIds.clear();
    const selectAll = document.getElementById('th-select-all');
    if (selectAll) selectAll.checked = false;
    document.querySelectorAll('.booking-row-cb').forEach(cb => cb.checked = false);
    updateBulkBar();
  });

  document.getElementById('bulk-edit-advance-btn')?.addEventListener('click', () => {
    const selected = allBookings.filter(b => selectedBookingIds.has(b.id));
    if (selected.length > 0) {
      openEditGroupAdvanceModal(selected);
    }
  });

  document.getElementById('bulk-print-combined-btn')?.addEventListener('click', () => {
    const selected = allBookings.filter(b => selectedBookingIds.has(b.id));
    if (selected.length > 0) {
      openConsolidatedPrintBill(selected);
    }
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeBookings((bookings) => {
    allBookings = bookings;
    applyFilters();
  });
}

function applyFilters() {
  const search = (document.getElementById('booking-search')?.value || '').toLowerCase().trim();
  const selectedDate = document.getElementById('booking-date-filter')?.value || '';
  const dateMode = document.getElementById('booking-date-mode')?.value || 'staying';

  let filtered = allBookings;

  if (selectedDate) {
    filtered = filtered.filter(b => {
      const ciStr = getBookingDateStr(b.checkIn);
      const coStr = getBookingDateStr(b.checkOut);
      if (!ciStr || !coStr) return false;

      if (dateMode === 'checkIn') {
        return ciStr === selectedDate;
      } else if (dateMode === 'checkOut') {
        return coStr === selectedDate;
      } else {
        // 'staying': guest is active in hotel on that day (between check-in and check-out)
        return ciStr <= selectedDate && coStr >= selectedDate;
      }
    });
  }

  if (search) {
    filtered = filtered.filter(b => {
      const guestCount = getBookingGuestCount(b);
      const extraGuestNames = (b.additionalGuests || []).map(g => g.name).filter(Boolean).join(' ');
      const searchMeta = `${b.bookingNumber||''} ${b.guestName||''} ${b.phone||''} room ${b.roomNumber||''} ${guestCount} guests ${extraGuestNames}`.toLowerCase();
      return searchMeta.includes(search);
    });
  }

  // Update clear button visibility
  const clearBtn = document.getElementById('booking-date-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = selectedDate ? 'inline-flex' : 'none';
  }

  // Update filter status bar
  const statusEl = document.getElementById('booking-filter-status');
  if (statusEl) {
    if (selectedDate) {
      statusEl.style.display = 'flex';
      const [y, m, d] = selectedDate.split('-');
      const dObj = new Date(Number(y), Number(m) - 1, Number(d));
      const formattedDate = formatDate(dObj, true);
      const modeLabel = dateMode === 'checkIn' ? 'Check-In' : (dateMode === 'checkOut' ? 'Check-Out' : 'Staying / Active');
      statusEl.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:6px">
          ${icon('calendar', { size: 15 })} Showing bookings for <strong>${formattedDate}</strong> (${modeLabel}) &nbsp;·&nbsp; <span class="badge badge-primary" style="font-size:0.75rem; padding:1px 6px">${filtered.length} found</span>
        </span>
        <button id="booking-filter-reset-link" type="button" class="btn btn-sm btn-ghost" style="padding:2px 8px; font-size:0.75rem; color:var(--clr-danger); border:1px solid rgba(239,68,68,0.25)">
          ✕ Clear Date Filter
        </button>
      `;
      document.getElementById('booking-filter-reset-link')?.addEventListener('click', () => {
        const dateInput = document.getElementById('booking-date-filter');
        if (dateInput) dateInput.value = '';
        applyFilters();
      });
    } else {
      statusEl.style.display = 'none';
    }
  }

  renderTable(filtered);
}

function updateBulkBar() {
  const bar = document.getElementById('bookings-bulk-bar');
  const countEl = document.getElementById('bulk-selected-count');
  const count = selectedBookingIds.size;
  if (countEl) countEl.textContent = count;
  if (bar) {
    bar.style.display = count > 0 ? 'flex' : 'none';
  }
}

function renderTable(bookings) {
  const tbody = document.getElementById('bookings-tbody');
  if (!tbody) return;

  if (!bookings.length) {
    const isFiltered = Boolean(document.getElementById('booking-date-filter')?.value || document.getElementById('booking-search')?.value);
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:var(--clr-text-muted); padding:40px">${isFiltered ? 'No bookings found matching selected filters' : 'No active bookings'}</td></tr>`;
    updateBulkBar();
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const nights = nightCount(b.checkIn, b.checkOut);
    const rem = Math.max(0, (Number(b.fullPrice) || 0) - (Number(b.discountAmount) || 0) - (Number(b.advancePaid) || 0));
    const remColor = rem <= 0 ? 'var(--clr-success)' : 'var(--clr-accent)';
    const guestCount = getBookingGuestCount(b);
    const extraGuestNames = (b.additionalGuests || []).map(g => g.name).filter(Boolean).join(' ');
    const searchMeta = `${b.bookingNumber||''} ${b.guestName||''} ${b.phone||''} room ${b.roomNumber||''} ${guestCount} guests ${extraGuestNames}`.toLowerCase();
    const isChecked = selectedBookingIds.has(b.id) ? 'checked' : '';

    return `
      <tr data-id="${b.id}" data-search="${searchMeta}">
        <td data-label="Select" style="text-align:center">
          <input type="checkbox" class="booking-row-cb" data-id="${b.id}" ${isChecked} style="cursor:pointer" />
        </td>
        <td data-label="Booking #">
          <span class="badge badge-primary" style="font-weight:700; font-size:0.82rem">#${b.bookingNumber || '—'}</span>
        </td>
        <td data-label="Guest">
          <div style="font-weight:600">${b.guestName}</div>
          <div style="font-size:0.75rem; color:var(--clr-text-muted)">${b.phone || '—'}</div>
        </td>
        <td data-label="Guests">
          <span class="badge badge-primary" style="font-weight:700; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px">
            ${icon('users', { size: 12 })} ${guestCount}
          </span>
          ${b.additionalGuests?.length ? `<div style="font-size:0.72rem; color:var(--clr-text-muted); margin-top:2px" title="${b.additionalGuests.map(g => g.name).filter(Boolean).join(', ')}">+${b.additionalGuests.length} extra</div>` : ''}
        </td>
        <td data-label="Room">
          <div style="font-weight:700; color:var(--clr-primary)">Room ${b.roomNumber}</div>
          <div style="font-size:0.72rem; color:var(--clr-text-muted)">${b.acType}/${b.bedType}</div>
        </td>
        <td data-label="Check-In">${formatDate(b.checkIn, true)}</td>
        <td data-label="Check-Out">${formatDate(b.checkOut, true)}</td>
        <td data-label="Nights" style="font-weight:600; text-align:center">${nights}</td>
        <td data-label="Meal">
          <span class="badge badge-primary">${b.meals || 'None'}</span>
        </td>
        <td data-label="Type" style="font-size:0.8rem">${b.source || 'Direct'}</td>
        <td data-label="Full Price" class="numeric" style="font-weight:600">${formatCurrency(b.fullPrice)}</td>
        <td data-label="Remaining" class="numeric" style="font-weight:700; color:${remColor}">${formatCurrency(rem)}</td>
        <td data-label="Actions">
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${b.id}" title="Edit Booking" style="display:inline-flex;align-items:center;gap:4px;padding:5px 8px;font-size:0.78rem">
              ${icon('user', { size: 13 })} Edit
            </button>
            <button class="btn btn-ghost btn-sm print-btn" data-id="${b.id}" title="Print Bill" style="display:inline-flex;align-items:center;gap:4px;padding:5px 8px;font-size:0.78rem">
              ${icon('receipt', { size: 13 })} Print
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind row checkboxes
  document.querySelectorAll('.booking-row-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedBookingIds.add(cb.dataset.id);
      else selectedBookingIds.delete(cb.dataset.id);
      updateBulkBar();
    });
  });

  // Bind action buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const booking = allBookings.find(b => b.id === btn.dataset.id);
      if (booking) openBookingModal({ booking, allBookings, onSaved: () => {} });
    });
  });

  document.querySelectorAll('.print-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const booking = allBookings.find(b => b.id === btn.dataset.id);
      if (booking) openPrintBill(booking, allBookings);
    });
  });

  updateBulkBar();
}

