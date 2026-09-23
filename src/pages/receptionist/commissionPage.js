// src/pages/receptionist/commissionPage.js — Commission management page with multi-booking selection
import {
  addCommission,
  markCommissionPaid,
  deleteCommission,
  subscribeCommissions
} from '../../services/commissionService.js';
import { subscribeBookings } from '../../services/bookingService.js';
import { showToast, showSpinner, hideSpinner } from '../../utils/toast.js';
import { formatCurrency, formatDate } from '../../utils/dateHelpers.js';

let unsubCommissions = null;
let unsubBookings = null;
let currentCommissions = [];
let availableBookings = [];
let currentFilter = 'all'; // 'all' | 'unpaid' | 'paid'
let searchQuery = '';
let selectedBookingNumbers = new Set(); // Multi-selection set

export function renderCommissionPage(container, options = {}) {
  const isAdmin = Boolean(options.isAdmin);
  const today = new Date().toISOString().split('T')[0];
  selectedBookingNumbers.clear();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💼 Commission</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">
          Manage booking commissions, driver/agent fees (single or multiple bookings), and operational expenses
        </div>
      </div>
    </div>

    <div class="page-body">
      <!-- 1. Summary Cards -->
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:24px">
        <div class="stat-card" style="border-left:4px solid var(--clr-primary)">
          <div class="stat-icon blue">💰</div>
          <div>
            <div class="stat-label">Total Commissions</div>
            <div class="stat-value" id="stat-comm-total" style="font-size:1.35rem">—</div>
            <div class="stat-sub" id="stat-comm-total-count" style="font-size:0.75rem; color:var(--clr-text-muted)">0 records</div>
          </div>
        </div>

        <div class="stat-card" style="border-left:4px solid var(--clr-accent)">
          <div class="stat-icon orange">⏳</div>
          <div>
            <div class="stat-label">Non-Paid (Pending)</div>
            <div class="stat-value" id="stat-comm-unpaid" style="font-size:1.35rem; color:var(--clr-accent)">—</div>
            <div class="stat-sub" id="stat-comm-unpaid-count" style="font-size:0.75rem; color:var(--clr-text-muted)">0 pending payout</div>
          </div>
        </div>

        <div class="stat-card" style="border-left:4px solid var(--clr-success)">
          <div class="stat-icon green">💸</div>
          <div>
            <div class="stat-label">Paid (System Expenses)</div>
            <div class="stat-value" id="stat-comm-paid" style="font-size:1.35rem; color:var(--clr-success)">—</div>
            <div class="stat-sub" id="stat-comm-paid-count" style="font-size:0.75rem; color:var(--clr-success)">Accounted in System Expenses</div>
          </div>
        </div>
      </div>

      <!-- 2. Add Commission Form Card -->
      <div class="card" style="margin-bottom:24px; padding:20px 24px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--clr-border); padding-bottom:10px">
          <div>
            <h2 style="font-size:1.05rem; font-weight:700; margin:0">➕ Add Commission</h2>
            <div style="font-size:0.78rem; color:var(--clr-text-muted); margin-top:2px">
              Select one or multiple bookings for this commission. Details are optional.
            </div>
          </div>
          <span class="badge badge-primary" style="font-size:0.75rem">Multi-Booking Support</span>
        </div>

        <form id="add-commission-form">
          
          <!-- Multi-Booking Picker Box -->
          <div style="margin-bottom:18px; padding:14px 16px; background:var(--clr-surface-2, rgba(255,255,255,0.02)); border:1px solid var(--clr-border); border-radius:10px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px">
              <div>
                <label class="form-label" style="margin-bottom:0; font-weight:700; font-size:0.85rem">
                  Select Booking(s) *
                </label>
                <div style="font-size:0.73rem; color:var(--clr-text-muted); margin-top:2px">
                  Click any booking chip below to select/unselect multiple bookings, or type numbers directly
                </div>
              </div>
              <div class="flex gap-1">
                <button type="button" class="btn btn-ghost btn-sm" id="btn-select-all-bookings" style="font-size:0.72rem; padding:4px 10px; height:auto">
                  Select All
                </button>
                <button type="button" class="btn btn-ghost btn-sm" id="btn-clear-bookings" style="font-size:0.72rem; padding:4px 10px; height:auto">
                  Clear
                </button>
              </div>
            </div>

            <!-- Booking Chips -->
            <div id="booking-chips-container" style="display:flex; flex-wrap:wrap; gap:8px; max-height:150px; overflow-y:auto; padding:4px 0; margin-bottom:12px">
              <span style="font-size:0.8rem; color:var(--clr-text-muted)">Loading active bookings…</span>
            </div>

            <!-- Booking Numbers Input & Selected Summary -->
            <div class="grid" style="grid-template-columns: 2fr 1fr; gap:14px; align-items:center">
              <div>
                <label class="form-label" for="comm-booking-number" style="font-size:0.75rem; color:var(--clr-text-muted); margin-bottom:4px">
                  Selected Booking Number(s) (Comma-separated)
                </label>
                <input
                  type="text"
                  class="form-control"
                  id="comm-booking-number"
                  placeholder="e.g. 01, 02, 05 (clicking above will auto-fill)"
                  required
                  style="font-weight:700; color:var(--clr-primary); font-size:0.9rem"
                />
              </div>
              <div id="comm-selected-guest-info" style="font-size:0.8rem; line-height:1.4; color:var(--clr-text-muted); padding-top:16px">
                No bookings selected
              </div>
            </div>
          </div>

          <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:16px">
            
            <!-- Commission Price -->
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" for="comm-amount">Commission Price (Rs.) *</label>
              <input type="number" class="form-control" id="comm-amount" placeholder="0.00" min="0" step="0.01" required />
            </div>

            <!-- Date -->
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" for="comm-date">Date *</label>
              <input type="date" class="form-control" id="comm-date" value="${today}" required />
            </div>

            <!-- Details (Optional / Not essential) -->
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" for="comm-details">
                Details / Recipient <span style="font-size:0.73rem; color:var(--clr-text-muted); font-weight:normal">(Optional)</span>
              </label>
              <input type="text" class="form-control" id="comm-details" placeholder="e.g. Tuk-tuk driver Kumara, Agent referral..." />
            </div>

            <!-- Status Choice -->
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" for="comm-status">Initial Status</label>
              <select class="form-control" id="comm-status">
                <option value="unpaid" selected>⏳ Non-Paid (Pending)</option>
                <option value="paid">✅ Paid (Expense)</option>
              </select>
            </div>

          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:14px; border-top:1px solid var(--clr-border)">
            <div style="font-size:0.75rem; color:var(--clr-text-muted)">
              💡 When marked as Paid, this commission is accounted as an expense in financial analytics.
            </div>
            <button type="submit" class="btn btn-primary" id="btn-submit-comm" style="display:flex; align-items:center; gap:6px">
              <span>➕ Save Commission</span>
            </button>
          </div>
        </form>
      </div>

      <!-- 3. Commission List / Table Card -->
      <div class="card" style="padding:0; overflow:hidden">
        <!-- Controls Bar -->
        <div style="padding:16px 20px; border-bottom:1px solid var(--clr-border); display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px">
          <div>
            <h2 style="font-size:1.05rem; font-weight:700; margin:0">📋 Commission Records</h2>
            <div style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:2px">
              Non-Paid items stay on top. When clicked <strong>"Paid"</strong>, items move down and count as system expenses.
            </div>
          </div>

          <div class="flex gap-2 items-center" style="flex-wrap:wrap">
            <div class="search-bar">
              <span>🔍</span>
              <input type="text" id="comm-search" placeholder="Search booking #, details, guest…" style="width:210px" />
            </div>

            <div class="flex gap-1" role="group" aria-label="Filter status">
              <button class="btn btn-sm btn-ghost filter-btn active" data-filter="all" id="comm-flt-all">All</button>
              <button class="btn btn-sm btn-ghost filter-btn" data-filter="unpaid" id="comm-flt-unpaid">⏳ Non-Paid</button>
              <button class="btn btn-sm btn-ghost filter-btn" data-filter="paid" id="comm-flt-paid">✅ Paid</button>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div style="overflow-x:auto">
          <table class="data-table" id="commissions-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Booking #(s)</th>
                <th>Commission Price</th>
                <th>Date</th>
                <th>Details</th>
                <th>System Expense</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="commissions-tbody">
              <tr><td colspan="7" style="text-align:center; padding:36px; color:var(--clr-text-muted)">Loading commissions…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Start real-time subscriptions
  startSubscriptions();
  bindFormEvents();
  bindFilterEvents();
}

