import { 
  subscribeEmployees, 
  addEmployee, 
  updateEmployee,
  addAttendance, 
  paySalary,
  subscribeAllAttendance,
  subscribeAllSalaryPayments,
  calculateSalaryBreakdown
} from '../../services/employeeService.js';
import { openPrintSalaryBill } from '../../components/printSalaryBill.js';
import { showToast } from '../../utils/toast.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let unsubEmployees = null;
let unsubAllAttendance = null;
let unsubAllSalaries = null;
let currentEmployees = [];
let todaysAttendance = {};
let allAttendanceList = [];
let allSalaries = [];

// State for active employee in full-page Pay Salary view
let activePayEmployee = null;
let activePayMonth = String(new Date().getMonth() + 1).padStart(2, '0');
let activePayYear = String(new Date().getFullYear());

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function renderEmployeePage(container) {
  container.innerHTML = `
    <!-- Grid View: Employees List -->
    <div id="reception-emp-grid-view">
      <div class="page-header">
        <h2 class="page-title">Employees Management</h2>
        <button class="btn btn-primary" id="btn-toggle-add">+ Add Employee</button>
      </div>

      <!-- Add Employee Inline Form -->
      <div class="card" id="inline-add-employee" style="display: none; margin-bottom: 2rem;">
        <h3 style="margin-top:0;">Add New Employee</h3>
        <form id="add-employee-form" class="form-group add-employee-grid">
          <div>
            <label class="form-label">Name</label>
            <input type="text" id="emp-name" class="form-input" required />
          </div>
          <div>
            <label class="form-label">Phone Number</label>
            <input type="text" id="emp-phone" class="form-input" required />
          </div>
          <div>
            <label class="form-label">Job Role</label>
            <input type="text" id="emp-role" class="form-input" required placeholder="e.g. Cleaner, Manager" />
          </div>
          <div>
            <label class="form-label">Employee ID / NIC Number</label>
            <input type="text" id="emp-id-number" class="form-input" placeholder="e.g. 199512345678 or EMP-001" />
          </div>
          <div>
            <label class="form-label">Monthly Basic Salary (Rs)</label>
            <input type="number" id="emp-basic" class="form-input" required min="0" />
          </div>
          <div>
            <label class="form-label">Address</label>
            <input type="text" id="emp-address" class="form-input" placeholder="e.g. No. 12, Beach Road, Dikwella" />
          </div>

          <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end; gap:0.5rem; margin-top: 0.5rem;">
            <button type="button" class="btn btn-ghost" id="cancel-add-employee">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Employee</button>
          </div>
        </form>
      </div>

      <div class="employee-grid" id="employee-list-body">
        <div style="text-align:center; grid-column: 1 / -1;">Loading employees...</div>
      </div>
    </div>

    <!-- Full-Page Pay Salary View -->
    <div id="reception-emp-pay-view" style="display: none;">
      <button class="btn btn-ghost" id="btn-pay-back-to-grid" style="margin-bottom: 1.25rem;">← Back to Employees</button>
      <div id="reception-pay-content-area"></div>
    </div>
  `;

  bindEvents();
  loadData();
}

