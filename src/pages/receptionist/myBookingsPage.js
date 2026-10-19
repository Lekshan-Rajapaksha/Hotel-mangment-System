// src/pages/receptionist/myBookingsPage.js — All bookings list for receptionist
import { subscribeBookings } from '../../services/bookingService.js';
import { openBookingModal } from '../../components/bookingModal.js';
import { openPrintBill, openConsolidatedPrintBill, openEditGroupAdvanceModal } from '../../components/printBill.js';
import { formatDate, formatCurrency, nightCount, getBookingGuestCount } from '../../utils/dateHelpers.js';

let unsubscribe = null;
let allBookings = [];
const selectedBookingIds = new Set();

export function renderMyBookingsPage(container) {
  selectedBookingIds.clear();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 Bookings</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">All current & upcoming reservations</div>
      </div>
      <div class="flex gap-2">
        <div class="search-bar">
          <span>🔍</span>
          <input type="text" id="booking-search" placeholder="Search guest, room…" />
        </div>
        <button class="btn btn-accent" id="new-booking-btn2">➕ New</button>
      </div>
    </div>
    <div class="page-body">
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
      <div id="bookings-bulk-bar" style="display:none; position:sticky; bottom:16px; margin-top:14px; z-index:15; background:var(--clr-surface); border:1px solid var(--clr-primary); border-radius:10px; padding:10px 18px; box-shadow:0 8px 24px rgba(79,114,245,0.18); align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div style="font-size:0.88rem; font-weight:700; color:var(--clr-text)">
          🏨 <span id="bulk-selected-count" style="color:var(--clr-primary)">0</span> bookings selected
        </div>
        <div class="flex gap-2 items-center">
          <button class="btn btn-outline btn-sm" id="bulk-edit-advance-btn" style="display:inline-flex; align-items:center; gap:6px">
            💰 Edit Advance (Divide Equally)
          </button>
          <button class="btn btn-primary btn-sm" id="bulk-print-combined-btn" style="display:inline-flex; align-items:center; gap:6px">
            🖨️ Print Combined Bill
          </button>
          <button class="btn btn-ghost btn-sm" id="bulk-clear-btn">✕ Clear</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('new-booking-btn2')?.addEventListener('click', () => {
    openBookingModal({ allBookings, onSaved: () => {} });
  });

  document.getElementById('booking-search')?.addEventListener('input', (e) => {
    filterTable(e.target.value);
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
    renderTable(bookings);
  });
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
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:var(--clr-text-muted); padding:40px">No active bookings</td></tr>`;
    updateBulkBar();
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const nights = nightCount(b.checkIn, b.checkOut);
    const rem = b.remaining ?? (b.fullPrice - (b.advancePaid || 0));
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
            👥 ${guestCount}
          </span>
          ${b.additionalGuests?.length ? `<div style="font-size:0.72rem; color:var(--clr-text-muted); margin-top:2px" title="${b.additionalGuests.map(g => g.name).filter(Boolean).join(', ')}">+${b.additionalGuests.length} extra</div>` : ''}
        </td>
        <td data-label="Room">
          <div style="font-weight:700; color:var(--clr-primary)">Room ${b.roomNumber}</div>
          <div style="font-size:0.72rem; color:var(--clr-text-muted)">${b.acType}/${b.bedType}</div>
        </td>
        <td data-label="Check-In">${formatDate(b.checkIn, true)}</td>
        <td data-label="Check-Out">${formatDate(b.checkOut, true)}</td>
        <td data-label="Nights" style="font-weight:600">${nights}</td>
        <td data-label="Meal">
          <span class="badge badge-primary">${b.meals || 'None'}</span>
        </td>
        <td data-label="Type" style="font-size:0.8rem">${b.source || 'Direct'}</td>
        <td data-label="Full Price" style="font-weight:600">${formatCurrency(b.fullPrice)}</td>
        <td data-label="Remaining" style="font-weight:700; color:${remColor}">${formatCurrency(rem)}</td>
        <td data-label="Actions">
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${b.id}" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-sm print-btn" data-id="${b.id}" title="Print Bill">🖨️</button>
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
      const booking = bookings.find(b => b.id === btn.dataset.id);
      if (booking) openBookingModal({ booking, allBookings: bookings, onSaved: () => {} });
    });
  });

  document.querySelectorAll('.print-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const booking = bookings.find(b => b.id === btn.dataset.id);
      if (booking) openPrintBill(booking, bookings);
    });
  });

  updateBulkBar();
}

function filterTable(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#bookings-tbody tr[data-search]');
  rows.forEach(row => {
    const meta = row.dataset.search || '';
    row.style.display = meta.includes(q) ? '' : 'none';
  });
}