function startSubscriptions() {
  destroyCommissionPage();

  // 1. Subscribe to active bookings
  unsubBookings = subscribeBookings((bookings) => {
    availableBookings = bookings || [];
    renderBookingChips();
    updateSelectedSummary();
  });

  // 2. Subscribe to commissions in real-time
  unsubCommissions = subscribeCommissions((commissions) => {
    currentCommissions = commissions || [];
    updateSummaryStats(currentCommissions);
    renderTable();
  });
}

function renderBookingChips() {
  const container = document.getElementById('booking-chips-container');
  if (!container) return;

  if (availableBookings.length === 0) {
    container.innerHTML = `<span style="font-size:0.8rem; color:var(--clr-text-muted)">No active bookings found</span>`;
    return;
  }

  container.innerHTML = availableBookings.map(b => {
    const bNum = String(b.bookingNumber || '');
    const isSelected = selectedBookingNumbers.has(bNum);
    return `
      <button
        type="button"
        class="booking-chip-btn ${isSelected ? 'active' : ''}"
        data-bnum="${escapeHtml(bNum)}"
        title="Click to toggle Booking #${bNum}"
        style="
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
          border: 1px solid ${isSelected ? 'var(--clr-primary)' : 'var(--clr-border)'};
          background: ${isSelected ? 'var(--clr-primary-dim, rgba(108,138,255,0.2))' : 'var(--clr-surface-alt, rgba(255,255,255,0.03))'};
          color: ${isSelected ? 'var(--clr-primary)' : 'var(--clr-text)'};
          font-weight: ${isSelected ? '700' : '500'};
        "
      >
        <span>${isSelected ? '✓' : '＋'}</span>
        <strong>#${bNum}</strong>
        <span style="font-size:0.75rem; opacity:0.85">${escapeHtml(b.guestName || 'Guest')} (Rm ${b.roomNumber})</span>
      </button>
    `;
  }).join('');

  // Bind chip click events
  container.querySelectorAll('.booking-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bNum = btn.dataset.bnum;
      if (!bNum) return;

      if (selectedBookingNumbers.has(bNum)) {
        selectedBookingNumbers.delete(bNum);
      } else {
        selectedBookingNumbers.add(bNum);
      }

      syncInputFromSelected();
      renderBookingChips();
      updateSelectedSummary();
    });
  });
}