function bindEvents() {
  const addFormContainer = document.getElementById('inline-add-employee');
  document.getElementById('btn-toggle-add').onclick = () => { addFormContainer.style.display = 'block'; };
  document.getElementById('cancel-add-employee').onclick = () => { addFormContainer.style.display = 'none'; };

  // Back to Grid from Pay Salary View
  document.getElementById('btn-pay-back-to-grid')?.addEventListener('click', () => {
    document.getElementById('reception-emp-pay-view').style.display = 'none';
    document.getElementById('reception-emp-grid-view').style.display = 'block';
    activePayEmployee = null;
  });

  document.getElementById('add-employee-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('emp-name').value.trim();
    const phone = document.getElementById('emp-phone').value.trim();
    const role = document.getElementById('emp-role').value.trim();
    const idNumber = document.getElementById('emp-id-number').value.trim();
    const address = document.getElementById('emp-address').value.trim();
    const basicSalary = Number(document.getElementById('emp-basic').value);

    try {
      await addEmployee({ name, phone, role, basicSalary, idNumber, address });
      showToast('Employee added successfully', 'success');
      addFormContainer.style.display = 'none';
      e.target.reset();
    } catch (err) {
      showToast('Error adding employee', 'error');
    }
  };

  // Event delegation on employee grid
  document.getElementById('employee-list-body').addEventListener('click', async (e) => {
    // Edit employee button on card
    const editCardBtn = e.target.closest('.btn-card-edit-emp');
    if (editCardBtn) {
      e.stopPropagation();
      const id = editCardBtn.dataset.id;
      const emp = currentEmployees.find(emp => emp.id === id);
      if (emp) {
        openEmployeeEditModal(emp);
      }
      return;
    }

    // 1. Open Full-Page Pay Salary View (clickable anywhere on button or text/icon)
    const payBtn = e.target.closest('.btn-open-pay-page');
    if (payBtn) {
      const id = payBtn.dataset.id;
      const emp = currentEmployees.find(emp => emp.id === id);
      if (emp) {
        openPaySalaryPage(emp);
      }
      return;
    }

    // 2. 1-Click Attendance Handlers (strictly today in receptionist section)
    const attBtn = e.target.closest('.btn-att-full, .btn-att-half, .btn-att-absent');
    if (attBtn) {
      const id = attBtn.dataset.id;
      const emp = currentEmployees.find(emp => emp.id === id);
      if (!emp) return;

      const date = new Date().toISOString().split('T')[0];
      let status = 'Full Day';
      if (attBtn.classList.contains('btn-att-half')) status = 'Half Day';
      if (attBtn.classList.contains('btn-att-absent')) status = 'Absent';

      try {
        await addAttendance(id, date, status);
        showToast(`${status} marked for ${emp.name} today`, 'success');
      } catch (err) {
        showToast('Error recording attendance', 'error');
      }
      return;
    }
  });

  // Full-Page Pay Salary Listeners (month/year change, service charge change, submit)
  const payContentArea = document.getElementById('reception-pay-content-area');

  payContentArea?.addEventListener('input', (e) => {
    if (e.target.id === 'sal-page-month' || 
        e.target.id === 'sal-page-year' || 
        e.target.id === 'sal-page-input-sc') {
      
      if (e.target.id === 'sal-page-month') activePayMonth = e.target.value;
      if (e.target.id === 'sal-page-year') activePayYear = e.target.value;

      const payNowInput = document.getElementById('sal-page-input-pay');
      if (payNowInput && e.target.id !== 'sal-page-input-sc') {
        payNowInput.dataset.userEdited = 'false';
      }

      updatePayPageCalculations();
    } else if (e.target.id === 'sal-page-input-pay') {
      e.target.dataset.userEdited = 'true';
    }
  });

  payContentArea?.addEventListener('submit', async (e) => {
    if (e.target.id === 'reception-salary-payment-form' && activePayEmployee) {
      e.preventDefault();
      const emp = activePayEmployee;
      const basic = Number(emp.basicSalary || 0);
      const month = document.getElementById('sal-page-month').value;
      const year = String(document.getElementById('sal-page-year').value);
      const sc = Number(document.getElementById('sal-page-input-sc')?.value) || 0;
      const payNow = Number(document.getElementById('sal-page-input-pay')?.value);

      if (payNow <= 0) {
        showToast('Please enter a valid amount to pay', 'warning');
        return;
      }

      // Calculate attendance breakdown for this month
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const empAtt = allAttendanceList.filter(a => a.employeeId === emp.id && a.date && a.date.startsWith(monthPrefix));
      const fullDays = empAtt.filter(a => a.status === 'Full Day').length;
      const halfDays = empAtt.filter(a => a.status === 'Half Day').length;

      const alreadyPaid = allSalaries
        .filter(p => p.employeeId === emp.id && String(p.month).padStart(2, '0') === String(month).padStart(2, '0') && String(p.year) === year)
        .reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);

      const breakdown = calculateSalaryBreakdown({
        basic,
        fullDays,
        halfDays,
        serviceCharge: sc,
        alreadyPaid
      });

      const isMidMonth = alreadyPaid > 0 || (payNow < breakdown.totalOwed && breakdown.totalOwed > 0);
      const paymentType = isMidMonth ? 'Mid-Month / Advance Payment' : 'Salary Settlement';
      const remainingAfter = Math.max(0, breakdown.totalOwed - (alreadyPaid + payNow));

      const paymentRecord = {
        month,
        year,
        basic,
        dailyRate: breakdown.dailyRate,
        fullDays: breakdown.fullDays,
        halfDays: breakdown.halfDays,
        effectiveDays: breakdown.effectiveDays,
        earnedBasic: breakdown.earnedBasic,
        serviceCharge: sc,
        totalOwed: breakdown.totalOwed,
        alreadyPaid,
        totalPaid: payNow,
        remainingBalance: remainingAfter,
        paymentType,
        date: new Date().toISOString()
      };

      try {
        const payId = await paySalary(emp.id, paymentRecord);
        showToast('Salary payment recorded! Generating bill...', 'success');

        // Reset manual edit flag
        const payNowInput = document.getElementById('sal-page-input-pay');
        if (payNowInput) payNowInput.dataset.userEdited = 'false';

        // Re-render calculations & history
        updatePayPageCalculations();
        renderPayPageHistory();

        // Automatically open the printable salary bill
        openPrintSalaryBill({ id: payId, ...paymentRecord }, emp);
      } catch (err) {
        showToast('Error recording salary payment', 'error');
      }
    }
  });

  // Reprint Bill button from History & Edit employee button in Pay Salary View
  payContentArea?.addEventListener('click', (e) => {
    const editPayBtn = e.target.closest('.btn-edit-pay-emp');
    if (editPayBtn && activePayEmployee) {
      openEmployeeEditModal(activePayEmployee);
      return;
    }

    const printBtn = e.target.closest('.btn-reprint-sal-bill');
    if (printBtn && activePayEmployee) {
      const payId = printBtn.dataset.id;
      const paymentRecord = allSalaries.find(p => p.id === payId);
      if (paymentRecord) {
        openPrintSalaryBill(paymentRecord, activePayEmployee);
      }
    }
  });
}

