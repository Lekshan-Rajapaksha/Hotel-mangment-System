// src/pages/receptionist/myBookingsPage.js — All bookings list for receptionist
import { subscribeBookings } from '../../services/bookingService.js';
import { openBookingModal } from '../../components/bookingModal.js';
import { openPrintBill } from '../../components/printBill.js';
import { formatDate, formatCurrency, nightCount } from '../../utils/dateHelpers.js';

let unsubscribe = null;

export function renderMyBookingsPage(container) {
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
                <th>Booking #</th>
                <th>Guest</th>
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
              <tr><td colspan="11" style="text-align:center; color:var(--clr-text-muted); padding:40px">Loading…</td></tr>
            </tbody>
          </table>
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

  let allBookings = [];

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeBookings((bookings) => {
    allBookings = bookings;
    renderTable(bookings);
  });
}

function renderTable(bookings) {
  const tbody = document.getElementById('bookings-tbody');
  if (!tbody) return;

  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:var(--clr-text-muted); padding:40px">No active bookings</td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const nights = nightCount(b.checkIn, b.checkOut);
    const rem = b.remaining ?? (b.fullPrice - (b.advancePaid || 0));
    const remColor = rem <= 0 ? 'var(--clr-success)' : 'var(--clr-accent)';
    const searchMeta = `${b.bookingNumber||''} ${b.guestName||''} ${b.phone||''} room ${b.roomNumber||''}`.toLowerCase();

    return `
      <tr data-id="${b.id}" data-search="${searchMeta}">
        <td>
          <span class="badge badge-primary" style="font-weight:700; font-size:0.82rem">#${b.bookingNumber || '—'}</span>
        </td>
        <td>
          <div style="font-weight:600">${b.guestName}</div>
          <div style="font-size:0.75rem; color:var(--clr-text-muted)">${b.phone}</div>
        </td>
        <td>
          <div style="font-weight:700; color:var(--clr-primary)">Room ${b.roomNumber}</div>
          <div style="font-size:0.72rem; color:var(--clr-text-muted)">${b.acType}/${b.bedType}</div>
        </td>
        <td>${formatDate(b.checkIn, true)}</td>
        <td>${formatDate(b.checkOut, true)}</td>
        <td style="font-weight:600">${nights}</td>
        <td>
          <span class="badge badge-primary">${b.meals || 'None'}</span>
        </td>
        <td style="font-size:0.8rem">${b.source || 'Direct'}</td>
        <td style="font-weight:600">${formatCurrency(b.fullPrice)}</td>
        <td style="font-weight:700; color:${remColor}">${formatCurrency(rem)}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${b.id}" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-sm print-btn" data-id="${b.id}" title="Print Bill">🖨️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

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
      if (booking) openPrintBill(booking);
    });
  });
}

function filterTable(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#bookings-tbody tr[data-search]');
  rows.forEach(row => {
    const meta = row.dataset.search || '';
    row.style.display = meta.includes(q) ? '' : 'none';
  });
}