function syncInputFromSelected() {
  const input = document.getElementById('comm-booking-number');
  if (!input) return;

  const sortedList = Array.from(selectedBookingNumbers).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  input.value = sortedList.join(', ');
}

function syncSelectedFromInput() {
  const input = document.getElementById('comm-booking-number');
  if (!input) return;

  const raw = input.value || '';
  const parts = raw.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);

  selectedBookingNumbers.clear();
  parts.forEach(p => selectedBookingNumbers.add(p));

  renderBookingChips();
  updateSelectedSummary();
}

function updateSelectedSummary() {
  const guestInfoEl = document.getElementById('comm-selected-guest-info');
  if (!guestInfoEl) return;

  const selectedList = Array.from(selectedBookingNumbers);
  if (selectedList.length === 0) {
    guestInfoEl.innerHTML = `<span style="color:var(--clr-text-muted)">No bookings selected</span>`;
    return;
  }

  const matched = availableBookings.filter(b => selectedList.includes(String(b.bookingNumber)));
  if (matched.length > 0) {
    const detailsStr = matched.map(b => `<strong>#${b.bookingNumber}</strong> (${escapeHtml(b.guestName)}, Rm ${b.roomNumber})`).join(' · ');
    guestInfoEl.innerHTML = `<span style="color:var(--clr-primary)">🔗 ${matched.length} Booking${matched.length > 1 ? 's' : ''} Selected:</span> ${detailsStr}`;
  } else {
    guestInfoEl.innerHTML = `<span style="color:var(--clr-primary)">🔗 ${selectedList.length} Booking${selectedList.length > 1 ? 's' : ''}:</span> ${selectedList.map(s => `#${escapeHtml(s)}`).join(', ')}`;
  }
}