function openPaySalaryPage(emp) {
  activePayEmployee = emp;
  activePayMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  activePayYear = String(new Date().getFullYear());

  document.getElementById('reception-emp-grid-view').style.display = 'none';
  document.getElementById('reception-emp-pay-view').style.display = 'block';

  const contentArea = document.getElementById('reception-pay-content-area');
  const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const basic = Number(emp.basicSalary || 0);
  const dailyRate = Math.round((basic / 26) * 100) / 100;

  const currentMonth = activePayMonth;
  const currentYear = activePayYear;

  const monthOptions = `
    <option value="01">January</option><option value="02">February</option><option value="03">March</option>
    <option value="04">April</option><option value="05">May</option><option value="06">June</option>
    <option value="07">July</option><option value="08">August</option><option value="09">September</option>
    <option value="10">October</option><option value="11">November</option><option value="12">December</option>
  `.replace(`value="${currentMonth}"`, `value="${currentMonth}" selected`);

  contentArea.innerHTML = `
    <!-- Header: Employee Details -->
    <div class="profile-header-section" style="display: flex; flex-wrap: wrap; gap: 1.25rem; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: var(--clr-surface); padding: 1.25rem 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--clr-border);">
      <div style="display: flex; gap: 1.25rem; align-items: center;">
        <div class="profile-avatar">${initials}</div>
        <div class="profile-title">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <h2 style="margin: 0; font-size: 1.4rem;">${escapeHtml(emp.name)}</h2>
            <span class="badge-blue" style="padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">${escapeHtml(emp.role || 'Employee')}</span>
            ${emp.idNumber ? `<span class="badge-gray" style="padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">🪪 ID: ${escapeHtml(emp.idNumber)}</span>` : ''}
          </div>
          <p style="margin: 0.35rem 0 0 0; color: var(--clr-text-muted); font-size: 0.9rem;">
            📞 ${escapeHtml(emp.phone || 'N/A')} ${emp.address ? `&nbsp;|&nbsp; 🏠 ${escapeHtml(emp.address)}` : ''} &nbsp;|&nbsp; 💰 Monthly Basic: <strong>Rs ${basic.toLocaleString()}</strong> &nbsp;|&nbsp;
            <span style="color: var(--clr-primary); font-weight: 700; background: rgba(37, 99, 235, 0.08); padding: 0.2rem 0.5rem; border-radius: 4px;">
              Daily Rate (Basic ÷ 26): Rs ${dailyRate.toFixed(2)}/day
            </span>
          </p>
        </div>
      </div>
      <div>
        <button type="button" class="btn btn-sm btn-primary btn-edit-pay-emp" data-id="${emp.id}" style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600;">
          ✏️ Edit Details
        </button>
      </div>
    </div>

    <!-- 2-Column Responsive Workspace -->
    <div class="salary-page-layout">
      
      <!-- Left Column: Payroll Period & Attendance Breakdown -->
      <div class="card" style="padding: 1.25rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>📅</span> Select Payroll Period &amp; Attendance
        </h3>

        <!-- Period Selectors -->
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="flex: 2;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 600;">Payroll Month</label>
            <select class="form-input" id="sal-page-month" style="font-weight: 600; padding: 0.45rem;">
              ${monthOptions}
            </select>
          </div>
          <div style="flex: 1;">
            <label class="form-label" style="font-size: 0.75rem; font-weight: 600;">Year</label>
            <input type="number" class="form-input" id="sal-page-year" value="${currentYear}" style="font-weight: 600; padding: 0.45rem;">
          </div>
        </div>

        <!-- Attendance Stats Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 8px; padding: 0.85rem; text-align: center;">
            <div style="font-size: 0.75rem; color: #15803d; font-weight: 700; text-transform: uppercase;">Full Days (1.0x)</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #16a34a; margin: 0.2rem 0;" id="sal-page-full-days">0</div>
            <div style="font-size: 0.75rem; color: #15803d; font-weight: 600;" id="sal-page-full-val">Rs 0</div>
          </div>
          <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.25); border-radius: 8px; padding: 0.85rem; text-align: center;">
            <div style="font-size: 0.75rem; color: #a16207; font-weight: 700; text-transform: uppercase;">Half Days (0.5x)</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #ca8a04; margin: 0.2rem 0;" id="sal-page-half-days">0</div>
            <div style="font-size: 0.75rem; color: #a16207; font-weight: 600;" id="sal-page-half-val">Rs 0</div>
          </div>
        </div>

        <!-- Total Payable Days Banner -->
        <div style="background: var(--clr-surface-alt, #f8fafc); border: 1px solid var(--clr-border); border-radius: 8px; padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <div style="font-size: 0.76rem; color: var(--clr-text-muted);">Total Payable Work Days:</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--clr-primary);" id="sal-page-effective-days">0 Days</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.76rem; color: var(--clr-text-muted);">Day Rate Applied:</div>
            <div style="font-size: 0.95rem; font-weight: 700;">Rs ${dailyRate.toFixed(2)}/day</div>
          </div>
        </div>

        <!-- Attendance Logs in this month -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <h4 style="margin: 0; font-size: 0.85rem; color: var(--clr-text-muted);">Recorded Days in Month:</h4>
          <span id="sal-page-total-rec-days" style="font-size: 0.75rem; font-weight: 600; color: var(--clr-text-muted);">0 records</span>
        </div>
        <div id="sal-page-att-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--clr-border); border-radius: 6px; padding: 0.5rem; background: var(--clr-surface);">
          <div style="text-align: center; color: var(--clr-text-muted); font-size: 0.8rem; padding: 1rem;">Loading records...</div>
        </div>
      </div>

      <!-- Right Column: Salary Computation & Payment Console -->
      <div class="card" style="padding: 1.25rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>💵</span> Salary Payout Console
        </h3>

        <!-- Financial Breakdown Card -->
        <div style="background: var(--clr-surface-alt, #f8fafc); border: 1px solid var(--clr-border); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid var(--clr-border); font-size: 0.85rem;">
            <span style="color: var(--clr-text-muted);">Monthly Basic Salary:</span>
            <strong>Rs ${basic.toLocaleString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid var(--clr-border); font-size: 0.85rem;">
            <span style="color: var(--clr-text-muted);">Earned Pay (<span id="sal-page-earned-days-sub">0d</span> × Rs ${dailyRate.toFixed(2)}):</span>
            <strong id="sal-page-earned-pay">Rs 0</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid var(--clr-border); font-size: 0.85rem;">
            <span style="color: var(--clr-text-muted);">Service Charge / Allowance:</span>
            <strong id="sal-page-sc-display">+ Rs 0</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 2px solid var(--clr-border); font-size: 0.95rem; font-weight: 700;">
            <span>Total Gross Payable:</span>
            <span id="sal-page-gross-pay" style="color: var(--clr-text);">Rs 0</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.45rem 0; border-bottom: 1px solid var(--clr-border); font-size: 0.88rem; color: #dc2626;">
            <span>Previously Paid (This Month):</span>
            <strong id="sal-page-previously-paid">- Rs 0</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.65rem 0; font-size: 1.25rem; font-weight: 800; color: var(--clr-primary);">
            <span>Remaining Balance Due:</span>
            <span id="sal-page-remaining-due">Rs 0</span>
          </div>
        </div>

        <!-- Payment Form -->
        <form id="reception-salary-payment-form">
          <div style="margin-bottom: 1rem;">
            <label class="form-label" style="font-size: 0.8rem; font-weight: 600;">
              Service Charge / Allowance (Rs)
            </label>
            <input type="number" id="sal-page-input-sc" class="form-input" min="0" value="0" style="padding: 0.45rem; font-size: 0.95rem;">
          </div>

          <div style="margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label class="form-label" style="font-size: 0.85rem; font-weight: 700; color: var(--clr-primary); margin: 0;">
                Amount to Pay Now (Rs)
              </label>
              <span class="badge-blue" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">Mid-Month &amp; Partial Pay Supported</span>
            </div>
            <input type="number" id="sal-page-input-pay" class="form-input" required min="1" value="0" style="padding: 0.6rem 0.75rem; font-size: 1.2rem; font-weight: 800; border: 2px solid var(--clr-primary); background: rgba(37, 99, 235, 0.03);">
            <small style="color: var(--clr-text-muted); font-size: 0.76rem; display: block; margin-top: 0.3rem;">
              💡 Enter any custom amount to record partial / advance payments at any point in the month.
            </small>
          </div>

          <button type="submit" class="btn btn-primary w-full" style="padding: 0.75rem; font-size: 1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: var(--shadow-sm);">
            <span>💰 Confirm Payment &amp; Print Bill</span>
          </button>
        </form>
      </div>

    </div>

    <!-- Bottom Section: Payment History for this Employee -->
    <div class="card" style="padding: 1.25rem;">
      <h3 style="margin: 0 0 1rem 0; font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
        <span>📜</span> Payment History &amp; Vouchers for ${emp.name}
      </h3>
      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%; text-align: left; font-size: 0.88rem;">
          <thead>
            <tr>
              <th>Period</th>
              <th>Paid (Rs)</th>
              <th>Details &amp; Days</th>
              <th>Date &amp; Time</th>
              <th style="text-align: right;">Receipt</th>
            </tr>
          </thead>
          <tbody id="sal-page-history-tbody">
            <tr><td colspan="5" style="text-align: center; color: var(--clr-text-muted); padding: 1.5rem;">Loading payment history...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  updatePayPageCalculations();
  renderPayPageHistory();
}

function updatePayPageCalculations() {
  if (!activePayEmployee) return;

  const emp = activePayEmployee;
  const basic = Number(emp.basicSalary || 0);
  const month = activePayMonth;
  const year = activePayYear;
  const sc = Number(document.getElementById('sal-page-input-sc')?.value) || 0;

  // Filter attendance records for this employee in chosen month/year
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const empAtt = allAttendanceList.filter(a => a.employeeId === emp.id && a.date && a.date.startsWith(monthPrefix));
  const fullDays = empAtt.filter(a => a.status === 'Full Day').length;
  const halfDays = empAtt.filter(a => a.status === 'Half Day').length;

  const alreadyPaid = allSalaries
    .filter(p => p.employeeId === emp.id && String(p.month).padStart(2, '0') === String(month).padStart(2, '0') && String(p.year) === year)
    .reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);

  const breakdown = calculateSalaryBreakdown({
    basic,
    fullDays,
    halfDays,
    serviceCharge: sc,
    alreadyPaid
  });

  // Left Column updates
  const fullEl = document.getElementById('sal-page-full-days');
  if (fullEl) fullEl.textContent = breakdown.fullDays;
  const fullValEl = document.getElementById('sal-page-full-val');
  if (fullValEl) fullValEl.textContent = `Rs ${(breakdown.fullDays * breakdown.dailyRate).toLocaleString()}`;

  const halfEl = document.getElementById('sal-page-half-days');
  if (halfEl) halfEl.textContent = breakdown.halfDays;
  const halfValEl = document.getElementById('sal-page-half-val');
  if (halfValEl) halfValEl.textContent = `Rs ${(breakdown.halfDays * 0.5 * breakdown.dailyRate).toLocaleString()}`;

  const effEl = document.getElementById('sal-page-effective-days');
  if (effEl) effEl.textContent = `${breakdown.effectiveDays} Days`;

  const totalRecEl = document.getElementById('sal-page-total-rec-days');
  if (totalRecEl) totalRecEl.textContent = `${empAtt.length} records`;

  // Render attendance day list
  const listContainer = document.getElementById('sal-page-att-list');
  if (listContainer) {
    if (empAtt.length === 0) {
      listContainer.innerHTML = '<div style="text-align: center; color: var(--clr-text-muted); font-size: 0.8rem; padding: 1rem;">No attendance recorded for this month.</div>';
    } else {
      empAtt.sort((a, b) => b.date.localeCompare(a.date));
      listContainer.innerHTML = empAtt.map(att => {
        let pill = '<span class="cal-status-pill cal-full" style="width: auto; padding: 0.15rem 0.5rem; font-size: 0.72rem;">Full Day (1.0x)</span>';
        if (att.status === 'Half Day') pill = '<span class="cal-status-pill cal-half" style="width: auto; padding: 0.15rem 0.5rem; font-size: 0.72rem;">Half Day (0.5x)</span>';
        if (att.status === 'Absent') pill = '<span class="cal-status-pill cal-absent" style="width: auto; padding: 0.15rem 0.5rem; font-size: 0.72rem;">Absent (0x)</span>';

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--clr-border); font-size: 0.82rem;">
            <span>📅 ${att.date}</span>
            ${pill}
          </div>
        `;
      }).join('');
    }
  }

  // Right Column updates
  const earnedDaysSubEl = document.getElementById('sal-page-earned-days-sub');
  if (earnedDaysSubEl) earnedDaysSubEl.textContent = `${breakdown.effectiveDays}d`;

  const earnedPayEl = document.getElementById('sal-page-earned-pay');
  if (earnedPayEl) earnedPayEl.textContent = `Rs ${breakdown.earnedBasic.toLocaleString()}`;

  const scDisplayEl = document.getElementById('sal-page-sc-display');
  if (scDisplayEl) scDisplayEl.textContent = `+ Rs ${breakdown.serviceCharge.toLocaleString()}`;

  const grossPayEl = document.getElementById('sal-page-gross-pay');
  if (grossPayEl) grossPayEl.textContent = `Rs ${breakdown.totalOwed.toLocaleString()}`;

  const previouslyPaidEl = document.getElementById('sal-page-previously-paid');
  if (previouslyPaidEl) previouslyPaidEl.textContent = `- Rs ${breakdown.alreadyPaid.toLocaleString()}`;

  const remainingDueEl = document.getElementById('sal-page-remaining-due');
  if (remainingDueEl) remainingDueEl.textContent = `Rs ${breakdown.remaining.toLocaleString()}`;

  const payNowInput = document.getElementById('sal-page-input-pay');
  if (payNowInput && (!payNowInput.dataset.userEdited || payNowInput.dataset.userEdited === 'false')) {
    payNowInput.value = breakdown.remaining;
  }
}

