// src/pages/admin/billsPage.js — All bills view for admin
import { subscribeAllBookings } from '../../services/bookingService.js';
import { formatDate, formatCurrency, nightCount } from '../../utils/dateHelpers.js';
import { deleteBooking } from '../../services/bookingService.js';
import { showToast, showSpinner, hideSpinner } from '../../utils/toast.js';

let unsubscribe = null;
let allBookings = [];

export function renderBillsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🧾 All Bills & Transactions</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">Complete billing history and payment records</div>
      </div>
      <div class="flex gap-2 items-center" style="flex-wrap:wrap">
        <div class="search-bar">
          <span>🔍</span>
          <input type="text" id="bills-search" placeholder="Search guest, room…" />
        </div>
        <select class="form-control" id="bills-status" style="width:130px">
          <option value="all">All Bookings</option>
          <option value="active">Active Only</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select class="form-control" id="bills-filter-room" style="width:120px">
          <option value="">All Rooms</option>
          ${[1,2,3,4,5,6,7].map(n => `<option value="${n}">Room ${n}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="page-body">

      <!-- Summary Strip -->
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px" id="bills-summary">
        <div class="stat-card">
          <div class="stat-icon blue">💰</div>
          <div><div class="stat-label">Total Revenue</div><div class="stat-value" id="bs-revenue">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">⏳</div>
          <div><div class="stat-label">Outstanding</div><div class="stat-value" id="bs-outstanding">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">✅</div>
          <div><div class="stat-label">Fully Paid</div><div class="stat-value" id="bs-paid">—</div></div>
        </div>
      </div>

      <div class="card desktop-only" style="padding:0; overflow:hidden">
        <div style="overflow-x:auto">
          <table class="data-table" id="bills-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Nights</th>
                <th>Source</th>
                <th>Full Price</th>
                <th>Advance</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="bills-tbody">
              <tr><td colspan="12" style="text-align:center; padding:40px; color:var(--clr-text-muted)">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div id="bills-mobile-list" class="mobile-only">
        <div style="text-align:center; padding:40px; color:var(--clr-text-muted)">Loading…</div>
      </div>

      <div id="bills-pagination" style="display:flex; justify-content:center; gap:8px; margin-top:20px; padding:4px"></div>
    </div>
  `;

  // Bind filters
  ['bills-search','bills-status','bills-filter-room'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyFilters);
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeAllBookings((bookings) => {
    allBookings = bookings;
    applyFilters();
    updateSummary(bookings.filter(b => b.status === 'active'));
  });
}

function updateSummary(active) {
  const totalRev = active.reduce((s,b) => s + (b.fullPrice||0), 0);
  const totalRem = active.reduce((s,b) => s + (b.remaining ?? Math.max(0, (b.fullPrice||0)-(b.advancePaid||0))), 0);
  const fullyPaid = active.filter(b => (b.remaining ?? 1) <= 0).length;

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('bs-revenue', formatCurrency(totalRev));
  el('bs-outstanding', formatCurrency(totalRem));
  el('bs-paid', `${fullyPaid} bookings`);
}

function applyFilters() {
  const search = (document.getElementById('bills-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('bills-status')?.value || 'all';
  const roomFilter = document.getElementById('bills-filter-room')?.value || '';

  let filtered = allBookings;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(b => b.status === statusFilter);
  }
  if (roomFilter) {
    filtered = filtered.filter(b => String(b.roomNumber) === roomFilter);
  }
  if (search) {
    filtered = filtered.filter(b =>
      (b.guestName||'').toLowerCase().includes(search) ||
      (b.phone||'').includes(search) ||
      String(b.roomNumber).includes(search)
    );
  }

  renderTable(filtered);
}

function renderTable(bookings) {
  const tbody = document.getElementById('bills-tbody');
  const mobileList = document.getElementById('bills-mobile-list');
  if (!tbody || !mobileList) return;

  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:40px; color:var(--clr-text-muted)">No records found</td></tr>`;
    mobileList.innerHTML = `<div style="text-align:center; padding:40px; color:var(--clr-text-muted)">No records found</div>`;
    return;
  }

  let tableHtml = '';
  let mobileHtml = '';

  bookings.forEach((b, i) => {
    const nights = nightCount(b.checkIn, b.checkOut);
    const rem = b.remaining ?? ((b.fullPrice||0) - (b.advancePaid||0));
    const billNo = `BCH-${String(b.id || i).slice(-6).toUpperCase()}`;
    const isCancelled = b.status === 'cancelled';

    const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
    const co = b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut);
    const now = new Date();
    const isPast = co < now;
    const isCurrent = ci <= now && co >= now;

    let statusLabel, statusColor;
    if (isCancelled) { statusLabel = '❌ Cancelled'; statusColor = 'var(--clr-danger)'; }
    else if (isPast)  { statusLabel = '✅ Completed'; statusColor = 'var(--clr-text-muted)'; }
    else if (isCurrent) { statusLabel = '🟢 Active'; statusColor = 'var(--clr-success)'; }
    else              { statusLabel = '🔵 Upcoming'; statusColor = 'var(--clr-primary)'; }

    tableHtml += `
      <tr data-id="${b.id}" style="${isCancelled ? 'opacity:0.5' : ''}">
        <td data-label="Bill #" style="font-family:monospace; font-size:0.8rem; color:var(--clr-text-muted)">${billNo}</td>
        <td data-label="Guest">
          <div style="text-align:right">
            <div style="font-weight:600">${b.guestName}</div>
            <div style="font-size:0.75rem; color:var(--clr-text-muted)">${b.phone}</div>
          </div>
        </td>
        <td data-label="Room"><span style="font-weight:700; color:var(--clr-primary)">Room ${b.roomNumber}</span></td>
        <td data-label="Check-In">${formatDate(b.checkIn, true)}</td>
        <td data-label="Check-Out">${formatDate(b.checkOut, true)}</td>
        <td data-label="Nights" style="font-weight:600">${nights}</td>
        <td data-label="Source"><span class="badge badge-primary">${b.source||'Direct'}</span></td>
        <td data-label="Full Price" style="font-weight:600">${formatCurrency(b.fullPrice)}</td>
        <td data-label="Advance" style="color:var(--clr-success); font-weight:600">${formatCurrency(b.advancePaid||0)}</td>
        <td data-label="Remaining" style="font-weight:700; color:${rem<=0?'var(--clr-success)':'var(--clr-accent)'}">  ${formatCurrency(Math.max(0,rem))}</td>
        <td data-label="Status" style="color:${statusColor}; font-weight:600; font-size:0.8rem; white-space:nowrap">${statusLabel}</td>
        <td data-label="Actions">
          <div class="flex gap-1" style="justify-content:flex-end">
            ${!isCancelled ? `<button class="btn btn-danger btn-sm delete-bill-btn" data-id="${b.id}" title="Delete">🗑</button>` : ''}
          </div>
        </td>
      </tr>
    `;

    mobileHtml += `
      <details class="expandable-widget" style="${isCancelled ? 'opacity:0.5' : ''}">
        <summary>
          <div>
            <div style="font-weight:700; font-size:1rem; color:var(--clr-text)">${b.guestName}</div>
            <div style="font-size:0.75rem; color:var(--clr-text-muted)">Room ${b.roomNumber} · ${billNo}</div>
          </div>
          <div style="text-align:right">
            <div style="color:${statusColor}; font-weight:700; font-size:0.75rem">${statusLabel}</div>
            <div style="font-weight:800; font-size:0.9rem">${formatCurrency(Math.max(0,rem))}</div>
          </div>
        </summary>
        <div class="expandable-widget-content">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; font-size:0.85rem">
            <div><div style="color:var(--clr-text-muted); font-size:0.7rem; text-transform:uppercase; font-weight:700">Check-In</div><div style="font-weight:600">${formatDate(b.checkIn, true)}</div></div>
            <div><div style="color:var(--clr-text-muted); font-size:0.7rem; text-transform:uppercase; font-weight:700">Check-Out</div><div style="font-weight:600">${formatDate(b.checkOut, true)}</div></div>
            <div><div style="color:var(--clr-text-muted); font-size:0.7rem; text-transform:uppercase; font-weight:700">Nights</div><div style="font-weight:600">${nights}</div></div>
            <div><div style="color:var(--clr-text-muted); font-size:0.7rem; text-transform:uppercase; font-weight:700">Source</div><div><span class="badge badge-primary">${b.source||'Direct'}</span></div></div>
            <div><div style="color:var(--clr-text-muted); font-size:0.7rem; text-transform:uppercase; font-weight:700">Full Price</div><div style="font-weight:600">${formatCurrency(b.fullPrice)}</div></div>
            <div><div style="color:var(--clr-text-muted); font-size:0.7rem; text-transform:uppercase; font-weight:700">Advance</div><div style="font-weight:600; color:var(--clr-success)">${formatCurrency(b.advancePaid||0)}</div></div>
          </div>
          <div class="flex gap-2" style="justify-content:flex-end; border-top:1px solid var(--clr-border); padding-top:12px">
            ${!isCancelled ? `<button class="btn btn-danger btn-sm delete-bill-btn" data-id="${b.id}" title="Delete">🗑 Delete Bill</button>` : ''}
          </div>
        </div>
      </details>
    `;
  });

  tbody.innerHTML = tableHtml;
  mobileList.innerHTML = mobileHtml;


  // Bind delete
  document.querySelectorAll('.delete-bill-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const booking = allBookings.find(b => b.id === btn.dataset.id);
      if (!booking) return;
      if (!confirm(`Delete booking for "${booking.guestName}"? This is permanent.`)) return;
      showSpinner();
      try {
        await deleteBooking(booking.id);
        showToast('Booking deleted', 'info');
        hideSpinner();
      } catch (err) {
        hideSpinner();
        showToast('Failed: ' + err.message, 'error');
      }
    });
  });
}