function bindFormEvents() {
  const bookingNumberInput = document.getElementById('comm-booking-number');
  const form = document.getElementById('add-commission-form');

  // Input change syncs with chips
  bookingNumberInput?.addEventListener('input', () => {
    syncSelectedFromInput();
  });

  // Select All button
  document.getElementById('btn-select-all-bookings')?.addEventListener('click', () => {
    availableBookings.forEach(b => {
      if (b.bookingNumber) selectedBookingNumbers.add(String(b.bookingNumber));
    });
    syncInputFromSelected();
    renderBookingChips();
    updateSelectedSummary();
  });

  // Clear Selection button
  document.getElementById('btn-clear-bookings')?.addEventListener('click', () => {
    selectedBookingNumbers.clear();
    syncInputFromSelected();
    renderBookingChips();
    updateSelectedSummary();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawBookingNumber = bookingNumberInput.value.trim();
    const amount = parseFloat(document.getElementById('comm-amount')?.value || '0');
    const date = document.getElementById('comm-date')?.value;
    const details = document.getElementById('comm-details')?.value.trim();
    const status = document.getElementById('comm-status')?.value || 'unpaid';

    if (!rawBookingNumber) {
      showToast('Please select or enter at least one booking number', 'error');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid commission price', 'error');
      return;
    }
    if (!date) {
      showToast('Please select a date', 'error');
      return;
    }

    // Split multiple booking numbers
    const bookingNumbers = rawBookingNumber
      .split(',')
      .map(s => s.trim().replace(/^#/, ''))
      .filter(Boolean);

    // Find all matched bookings
    const matched = availableBookings.filter(b => bookingNumbers.includes(String(b.bookingNumber)));
    const bookingIds = matched.map(b => b.id);
    const guestNames = matched.map(b => b.guestName);
    const guestNameStr = guestNames.join(', ');
    const roomNumbers = [...new Set(matched.map(b => b.roomNumber))].join(', ');

    showSpinner();
    try {
      await addCommission({
        bookingNumber: bookingNumbers.join(', '),
        bookingNumbers,
        amount,
        date,
        details,
        status,
        bookingId: bookingIds[0] || '',
        bookingIds,
        guestName: guestNameStr,
        guestNames,
        roomNumber: roomNumbers
      });

      hideSpinner();
      showToast(
        status === 'paid'
          ? `Commission for ${bookingNumbers.length} booking${bookingNumbers.length > 1 ? 's' : ''} added & recorded as expense! 🎉`
          : `Commission for ${bookingNumbers.length} booking${bookingNumbers.length > 1 ? 's' : ''} added successfully! 📋`,
        'success'
      );

      // Reset form
      form.reset();
      selectedBookingNumbers.clear();
      document.getElementById('comm-date').value = new Date().toISOString().split('T')[0];
      renderBookingChips();
      updateSelectedSummary();
    } catch (err) {
      hideSpinner();
      console.error('Failed to add commission:', err);
      showToast('Error adding commission: ' + err.message, 'error');
    }
  });
}

function bindFilterEvents() {
  document.getElementById('comm-search')?.addEventListener('input', (e) => {
    searchQuery = (e.target.value || '').toLowerCase().trim();
    renderTable();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      renderTable();
    });
  });
}

