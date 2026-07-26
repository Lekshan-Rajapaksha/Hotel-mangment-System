import { subscribeUtilityBills, deleteUtilityBill } from '../../services/utilityBillService.js';
import { formatCurrency, formatDate } from '../../utils/dateHelpers.js';
import { showToast, showSpinner, hideSpinner } from '../../utils/toast.js';

let unsubscribe = null;
let allUtilityBills = [];

export function renderUtilityBillsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💡 Utility Bills</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">Overview of all utility expenses</div>
      </div>
      <div class="flex gap-2 items-center" style="flex-wrap:wrap">
        <select class="form-control" id="utility-type-filter" style="width:150px">
          <option value="all">All Types</option>
          <option value="Light">Light</option>
          <option value="Water">Water</option>
          <option value="Internet">Internet</option>
          <option value="Gas">Gas</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Other">Other</option>
        </select>
        <input type="month" class="form-control" id="utility-month-filter" />
      </div>
    </div>
    
    <div class="page-body">
      <!-- Summary Strip -->
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px" id="utility-summary">
        <div class="stat-card">
          <div class="stat-icon blue">💰</div>
          <div><div class="stat-label">Total Expenses</div><div class="stat-value" id="us-total">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">⚡</div>
          <div><div class="stat-label">Light Bills</div><div class="stat-value" id="us-light">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">💧</div>
          <div><div class="stat-label">Water Bills</div><div class="stat-value" id="us-water">—</div></div>
        </div>
      </div>

      <div class="card desktop-only" style="padding:0; overflow:hidden">
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="utility-tbody">
              <tr><td colspan="5" style="text-align:center; padding:40px; color:var(--clr-text-muted)">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div id="utility-mobile-list" class="mobile-only">
        <div style="text-align:center; padding:40px; color:var(--clr-text-muted)">Loading...</div>
      </div>
    </div>
  `;

  // Bind filters
  ['utility-type-filter', 'utility-month-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeUtilityBills((bills) => {
    allUtilityBills = bills;
    applyFilters();
  });
}

function updateSummary(filtered) {
  const total = filtered.reduce((s, b) => s + (b.amount || 0), 0);
  const light = filtered.filter(b => b.type === 'Light').reduce((s, b) => s + (b.amount || 0), 0);
  const water = filtered.filter(b => b.type === 'Water').reduce((s, b) => s + (b.amount || 0), 0);

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('us-total', formatCurrency(total));
  el('us-light', formatCurrency(light));
  el('us-water', formatCurrency(water));
}

function applyFilters() {
  const typeFilter = document.getElementById('utility-type-filter')?.value || 'all';
  const monthFilter = document.getElementById('utility-month-filter')?.value; // YYYY-MM

  let filtered = allUtilityBills;

  if (typeFilter !== 'all') {
    filtered = filtered.filter(b => b.type === typeFilter);
  }

  if (monthFilter) {
    filtered = filtered.filter(b => {
      if (!b.date) return false;
      return b.date.startsWith(monthFilter);
    });
  }

  updateSummary(filtered);
  renderTable(filtered);
}

function renderTable(bills) {
  const tbody = document.getElementById('utility-tbody');
  const mobileList = document.getElementById('utility-mobile-list');
  if (!tbody || !mobileList) return;

  if (bills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--clr-text-muted)">No utility bills found</td></tr>';
    mobileList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--clr-text-muted)">No utility bills found</div>';
    return;
  }

  let tableHtml = '';
  let mobileHtml = '';

  bills.forEach((b) => {
    let typeEmoji = '🧾';
    if (b.type === 'Light') typeEmoji = '⚡';
    if (b.type === 'Water') typeEmoji = '💧';
    if (b.type === 'Internet') typeEmoji = '🌐';
    if (b.type === 'Gas') typeEmoji = '🔥';

    tableHtml += `
      <tr>
        <td data-label="Date">${formatDate(b.date)}</td>
        <td data-label="Type"><span style="font-weight:600">${typeEmoji} ${b.type}</span></td>
        <td data-label="Description">${b.description || '-'}</td>
        <td data-label="Amount" style="font-weight:700; color:var(--clr-primary)">${formatCurrency(b.amount)}</td>
        <td data-label="Actions">
          <button class="btn btn-sm btn-danger delete-ubill-btn" data-id="${b.id}">Delete</button>
        </td>
      </tr>
    `;

    mobileHtml += `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
          <div>
            <div style="font-weight:700">${typeEmoji} ${b.type}</div>
            <div style="font-size:0.8rem; color:var(--clr-text-muted)">${formatDate(b.date)}</div>
          </div>
          <div style="font-weight:800; font-size:1.1rem; color:var(--clr-primary)">
            ${formatCurrency(b.amount)}
          </div>
        </div>
        ${b.description ? `<div style="font-size:0.85rem; margin-bottom:12px; color:var(--clr-text)">${b.description}</div>` : ''}
        <div style="text-align:right">
          <button class="btn btn-sm btn-danger delete-ubill-btn" data-id="${b.id}">Delete</button>
        </div>
      </div>
    `;
  });

  tbody.innerHTML = tableHtml;
  mobileList.innerHTML = mobileHtml;

  document.querySelectorAll('.delete-ubill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Are you sure you want to delete this bill? This cannot be undone.')) return;
      showSpinner();
      try {
        await deleteUtilityBill(e.target.dataset.id);
        showToast('Utility bill deleted', 'info');
      } catch (err) {
        showToast('Failed to delete utility bill', 'error');
      } finally {
        hideSpinner();
      }
    });
  });
}

export function destroyUtilityBillsAdminPage() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