function renderPayPageHistory() {
  const tbody = document.getElementById('sal-page-history-tbody');
  if (!tbody || !activePayEmployee) return;

  const empPayments = allSalaries.filter(p => p.employeeId === activePayEmployee.id);

  if (empPayments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--clr-text-muted); padding: 1.5rem;">No payment records found for this employee.</td></tr>';
    return;
  }

  // Sort descending by date
  empPayments.sort((a, b) => {
    const timeA = new Date(a.date || 0).getTime();
    const timeB = new Date(b.date || 0).getTime();
    return timeB - timeA;
  });

  tbody.innerHTML = empPayments.map(pay => {
    const dateFormatted = pay.date 
      ? new Date(pay.date).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
      : 'N/A';

    const monthIdx = parseInt(pay.month, 10) - 1;
    const periodLabel = `${MONTH_NAMES[monthIdx] || pay.month} ${pay.year}`;

    const daysCount = pay.effectiveDays !== undefined 
      ? `${pay.effectiveDays}d worked` 
      : (pay.fullDays !== undefined ? `${pay.fullDays + (pay.halfDays || 0) * 0.5}d worked` : '');

    return `
      <tr>
        <td>
          <strong>${periodLabel}</strong>
          <br><small style="color: var(--clr-text-muted);">${pay.paymentType || 'Salary Payment'}</small>
        </td>
        <td>
          <strong style="color: #16a34a; font-size: 0.95rem;">Rs ${Number(pay.totalPaid || 0).toLocaleString()}</strong>
        </td>
        <td>
          <span style="font-size: 0.8rem; color: var(--clr-text);">${daysCount}</span>
          ${pay.serviceCharge > 0 ? `<br><small style="color: var(--clr-text-muted);">+ SC: Rs ${Number(pay.serviceCharge).toLocaleString()}</small>` : ''}
        </td>
        <td style="color: var(--clr-text-muted); font-size: 0.82rem;">
          ${dateFormatted}
        </td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-ghost btn-reprint-sal-bill" data-id="${pay.id}" title="Reprint Salary Bill" style="color: var(--clr-primary); border: 1px solid var(--clr-border); padding: 0.25rem 0.6rem;">
            🖨️ Bill
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function loadData() {
  // Subscribe to all attendance across all employees
  unsubAllAttendance = subscribeAllAttendance((attendanceList) => {
    allAttendanceList = attendanceList;
    todaysAttendance = {};
    const todayStr = new Date().toISOString().split('T')[0];
    attendanceList.forEach(att => {
      if (att.date === todayStr) {
        todaysAttendance[att.employeeId] = att.status;
      }
    });
    renderEmployeeGrid();

    // If on pay salary page, update calculations live
    if (activePayEmployee) {
      updatePayPageCalculations();
    }
  });

  unsubAllSalaries = subscribeAllSalaryPayments((payments) => {
    allSalaries = payments;
    renderEmployeeGrid();

    // If on pay salary page, update calculations & history live
    if (activePayEmployee) {
      updatePayPageCalculations();
      renderPayPageHistory();
    }
  });

  unsubEmployees = subscribeEmployees((employees) => {
    currentEmployees = employees;
    if (activePayEmployee) {
      const updated = employees.find(e => e.id === activePayEmployee.id);
      if (updated) {
        activePayEmployee = updated;
      }
    }
    renderEmployeeGrid();
  });
}

function renderEmployeeGrid() {
  const tbody = document.getElementById('employee-list-body');
  if (!tbody) return;

  if (currentEmployees.length === 0) {
    tbody.innerHTML = '<div style="text-align:center; grid-column: 1 / -1; color: var(--clr-text-muted); padding: 2rem;">No employees found.</div>';
    return;
  }

  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthPrefix = `${currentYearStr}-${currentMonthStr}`;

  tbody.innerHTML = currentEmployees.map(emp => {
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const todayStatus = todaysAttendance[emp.id];
    
    // Daily rate based on Basic ÷ 26
    const basic = Number(emp.basicSalary || 0);
    const dailyRate = Math.round((basic / 26) * 100) / 100;

    // This month attendance & earnings
    const empAttThisMonth = allAttendanceList.filter(a => a.employeeId === emp.id && a.date && a.date.startsWith(currentMonthPrefix));
    const fullDays = empAttThisMonth.filter(a => a.status === 'Full Day').length;
    const halfDays = empAttThisMonth.filter(a => a.status === 'Half Day').length;
    const effectiveDays = fullDays + (halfDays * 0.5);
    const earnedThisMonth = Math.round(effectiveDays * (basic / 26));

    const paidThisMonth = allSalaries
      .filter(p => p.employeeId === emp.id && String(p.month).padStart(2, '0') === currentMonthStr && String(p.year) === currentYearStr)
      .reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);

    const remainingDue = Math.max(0, earnedThisMonth - paidThisMonth);

    // Style active attendance buttons
    const fullActive = todayStatus === 'Full Day' ? 'background: rgba(22, 163, 74, 0.2); color: #15803d; border-color: #16a34a;' : '';
    const halfActive = todayStatus === 'Half Day' ? 'background: rgba(202, 138, 4, 0.2); color: #a16207; border-color: #ca8a04;' : '';
    const absentActive = todayStatus === 'Absent' ? 'background: rgba(220, 38, 38, 0.2); color: #b91c1c; border-color: #dc2626;' : '';

    return `
      <div class="employee-card" data-id="${emp.id}" style="display: flex; flex-direction: column;">
        <div class="emp-card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div class="emp-avatar">${initials}</div>
            <div class="emp-info">
              <h3 style="margin: 0 0 0.25rem 0;">${escapeHtml(emp.name)}</h3>
              <span class="badge-blue emp-role" style="padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${escapeHtml(emp.role || 'Employee')}</span>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost btn-card-edit-emp" data-id="${emp.id}" title="Edit Employee Details" style="padding: 3px 8px; font-size: 0.75rem; border: 1px solid var(--clr-border); border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
            ✏️ Edit
          </button>
        </div>

        <div class="emp-details" style="margin-top: 0.75rem;">
          ${emp.idNumber ? `<div>🪪 <span style="font-weight:600; color:var(--clr-text);">ID:</span> ${escapeHtml(emp.idNumber)}</div>` : ''}
          <div>📞 ${escapeHtml(emp.phone || 'N/A')}</div>
          ${emp.address ? `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(emp.address)}">🏠 ${escapeHtml(emp.address)}</div>` : ''}
          <div>💰 Rs ${basic.toLocaleString()} (Basic) • <small style="color:var(--clr-text-muted); font-weight: 600;">Rs ${dailyRate.toFixed(2)}/day</small></div>
        </div>

        <!-- Current Month Summary -->
        <div style="margin-top: 0.6rem; background: var(--clr-surface-alt, #f8fafc); border: 1px solid var(--clr-border); border-radius: 6px; padding: 0.5rem; font-size: 0.76rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 0.2rem;">
            <span style="color:var(--clr-text-muted);">This Month (${effectiveDays}d worked):</span>
            <strong>Rs ${earnedThisMonth.toLocaleString()}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--clr-text-muted);">Remaining Due:</span>
            <strong style="color: ${remainingDue > 0 ? 'var(--clr-primary)' : '#16a34a'};">Rs ${remainingDue.toLocaleString()}</strong>
          </div>
        </div>

        <div class="emp-card-actions" style="flex-direction: column; margin-top: auto; padding-top: 0.75rem;">
          <div style="font-size: 0.75rem; color: var(--clr-text-muted); margin-bottom: 0.25rem;">Mark Today's Attendance:</div>
          <div style="display:flex; gap: 0.4rem; width: 100%;">
            <button class="btn btn-sm btn-ghost btn-att-full" data-id="${emp.id}" style="flex:1; border: 1px solid var(--clr-border); color: #16a34a; padding: 0.25rem; ${fullActive}">Full</button>
            <button class="btn btn-sm btn-ghost btn-att-half" data-id="${emp.id}" style="flex:1; border: 1px solid var(--clr-border); color: #ca8a04; padding: 0.25rem; ${halfActive}">Half</button>
            <button class="btn btn-sm btn-ghost btn-att-absent" data-id="${emp.id}" style="flex:1; border: 1px solid var(--clr-border); color: #dc2626; padding: 0.25rem; ${absentActive}">Absent</button>
          </div>
          
          <!-- Full Page Open Button -->
          <button class="btn btn-sm btn-primary btn-open-pay-page" data-id="${emp.id}" style="margin-top: 0.75rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-weight: 600; cursor: pointer;">
            <span style="pointer-events: none;">💳 Pay Salary &amp; Print Bill →</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function destroyEmployeePage() {
  if (unsubEmployees) {
    unsubEmployees();
    unsubEmployees = null;
  }
  if (unsubAllAttendance) {
    unsubAllAttendance();
    unsubAllAttendance = null;
  }
  if (unsubAllSalaries) {
    unsubAllSalaries();
    unsubAllSalaries = null;
  }
  activePayEmployee = null;
  document.getElementById('reception-emp-edit-modal-overlay')?.remove();
}

function openEmployeeEditModal(emp) {
  if (!emp) return;
  document.getElementById('reception-emp-edit-modal-overlay')?.remove();

  const basic = Number(emp.basicSalary || 0);
  const dailyRate = Math.round((basic / 26) * 100) / 100;

  const modalHtml = `
    <div class="modal-overlay" id="reception-emp-edit-modal-overlay">
      <div class="modal" style="max-width: 480px; width: 100%; max-height: min(90vh, 90dvh); display: flex; flex-direction: column; overflow: hidden;">
        <div class="modal-header">
          <div class="modal-title">✏️ Edit Employee Details</div>
          <button type="button" class="modal-close" id="rec-edit-emp-close">✕</button>
        </div>
        <form id="reception-emp-edit-form" class="modal-form" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
          <div class="modal-body" style="display:flex; flex-direction:column; gap:14px; overflow-y: auto; flex: 1; min-height: 0;">
            <div class="form-group">
              <label class="form-label" for="rec-edit-emp-name" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Full Name</label>
              <input type="text" id="rec-edit-emp-name" class="form-control" required value="${escapeHtml(emp.name || '')}" placeholder="e.g. Kasun Perera" />
            </div>

            <div class="form-group">
              <label class="form-label" for="rec-edit-emp-role" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Role / Designation</label>
              <input type="text" id="rec-edit-emp-role" class="form-control" required value="${escapeHtml(emp.role || '')}" placeholder="e.g. Cleaner, Manager" />
            </div>

            <div class="form-group">
              <label class="form-label" for="rec-edit-emp-phone" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Phone Number</label>
              <input type="tel" id="rec-edit-emp-phone" class="form-control" required value="${escapeHtml(emp.phone || '')}" placeholder="e.g. 0771234567" />
            </div>

            <div class="form-group">
              <label class="form-label" for="rec-edit-emp-id-number" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Employee ID / NIC Number</label>
              <input type="text" id="rec-edit-emp-id-number" class="form-control" value="${escapeHtml(emp.idNumber || emp.nic || '')}" placeholder="e.g. 199512345678 or EMP-001" />
            </div>

            <div class="form-group">
              <label class="form-label" for="rec-edit-emp-address" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Address</label>
              <textarea id="rec-edit-emp-address" class="form-control" rows="2" placeholder="e.g. No. 12, Beach Road, Dikwella" style="resize:vertical;">${escapeHtml(emp.address || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="rec-edit-emp-basic" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Basic Salary (LKR)</label>
              <input type="number" id="rec-edit-emp-basic" class="form-control" min="0" step="100" required value="${basic}" placeholder="e.g. 60000" />
            </div>

            <!-- Live Daily Rate Preview -->
            <div style="background:var(--clr-surface-2); border:1.5px solid var(--clr-border); border-radius:8px; padding:10px 14px; font-size:0.82rem">
              <div style="display:flex; justify-content:space-between; align-items:center">
                <span style="color:var(--clr-text-muted)">Daily Rate (Basic ÷ 26):</span>
                <strong id="rec-edit-emp-daily-rate" style="color:var(--clr-primary); font-size:0.95rem">
                  Rs ${dailyRate.toFixed(2)} / day
                </strong>
              </div>
            </div>
          </div>

          <div class="modal-footer" style="flex-shrink:0;">
            <button type="button" class="btn btn-secondary" id="rec-edit-emp-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="rec-edit-emp-submit" style="font-weight:600">
              💾 Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.getElementById('reception-emp-edit-modal-overlay');
  const closeBtn = document.getElementById('rec-edit-emp-close');
  const cancelBtn = document.getElementById('rec-edit-emp-cancel');
  const form = document.getElementById('reception-emp-edit-form');
  const basicInput = document.getElementById('rec-edit-emp-basic');
  const dailyRateDisplay = document.getElementById('rec-edit-emp-daily-rate');

  function closeModal() {
    overlay?.remove();
  }

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  basicInput?.addEventListener('input', () => {
    const val = parseFloat(basicInput.value) || 0;
    const rate = Math.round((val / 26) * 100) / 100;
    if (dailyRateDisplay) {
      dailyRateDisplay.textContent = `Rs ${rate.toFixed(2)} / day`;
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('rec-edit-emp-name').value.trim();
    const role = document.getElementById('rec-edit-emp-role').value.trim();
    const phone = document.getElementById('rec-edit-emp-phone').value.trim();
    const idNumber = document.getElementById('rec-edit-emp-id-number').value.trim();
    const address = document.getElementById('rec-edit-emp-address').value.trim();
    const basicSalary = parseFloat(basicInput.value) || 0;

    if (!name) {
      showToast('Please enter employee name', 'warning');
      return;
    }

    const submitBtn = document.getElementById('rec-edit-emp-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      await updateEmployee(emp.id, { name, role, phone, basicSalary, idNumber, address });
      showToast('Employee details updated successfully', 'success');
      if (activePayEmployee && activePayEmployee.id === emp.id) {
        activePayEmployee = { ...activePayEmployee, name, role, phone, basicSalary, idNumber, address };
        openPaySalaryPage(activePayEmployee);
      }
      closeModal();
    } catch (err) {
      console.error('Error updating employee:', err);
      showToast('Failed to update employee: ' + (err.message || 'Unknown error'), 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Save Changes';
      }
    }
  });
}