function updateSummaryStats(commissions) {
  let totalAmount = 0;
  let unpaidAmount = 0;
  let paidAmount = 0;
  let unpaidCount = 0;
  let paidCount = 0;

  commissions.forEach(c => {
    const amt = Number(c.amount || 0);
    totalAmount += amt;
    if (c.status === 'paid') {
      paidAmount += amt;
      paidCount++;
    } else {
      unpaidAmount += amt;
      unpaidCount++;
    }
  });

  const elTotal = document.getElementById('stat-comm-total');
  const elTotalCount = document.getElementById('stat-comm-total-count');
  const elUnpaid = document.getElementById('stat-comm-unpaid');
  const elUnpaidCount = document.getElementById('stat-comm-unpaid-count');
  const elPaid = document.getElementById('stat-comm-paid');
  const elPaidCount = document.getElementById('stat-comm-paid-count');

  if (elTotal) elTotal.textContent = formatCurrency(totalAmount);
  if (elTotalCount) elTotalCount.textContent = `${commissions.length} commission record${commissions.length === 1 ? '' : 's'}`;

  if (elUnpaid) elUnpaid.textContent = formatCurrency(unpaidAmount);
  if (elUnpaidCount) elUnpaidCount.textContent = `${unpaidCount} non-paid payout${unpaidCount === 1 ? '' : 's'}`;

  if (elPaid) elPaid.textContent = formatCurrency(paidAmount);
  if (elPaidCount) elPaidCount.textContent = `${paidCount} paid · Accounted as Expense`;
}

