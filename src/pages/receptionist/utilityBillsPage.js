import { addUtilityBill, subscribeUtilityBills, deleteUtilityBill } from '../../services/utilityBillService.js';
import { showToast, showSpinner, hideSpinner } from '../../utils/toast.js';
import { formatCurrency, formatDate } from '../../utils/dateHelpers.js';

let unsubscribe = null;
let currentBills = [];

export function renderUtilityBillsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🧾 Utility Bills</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">Manage light, water, internet, and other bills</div>
      </div>
    </div>
    
    <div class="page-body">
      <div class="grid" style="grid-template-columns: 1fr; gap:24px; max-width:800px; margin:0 auto">
        
        <div class="card">
          <h2 style="font-size:1.1rem; margin-bottom:16px; border-bottom:1px solid var(--clr-border); padding-bottom:10px">Add New Bill</h2>
          <form id="add-bill-form" class="grid" style="grid-template-columns: 1fr 1fr; gap:16px">
            <div class="form-group">
              <label>Bill Type</label>
              <select class="form-control" id="bill-type" required>
                <option value="Light">Light Bill</option>
                <option value="Water">Water Bill</option>
                <option value="Internet">Internet Bill</option>
                <option value="Gas">Gas Bill</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Amount (Rs.)</label>
              <input type="number" class="form-control" id="bill-amount" placeholder="0.00" min="0" step="0.01" required />
            </div>
            
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="form-control" id="bill-date" required />
            </div>
            
            <div class="form-group">
              <label>Description / Invoice No.</label>
              <input type="text" class="form-control" id="bill-desc" placeholder="Optional details..." />
            </div>
            
            <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end; margin-top:8px">
              <button type="submit" class="btn btn-primary">Add Bill</button>
            </div>
          </form>
        </div>
        
        <div class="card" style="padding:0; overflow:hidden">
          <div style="padding:16px; border-bottom:1px solid var(--clr-border)">
            <h2 style="font-size:1.1rem; margin:0">Recent Bills</h2>
          </div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="bills-tbody">
                <tr><td colspan="5" style="text-align:center; padding:20px">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `;

  // Set default date to today
  document.getElementById('bill-date').value = new Date().toISOString().split('T')[0];

  document.getElementById('add-bill-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showSpinner();
    try {
      const billData = {
        type: document.getElementById('bill-type').value,
        amount: parseFloat(document.getElementById('bill-amount').value),
        date: document.getElementById('bill-date').value,
        description: document.getElementById('bill-desc').value.trim()
      };
      
      await addUtilityBill(billData);
      showToast('Bill added successfully', 'success');
      e.target.reset();
      document.getElementById('bill-date').value = new Date().toISOString().split('T')[0];
    } catch (err) {
      console.error(err);
      showToast('Failed to add bill', 'error');
    } finally {
      hideSpinner();
    }
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeUtilityBills((bills) => {
    currentBills = bills;
    renderBillsTable();
  });
}

function renderBillsTable() {
  const tbody = document.getElementById('bills-tbody');
  if (!tbody) return;

  if (currentBills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--clr-text-muted)">No bills added yet</td></tr>';
    return;
  }

  // Only show the last 10 bills on receptionist view maybe? Or all of them
  const recentBills = currentBills.slice(0, 20);

  tbody.innerHTML = recentBills.map(bill => `
    <tr>
      <td style="font-weight:600">${bill.type}</td>
      <td style="color:var(--clr-primary); font-weight:700">${formatCurrency(bill.amount)}</td>
      <td>${formatDate(bill.date)}</td>
      <td>${bill.description || '-'}</td>
      <td>
        <button class="btn btn-sm btn-danger delete-bill-btn" data-id="${bill.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-bill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Are you sure you want to delete this bill?')) return;
      const id = e.target.dataset.id;
      showSpinner();
      try {
        await deleteUtilityBill(id);
        showToast('Bill deleted', 'info');
      } catch (err) {
        showToast('Failed to delete bill', 'error');
      } finally {
        hideSpinner();
      }
    });
  });
}

export function destroyUtilityBillsPage() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