function renderTable() {
  const tbody = document.getElementById('commissions-tbody');
  if (!tbody) return;

  // Filter list
  let filtered = currentCommissions.filter(c => {
    if (currentFilter === 'unpaid' && c.status === 'paid') return false;
    if (currentFilter === 'paid' && c.status !== 'paid') return false;

    if (searchQuery) {
      const bNumsStr = (c.bookingNumbers || []).join(' ') + ' ' + (c.bookingNumber || '');
      const matchNo = bNumsStr.toLowerCase().includes(searchQuery);
      const matchDetails = (c.details || '').toLowerCase().includes(searchQuery);
      const matchGuest = ((c.guestName || '') + ' ' + (c.guestNames || []).join(' ')).toLowerCase().includes(searchQuery);
      if (!matchNo && !matchDetails && !matchGuest) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:36px; color:var(--clr-text-muted)">
          No commission records found matching the current filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const isPaid = c.status === 'paid';
    const statusBadge = isPaid
      ? `<span class="badge badge-success" style="font-weight:700">✅ Paid</span>`
      : `<span class="badge badge-accent" style="font-weight:700">⏳ Non-Paid</span>`;

    const expenseTag = isPaid
      ? `<span style="font-size:0.75rem; color:var(--clr-success); font-weight:600">💸 System Expense</span>`
      : `<span style="font-size:0.75rem; color:var(--clr-text-muted)">Pending Payout</span>`;

    // Multi-booking badges
    const bNums = (c.bookingNumbers && c.bookingNumbers.length > 0)
      ? c.bookingNumbers
      : String(c.bookingNumber || '').split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);

    const bBadges = bNums.map(n => `<span class="badge badge-primary" style="font-weight:700; font-size:0.85rem">#${escapeHtml(n)}</span>`).join(' ');
    const countTag = bNums.length > 1
      ? `<span class="badge badge-accent" style="font-size:0.68rem; font-weight:700; padding:2px 6px">${bNums.length} Bookings</span>`
      : '';

    const guests = c.guestName || (c.guestNames ? c.guestNames.join(', ') : '');
    const guestLabel = guests
      ? `<div style="font-size:0.74rem; color:var(--clr-text-muted); margin-top:3px">${escapeHtml(guests)}${c.roomNumber ? ` (Room ${c.roomNumber})` : ''}</div>`
      : '';

    return `
      <tr data-id="${c.id}" class="${isPaid ? 'row-comm-paid' : 'row-comm-unpaid'}" style="${isPaid ? 'background:rgba(255,255,255,0.01)' : ''}">
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center">
            ${bBadges || '—'}
            ${countTag}
          </div>
          ${guestLabel}
        </td>
        <td style="font-weight:700; font-size:0.95rem; color:${isPaid ? 'var(--clr-text)' : 'var(--clr-accent)'}">
          ${formatCurrency(c.amount)}
        </td>
        <td>
          <div style="font-size:0.85rem">${formatDate(c.date, true)}</div>
          ${isPaid && c.paidAt ? `<div style="font-size:0.7rem; color:var(--clr-success)">Paid on ${formatDate(c.paidAt, true)}</div>` : ''}
        </td>
        <td>
          <div style="font-size:0.83rem; max-width:220px; word-break:break-word; color:${c.details ? 'var(--clr-text)' : 'var(--clr-text-muted)'}">
            ${escapeHtml(c.details) || '—'}
          </div>
        </td>
        <td>${expenseTag}</td>
        <td style="text-align:right">
          <div class="flex gap-1" style="justify-content:flex-end; align-items:center">
            ${
              !isPaid
                ? `<button class="btn btn-success btn-sm btn-mark-paid" data-id="${c.id}" title="Mark as Paid (Counts as System Expense)">
                    💳 Paid
                   </button>`
                : `<button class="btn btn-ghost btn-sm btn-revert-paid" data-id="${c.id}" title="Revert to Non-Paid" style="font-size:0.75rem; color:var(--clr-text-muted)">
                    ↩️ Unpay
                   </button>`
            }
            <button class="btn btn-ghost btn-sm btn-del-comm" data-id="${c.id}" title="Delete commission" style="color:var(--clr-danger)">
              🗑
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind actions
  bindTableActionButtons();
}

function bindTableActionButtons() {
  // Mark as Paid Button
  document.querySelectorAll('.btn-mark-paid').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!id) return;

      btn.disabled = true;
      btn.textContent = '⏳ Updating…';
      try {
        await markCommissionPaid(id, true);
        showToast('Commission marked as Paid and recorded as system expense! 🎉', 'success');
      } catch (err) {
        console.error('Failed to mark commission paid:', err);
        showToast('Failed to update commission: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '💳 Paid';
      }
    });
  });

  // Revert back to Unpaid Button
  document.querySelectorAll('.btn-revert-paid').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!id) return;

      if (!confirm('Revert this commission to Non-Paid status? It will no longer be considered an expense.')) {
        return;
      }

      btn.disabled = true;
      try {
        await markCommissionPaid(id, false);
        showToast('Commission marked as Non-Paid', 'info');
      } catch (err) {
        console.error('Failed to revert commission:', err);
        showToast('Error: ' + err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  // Delete Commission Button
  document.querySelectorAll('.btn-del-comm').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!id) return;

      if (!confirm('Are you sure you want to delete this commission record?')) {
        return;
      }

      showSpinner();
      try {
        await deleteCommission(id);
        hideSpinner();
        showToast('Commission deleted successfully', 'info');
      } catch (err) {
        hideSpinner();
        console.error('Failed to delete commission:', err);
        showToast('Failed to delete commission: ' + err.message, 'error');
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function destroyCommissionPage() {
  if (unsubCommissions && typeof unsubCommissions === 'function') {
    unsubCommissions();
    unsubCommissions = null;
  }
  if (unsubBookings && typeof unsubBookings === 'function') {
    unsubBookings();
    unsubBookings = null;
  }
  selectedBookingNumbers.clear();
}
