import { 
  subscribeEmployees, 
  subscribeAttendance, 
  subscribeAllAttendance,
  addAttendance,
  deleteAttendance,
  subscribeSalaryPayments,
  subscribeAllSalaryPayments,
  deleteSalaryPayment,
  paySalary,
  deleteEmployee,
  updateEmployee,
  addEmployee,
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
let unsubProfileAttendance = null;
let unsubSalary = null;

let currentEmployees = [];
let allAttendanceList = [];
let allSalariesList = [];

// Helper to format date as YYYY-MM-DD in local time
function getLocalDateStr(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateParts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDateRelation(dateStr) {
  const todayStr = getLocalDateStr();
  if (dateStr === todayStr) return { type: 'today', text: 'Today' };
  if (dateStr > todayStr) return { type: 'future', text: 'Future Date' };
  
  const d1 = parseDateParts(dateStr);
  const d2 = parseDateParts(todayStr);
  const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return { type: 'past', text: 'Yesterday (Previous Date)', daysAgo: 1 };
  return { type: 'past', text: `${diffDays} days ago (Previous Date)`, daysAgo: diffDays };
}

function formatDisplayDate(dateStr) {
  try {
    const d = parseDateParts(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch (err) {
    return dateStr;
  }
}

// State for Grid View
let selectedGridDate = getLocalDateStr();

// State for Profile View
let activeEmployee = null;
let profileCalendarYear = new Date().getFullYear();
let profileCalendarMonth = new Date().getMonth(); // 0-11
let selectedProfileDate = getLocalDateStr();
let activeEmployeeAttendance = [];
let activeEmployeeSalaries = [];

export function renderEmployeeDetailsPage(container) {
  const todayStr = getLocalDateStr();

  container.innerHTML = `
    <div id="admin-emp-grid-view">
      <div class="page-header" style="flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between;">
        <div>
          <h2 class="page-title" style="margin: 0 0 0.25rem 0;">Employees Details (Admin)</h2>
          <p style="color: var(--clr-text-muted); font-size: 0.85rem; margin: 0;">
            Mark attendance for any date, calculate daily-rate salaries, edit basic salary/details, and manage payouts.
          </p>
        </div>
        <div>
          <button class="btn btn-primary" id="btn-admin-add-emp" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            <span>➕</span> Add New Employee
          </button>
        </div>
      </div>

      <!-- Attendance Date Selector Toolbar -->
      <div class="card admin-attendance-toolbar" style="margin-bottom: 1.5rem; padding: 1rem 1.25rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
          <span style="font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 0.35rem;">
            <span>📅</span> Mark Attendance For:
          </span>
          <div style="display: inline-flex; align-items: center; gap: 0.25rem;">
            <button class="btn btn-sm btn-ghost" id="admin-grid-prev-day" title="Previous Day" style="padding: 0.3rem 0.6rem; border: 1px solid var(--clr-border);">◀</button>
            <input type="date" id="admin-grid-date-input" class="form-input" style="padding: 0.3rem 0.6rem; font-size: 0.88rem; font-weight: 500; width: auto;" max="${todayStr}" value="${selectedGridDate}">
            <button class="btn btn-sm btn-ghost" id="admin-grid-next-day" title="Next Day" style="padding: 0.3rem 0.6rem; border: 1px solid var(--clr-border);">▶</button>
          </div>
          <button class="btn btn-sm btn-ghost" id="admin-grid-today-btn" style="padding: 0.3rem 0.75rem; border: 1px solid var(--clr-border); font-weight: 500;">Today</button>
        </div>
        <div id="admin-grid-date-badge-container"></div>
      </div>

      <div class="employee-grid" id="admin-employee-list-body">
        <div style="text-align:center; grid-column: 1 / -1;">Loading employees...</div>
      </div>
    </div>
    
    <div id="admin-emp-profile-view" style="display:none;">
      <button class="btn btn-ghost" id="btn-back-to-grid" style="margin-bottom: 1rem;">← Back to Employees</button>
      <div id="profile-content-area"></div>
    </div>
  `;

  bindEvents();
  loadData();
  updateGridDateBadge();
}

function updateGridDateBadge() {
  const container = document.getElementById('admin-grid-date-badge-container');
  if (!container) return;

  const rel = getDateRelation(selectedGridDate);
  const formatted = formatDisplayDate(selectedGridDate);

  if (rel.type === 'today') {
    container.innerHTML = `
      <span class="badge-today-date" title="Recording attendance for today">
        <span>●</span> ${formatted} — <strong>Today</strong>
      </span>
    `;
  } else if (rel.type === 'past') {
    container.innerHTML = `
      <span class="badge-past-date" title="Recording attendance for previous date">
        <span>🕒</span> ${formatted} — <strong>${rel.text}</strong>
      </span>
    `;
  } else {
    container.innerHTML = `
      <span class="badge-gray">${formatted}</span>
    `;
  }
}

function changeGridDay(offset) {
  const [y, m, d] = selectedGridDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() + offset);

  const todayStr = getLocalDateStr();
  const nextDateStr = getLocalDateStr(dateObj);

  if (offset > 0 && nextDateStr > todayStr) {
    showToast('Cannot select future dates for attendance', 'warning');
    return;
  }

  selectedGridDate = nextDateStr;
  const input = document.getElementById('admin-grid-date-input');
  if (input) input.value = selectedGridDate;
  updateGridDateBadge();
  renderEmployeeGrid();
}

function bindEvents() {
  // Navigation back to grid
  document.getElementById('btn-back-to-grid')?.addEventListener('click', () => {
    document.getElementById('admin-emp-profile-view').style.display = 'none';
    document.getElementById('admin-emp-grid-view').style.display = 'block';
    
    if (unsubProfileAttendance) { unsubProfileAttendance(); unsubProfileAttendance = null; }
    if (unsubSalary) { unsubSalary(); unsubSalary = null; }
    activeEmployee = null;
  });

  // Add Employee button in header
  document.getElementById('btn-admin-add-emp')?.addEventListener('click', () => {
    openEmployeeModal(null);
  });

  // Grid Date toolbar controls
  document.getElementById('admin-grid-prev-day')?.addEventListener('click', () => changeGridDay(-1));
  document.getElementById('admin-grid-next-day')?.addEventListener('click', () => changeGridDay(1));
  document.getElementById('admin-grid-today-btn')?.addEventListener('click', () => {
    selectedGridDate = getLocalDateStr();
    const input = document.getElementById('admin-grid-date-input');
    if (input) input.value = selectedGridDate;
    updateGridDateBadge();
    renderEmployeeGrid();
  });

  document.getElementById('admin-grid-date-input')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const todayStr = getLocalDateStr();
    if (val > todayStr) {
      showToast('Cannot select future dates for attendance', 'warning');
      e.target.value = todayStr;
      selectedGridDate = todayStr;
    } else if (val) {
      selectedGridDate = val;
    }
    updateGridDateBadge();
    renderEmployeeGrid();
  });

  // Event delegation on employee grid
  const grid = document.getElementById('admin-employee-list-body');
  grid?.addEventListener('click', async (e) => {
    // 1-Click attendance marking on card
    const attBtn = e.target.closest('.btn-admin-card-att');
    if (attBtn) {
      e.stopPropagation();
      const empId = attBtn.dataset.id;
      const status = attBtn.dataset.status;
      const emp = currentEmployees.find(emp => emp.id === empId);
      if (!emp) return;

      try {
        await addAttendance(empId, selectedGridDate, status);
        showToast(`Marked ${status} for ${emp.name} on ${selectedGridDate}`, 'success');
      } catch (err) {
        showToast('Error updating attendance', 'error');
      }
      return;
    }

    // Clear attendance on card
    const clearBtn = e.target.closest('.btn-admin-card-clear');
    if (clearBtn) {
      e.stopPropagation();
      const empId = clearBtn.dataset.id;
      const emp = currentEmployees.find(emp => emp.id === empId);
      if (!emp) return;

      try {
        await deleteAttendance(empId, selectedGridDate);
        showToast(`Cleared attendance for ${emp.name} on ${selectedGridDate}`, 'info');
      } catch (err) {
        showToast('Error clearing attendance', 'error');
      }
      return;
    }

    // Edit employee button on card
    const editCardBtn = e.target.closest('.btn-card-edit-emp');
    if (editCardBtn) {
      e.stopPropagation();
      const id = editCardBtn.dataset.id;
      const emp = currentEmployees.find(e => e.id === id);
      if (emp) {
        openEmployeeModal(emp);
      }
      return;
    }

    // Click button to open full profile & pay salary
    const openBtn = e.target.closest('.btn-admin-open-profile');
    if (openBtn) {
      const id = openBtn.dataset.id;
      const emp = currentEmployees.find(e => e.id === id);
      if (emp) {
        openProfileView(emp);
      }
      return;
    }

    // Click card to open full profile
    const card = e.target.closest('.employee-card');
    if (card) {
      const id = card.dataset.id;
      const emp = currentEmployees.find(e => e.id === id);
      if (emp) {
        openProfileView(emp);
      }
    }
  });

  // Profile actions
  const profileArea = document.getElementById('profile-content-area');
  profileArea?.addEventListener('click', async (e) => {
    // Edit employee details from profile
    if (e.target.classList.contains('btn-edit-emp') || e.target.closest('.btn-edit-emp')) {
      if (activeEmployee) {
        openEmployeeModal(activeEmployee);
      }
      return;
    }

    // Delete salary
    if (e.target.classList.contains('btn-del-sal')) {
      const payId = e.target.dataset.id;
      if (confirm('Are you sure you want to delete this salary payment? This action cannot be undone.')) {
        try {
          await deleteSalaryPayment(payId);
          showToast('Salary payment deleted', 'info');
        } catch (err) {
          console.error('Failed to delete payment', err);
          showToast('Error deleting payment.', 'error');
        }
      }
      return;
    }

    // Print salary bill from history
    if (e.target.classList.contains('btn-print-sal') || e.target.closest('.btn-print-sal')) {
      const btn = e.target.classList.contains('btn-print-sal') ? e.target : e.target.closest('.btn-print-sal');
      const payId = btn.dataset.id;
      const payRecord = activeEmployeeSalaries.find(p => p.id === payId);
      if (payRecord && activeEmployee) {
        openPrintSalaryBill(payRecord, activeEmployee);
      }
      return;
    }

    // Delete employee
    if (e.target.classList.contains('btn-del-emp')) {
      const empId = e.target.dataset.id;
      if (confirm('Are you sure you want to permanently delete this employee? This action cannot be undone.')) {
        try {
          await deleteEmployee(empId);
          showToast('Employee deleted', 'info');
          document.getElementById('btn-back-to-grid')?.click();
        } catch (err) {
          console.error('Failed to delete employee', err);
          showToast('Error deleting employee.', 'error');
        }
      }
      return;
    }

    // Calendar Month Navigation: Prev Month
    if (e.target.closest('#prof-cal-prev-month')) {
      profileCalendarMonth--;
      if (profileCalendarMonth < 0) {
        profileCalendarMonth = 11;
        profileCalendarYear--;
      }
      renderProfileAttendanceSection();
      return;
    }

    // Calendar Month Navigation: Next Month
    if (e.target.closest('#prof-cal-next-month')) {
      profileCalendarMonth++;
      if (profileCalendarMonth > 11) {
        profileCalendarMonth = 0;
        profileCalendarYear++;
      }
      renderProfileAttendanceSection();
      return;
    }

    // Calendar Month Navigation: This Month
    if (e.target.closest('#prof-cal-current-month')) {
      const now = new Date();
      profileCalendarYear = now.getFullYear();
      profileCalendarMonth = now.getMonth();
      renderProfileAttendanceSection();
      return;
    }

    // Click on a calendar day cell
    const dayCell = e.target.closest('.calendar-day.clickable');
    if (dayCell && dayCell.dataset.date) {
      selectedProfileDate = dayCell.dataset.date;
      renderProfileAttendanceSection();
      return;
    }

    // Profile Quick Attendance Mark Button
    const profAttBtn = e.target.closest('.btn-prof-att-mark');
    if (profAttBtn && activeEmployee) {
      const status = profAttBtn.dataset.status;
      try {
        await addAttendance(activeEmployee.id, selectedProfileDate, status);
        showToast(`Marked ${status} for ${activeEmployee.name} on ${selectedProfileDate}`, 'success');
      } catch (err) {
        showToast('Error updating attendance', 'error');
      }
      return;
    }

    // Profile Quick Attendance Clear Button
    const profClearBtn = e.target.closest('.btn-prof-att-clear');
    if (profClearBtn && activeEmployee) {
      try {
        await deleteAttendance(activeEmployee.id, selectedProfileDate);
        showToast(`Cleared attendance for ${activeEmployee.name} on ${selectedProfileDate}`, 'info');
      } catch (err) {
        showToast('Error clearing attendance', 'error');
      }
      return;
    }
  });

  // Profile date input change
  profileArea?.addEventListener('change', (e) => {
    if (e.target.id === 'prof-att-date-input') {
      const val = e.target.value;
      const todayStr = getLocalDateStr();
      if (val > todayStr) {
        showToast('Cannot select future dates for attendance', 'warning');
        e.target.value = todayStr;
        selectedProfileDate = todayStr;
      } else if (val) {
        selectedProfileDate = val;
        // Also sync calendar view month/year if selected date is in another month
        const [y, m] = val.split('-').map(Number);
        profileCalendarYear = y;
        profileCalendarMonth = m - 1;
      }
      renderProfileAttendanceSection();
    }
  });

  // Profile Salary Form dynamic input calculation
  profileArea?.addEventListener('input', (e) => {
    if (e.target.classList.contains('prof-sal-month') || 
        e.target.classList.contains('prof-sal-year') || 
        e.target.classList.contains('prof-sal-sc')) {
      const form = document.getElementById('admin-profile-sal-form');
      if (!form) return;
      const payNowInput = form.querySelector('.prof-sal-pay-now');
      if (payNowInput) payNowInput.dataset.userEdited = 'false';
      updateProfileSalaryCalculations();
    } else if (e.target.classList.contains('prof-sal-pay-now')) {
      e.target.dataset.userEdited = 'true';
    }
  });

  // Profile Salary Form Submit
  profileArea?.addEventListener('submit', async (e) => {
    if (e.target.id === 'admin-profile-sal-form' && activeEmployee) {
      e.preventDefault();
      const form = e.target;
      const basic = Number(activeEmployee.basicSalary || 0);
      const month = form.querySelector('.prof-sal-month').value;
      const year = String(form.querySelector('.prof-sal-year').value);
      const sc = Number(form.querySelector('.prof-sal-sc').value) || 0;
      const payNow = Number(form.querySelector('.prof-sal-pay-now').value);

      if (payNow <= 0) {
        showToast('Please enter a valid payment amount', 'warning');
        return;
      }

      // Compute attendance for selected period
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const empAtt = activeEmployeeAttendance.filter(a => a.date && a.date.startsWith(monthPrefix));
      const fullDays = empAtt.filter(a => a.status === 'Full Day').length;
      const halfDays = empAtt.filter(a => a.status === 'Half Day').length;

      const alreadyPaid = activeEmployeeSalaries
        .filter(p => String(p.month).padStart(2, '0') === String(month).padStart(2, '0') && String(p.year) === year)
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
        const payId = await paySalary(activeEmployee.id, paymentRecord);
        showToast('Salary payment recorded! Generating bill...', 'success');
        form.reset();

        // Print Salary Bill
        openPrintSalaryBill({ id: payId, ...paymentRecord }, activeEmployee);
      } catch (err) {
        showToast('Error recording salary payment', 'error');
      }
    }
  });
}

function loadData() {
  // Subscribe to all attendance so grid is updated in real-time for any selected date
  unsubAllAttendance = subscribeAllAttendance((attendanceList) => {
    allAttendanceList = attendanceList;
    renderEmployeeGrid();
  });

  // Subscribe to all salary payments for grid calculations
  unsubAllSalaries = subscribeAllSalaryPayments((payments) => {
    allSalariesList = payments;
    renderEmployeeGrid();
  });

  // Subscribe to all employees
  unsubEmployees = subscribeEmployees((employees) => {
    currentEmployees = employees;
    if (activeEmployee) {
      const updated = employees.find(e => e.id === activeEmployee.id);
      if (updated) {
        activeEmployee = updated;
        const profView = document.getElementById('admin-emp-profile-view');
        if (profView && profView.style.display !== 'none') {
          openProfileView(updated);
        }
      }
    }
    renderEmployeeGrid();
  });
}

function renderEmployeeGrid() {
  const grid = document.getElementById('admin-employee-list-body');
  if (!grid) return;

  if (currentEmployees.length === 0) {
    grid.innerHTML = '<div style="text-align:center; grid-column: 1 / -1; color: var(--clr-text-muted); padding: 2rem;">No employees found.</div>';
    return;
  }

  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthPrefix = `${currentYearStr}-${currentMonthStr}`;

  // Map attendance for the selected date
  const attMap = {};
  allAttendanceList.forEach(att => {
    if (att.date === selectedGridDate) {
      attMap[att.employeeId] = att.status;
    }
  });

  grid.innerHTML = currentEmployees.map(emp => {
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const status = attMap[emp.id];

    // Salary calculations: Basic ÷ 26
    const basic = Number(emp.basicSalary || 0);
    const dailyRate = Math.round((basic / 26) * 100) / 100;

    // Monthly attendance calculation
    const empAttThisMonth = allAttendanceList.filter(a => a.employeeId === emp.id && a.date && a.date.startsWith(currentMonthPrefix));
    const fullDays = empAttThisMonth.filter(a => a.status === 'Full Day').length;
    const halfDays = empAttThisMonth.filter(a => a.status === 'Half Day').length;
    const effectiveDays = fullDays + (halfDays * 0.5);
    const earnedThisMonth = Math.round(effectiveDays * (basic / 26));

    const paidThisMonth = allSalariesList
      .filter(p => p.employeeId === emp.id && String(p.month).padStart(2, '0') === currentMonthStr && String(p.year) === currentYearStr)
      .reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);

    const remainingDue = Math.max(0, earnedThisMonth - paidThisMonth);

    let statusBadge = `<span style="font-size: 0.72rem; color: var(--clr-text-muted); font-style: italic;">Not Marked</span>`;
    if (status === 'Full Day') statusBadge = `<span class="cal-status-pill cal-full" style="width: auto; padding: 0.15rem 0.5rem; font-size: 0.72rem;">Full Day</span>`;
    else if (status === 'Half Day') statusBadge = `<span class="cal-status-pill cal-half" style="width: auto; padding: 0.15rem 0.5rem; font-size: 0.72rem;">Half Day</span>`;
    else if (status === 'Absent') statusBadge = `<span class="cal-status-pill cal-absent" style="width: auto; padding: 0.15rem 0.5rem; font-size: 0.72rem;">Absent</span>`;

    return `
      <div class="employee-card" data-id="${emp.id}" style="cursor: pointer; display: flex; flex-direction: column;">
        <div class="emp-card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div class="emp-avatar">${initials}</div>
            <div class="emp-info">
              <h3 style="margin: 0 0 0.25rem 0;">${emp.name}</h3>
              <span class="badge-blue emp-role" style="padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${emp.role || 'Employee'}</span>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost btn-card-edit-emp" data-id="${emp.id}" title="Edit Basic & Details" style="padding: 3px 8px; font-size: 0.75rem; border: 1px solid var(--clr-border); border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
            ✏️ Edit
          </button>
        </div>

        <div class="emp-details" style="margin-top: 0.75rem;">
          ${emp.idNumber ? `<div>🪪 <span style="font-weight:600; color:var(--clr-text);">ID:</span> ${escapeHtml(emp.idNumber)}</div>` : ''}
          <div>📞 ${escapeHtml(emp.phone || 'N/A')}</div>
          ${emp.address ? `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(emp.address)}">🏠 ${escapeHtml(emp.address)}</div>` : ''}
          <div>💰 Rs ${basic.toLocaleString()} (Basic) • <small style="color:var(--clr-text-muted); font-weight: 600;">Rs ${dailyRate.toFixed(2)}/day</small></div>
        </div>

        <!-- Monthly Salary Summary Card -->
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

        <!-- Attendance for Selected Date -->
        <div class="emp-card-att-box" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--clr-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span style="font-size: 0.76rem; font-weight: 600; color: var(--clr-text-muted);">
              ${selectedGridDate}:
            </span>
            ${statusBadge}
          </div>
          <div style="display: flex; gap: 0.35rem; align-items: center; width: 100%;">
            <button class="btn btn-sm ${status === 'Full Day' ? 'btn-att-status-full' : 'btn-ghost'} btn-admin-card-att" data-id="${emp.id}" data-status="Full Day" title="Mark Full Day for ${selectedGridDate}" style="flex:1; border: 1px solid var(--clr-border); color: #16a34a; padding: 0.25rem 0.2rem; font-size: 0.78rem;">Full</button>
            <button class="btn btn-sm ${status === 'Half Day' ? 'btn-att-status-half' : 'btn-ghost'} btn-admin-card-att" data-id="${emp.id}" data-status="Half Day" title="Mark Half Day for ${selectedGridDate}" style="flex:1; border: 1px solid var(--clr-border); color: #ca8a04; padding: 0.25rem 0.2rem; font-size: 0.78rem;">Half</button>
            <button class="btn btn-sm ${status === 'Absent' ? 'btn-att-status-absent' : 'btn-ghost'} btn-admin-card-att" data-id="${emp.id}" data-status="Absent" title="Mark Absent for ${selectedGridDate}" style="flex:1; border: 1px solid var(--clr-border); color: #dc2626; padding: 0.25rem 0.2rem; font-size: 0.78rem;">Absent</button>
            ${status ? `<button class="btn btn-sm btn-ghost btn-admin-card-clear" data-id="${emp.id}" title="Clear attendance for ${selectedGridDate}" style="color: var(--clr-text-muted); border: 1px solid var(--clr-border); padding: 0.25rem 0.45rem; font-size: 0.78rem;">✕</button>` : ''}
          </div>
        </div>

        <!-- Profile & Pay Salary Button -->
        <button class="btn btn-sm btn-primary btn-admin-open-profile" data-id="${emp.id}" style="margin-top: 0.75rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-weight: 600; cursor: pointer;">
          <span style="pointer-events: none;">💳 Profile &amp; Pay Salary →</span>
        </button>
      </div>
    `;
  }).join('');
}

function openEmployeeModal(emp = null) {
  document.getElementById('admin-emp-modal-overlay')?.remove();

  const isEdit = !!emp;
  const basic = Number(emp?.basicSalary || 0);
  const dailyRate = Math.round((basic / 26) * 100) / 100;

  const modalHtml = `
    <div class="modal-overlay" id="admin-emp-modal-overlay">
      <div class="modal" style="max-width: 480px; width: 100%; max-height: min(90vh, 90dvh); display: flex; flex-direction: column; overflow: hidden;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '✏️ Edit Employee Details' : '➕ Add New Employee'}</div>
          <button type="button" class="modal-close" id="modal-emp-close">✕</button>
        </div>
        <form id="admin-emp-form" class="modal-form" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
          <div class="modal-body" style="display:flex; flex-direction:column; gap:14px; overflow-y: auto; flex: 1; min-height: 0;">
            <div class="form-group">
              <label class="form-label" for="modal-emp-name" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Full Name</label>
              <input type="text" id="modal-emp-name" class="form-control" required value="${emp?.name || ''}" placeholder="e.g. Kasun Perera" />
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-emp-role" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Role / Designation</label>
              <input type="text" id="modal-emp-role" class="form-control" required value="${emp?.role || ''}" placeholder="e.g. Receptionist, Chef, Manager" />
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-emp-phone" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Phone Number</label>
              <input type="tel" id="modal-emp-phone" class="form-control" required value="${emp?.phone || ''}" placeholder="e.g. 0771234567" />
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-emp-id-number" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Employee ID / NIC Number</label>
              <input type="text" id="modal-emp-id-number" class="form-control" value="${escapeHtml(emp?.idNumber || emp?.nic || '')}" placeholder="e.g. 199512345678 or EMP-001" />
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-emp-address" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Address</label>
              <textarea id="modal-emp-address" class="form-control" rows="2" placeholder="e.g. No. 12, Beach Road, Dikwella" style="resize:vertical;">${escapeHtml(emp?.address || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-emp-basic" style="font-weight:600; font-size:0.85rem; margin-bottom:4px; display:block">Basic Salary (LKR)</label>
              <input type="number" id="modal-emp-basic" class="form-control" min="0" step="100" required value="${emp ? (emp.basicSalary ?? '') : ''}" placeholder="e.g. 60000" />
            </div>

            <!-- Live Daily Rate Preview -->
            <div style="background:var(--clr-surface-2); border:1.5px solid var(--clr-border); border-radius:8px; padding:10px 14px; font-size:0.82rem">
              <div style="display:flex; justify-content:space-between; align-items:center">
                <span style="color:var(--clr-text-muted)">Daily Rate (Basic ÷ 26):</span>
                <strong id="modal-emp-daily-rate" style="color:var(--clr-primary); font-size:0.95rem">
                  Rs ${dailyRate.toFixed(2)} / day
                </strong>
              </div>
              <div style="font-size:0.72rem; color:var(--clr-text-muted); margin-top:3px">
                Attendance payout uses: Full Day = 1 × Daily Rate, Half Day = 0.5 × Daily Rate
              </div>
            </div>
          </div>

          <div class="modal-footer" style="flex-shrink:0;">
            <button type="button" class="btn btn-secondary" id="modal-emp-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="modal-emp-submit" style="font-weight:600">
              ${isEdit ? '💾 Save Changes' : '➕ Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.getElementById('admin-emp-modal-overlay');
  const closeBtn = document.getElementById('modal-emp-close');
  const cancelBtn = document.getElementById('modal-emp-cancel');
  const form = document.getElementById('admin-emp-form');
  const basicInput = document.getElementById('modal-emp-basic');
  const dailyRateDisplay = document.getElementById('modal-emp-daily-rate');

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
    const name = document.getElementById('modal-emp-name').value.trim();
    const role = document.getElementById('modal-emp-role').value.trim();
    const phone = document.getElementById('modal-emp-phone').value.trim();
    const idNumber = document.getElementById('modal-emp-id-number').value.trim();
    const address = document.getElementById('modal-emp-address').value.trim();
    const basicSalary = parseFloat(basicInput.value) || 0;

    if (!name) {
      showToast('Please enter employee name', 'warning');
      return;
    }
    if (basicSalary < 0) {
      showToast('Basic salary cannot be negative', 'warning');
      return;
    }

    const submitBtn = document.getElementById('modal-emp-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      if (isEdit && emp?.id) {
        await updateEmployee(emp.id, { name, role, phone, basicSalary, idNumber, address });
        showToast('Employee details updated successfully', 'success');
        if (activeEmployee && activeEmployee.id === emp.id) {
          activeEmployee = { ...activeEmployee, name, role, phone, basicSalary, idNumber, address };
          openProfileView(activeEmployee);
        }
      } else {
        await addEmployee({ name, role, phone, basicSalary, idNumber, address });
        showToast('Employee added successfully', 'success');
      }
      closeModal();
    } catch (err) {
      console.error('Error saving employee:', err);
      showToast('Failed to save employee: ' + (err.message || 'Unknown error'), 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? '💾 Save Changes' : '➕ Add Employee';
      }
    }
  });
}

function openProfileView(emp) {
  activeEmployee = emp;
  document.getElementById('admin-emp-grid-view').style.display = 'none';
  document.getElementById('admin-emp-profile-view').style.display = 'block';
  
  const contentArea = document.getElementById('profile-content-area');
  const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const basic = Number(emp.basicSalary || 0);
  const dailyRate = Math.round((basic / 26) * 100) / 100;

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYear = new Date().getFullYear();

  const monthOptions = `
    <option value="01">Jan</option><option value="02">Feb</option><option value="03">Mar</option>
    <option value="04">Apr</option><option value="05">May</option><option value="06">Jun</option>
    <option value="07">Jul</option><option value="08">Aug</option><option value="09">Sep</option>
    <option value="10">Oct</option><option value="11">Nov</option><option value="12">Dec</option>
  `.replace(`value="${currentMonth}"`, `value="${currentMonth}" selected`);

  contentArea.innerHTML = `
    <div class="profile-header-section" style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <div style="display: flex; gap: 1.25rem; align-items: center;">
        <div class="profile-avatar">${initials}</div>
        <div class="profile-title">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
            <h2 style="margin: 0;">${escapeHtml(emp.name)}</h2>
            <span class="badge-blue" style="padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.82rem; font-weight: 500;">${escapeHtml(emp.role || 'Employee')}</span>
            ${emp.idNumber ? `<span class="badge-gray" style="padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.82rem; font-weight: 600;">🪪 ID: ${escapeHtml(emp.idNumber)}</span>` : ''}
          </div>
          <p style="margin: 0.35rem 0 0 0; color: var(--clr-text-muted);">
            📞 ${escapeHtml(emp.phone || 'N/A')} ${emp.address ? `&nbsp;|&nbsp; 🏠 ${escapeHtml(emp.address)}` : ''} &nbsp;|&nbsp; 💰 Basic: Rs ${basic.toLocaleString()} &nbsp;|&nbsp; 
            <span style="color: var(--clr-primary); font-weight: 600;">Daily Rate (÷26): Rs ${dailyRate.toFixed(2)}</span>
          </p>
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button class="btn btn-sm btn-primary btn-edit-emp" data-id="${emp.id}" style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600;">
          ✏️ Edit Details &amp; Basic
        </button>
        <button class="btn btn-sm btn-ghost btn-del-emp" data-id="${emp.id}" style="color: #dc2626; border: 1px solid #dc2626;">Delete Employee</button>
      </div>
    </div>

    <div class="stat-grid" style="margin-bottom: 1.5rem;">
      <div class="stat-card">
        <div class="stat-card-title">Total Paid (All Time)</div>
        <div class="stat-card-value" id="stat-total-paid">Rs 0</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title" id="stat-present-label">Days Present (This Month)</div>
        <div class="stat-card-value" id="stat-days-present" style="color: #16a34a;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title" id="stat-absent-label">Days Absent (This Month)</div>
        <div class="stat-card-value" id="stat-days-absent" style="color: #dc2626;">0</div>
      </div>
    </div>

    <div class="profile-tables-layout">
      <!-- Attendance Column with Month Navigation & Past Date Marking -->
      <div class="card" id="prof-attendance-card">
        <div id="prof-att-section-container">
          <div style="text-align:center; padding: 2rem;">Loading attendance...</div>
        </div>
      </div>

      <!-- Salary Column with Pay Form & Printable Bill History -->
      <div class="card" id="prof-salary-card">
        <h3 style="margin-top:0; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
          <span>Salary &amp; Payments</span>
          <span style="font-size: 0.78rem; font-weight: 600; color: var(--clr-primary); background: rgba(37, 99, 235, 0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">
            Rate: Rs ${dailyRate.toFixed(2)}/day
          </span>
        </h3>

        <!-- Admin Pay Salary Form (Supports mid-month payments & prints bill) -->
        <div style="background: var(--clr-surface-alt, #f8fafc); border: 1px solid var(--clr-border); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
          <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.6rem; color: var(--clr-text);">
            💳 Record Salary Payment / Print Bill
          </div>

          <form id="admin-profile-sal-form">
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.6rem;">
              <select class="form-input prof-sal-month" required style="padding: 0.35rem 0.5rem; flex: 1;">
                ${monthOptions}
              </select>
              <input type="number" class="form-input prof-sal-year" required style="padding: 0.35rem 0.5rem; flex: 1;" value="${currentYear}">
            </div>

            <!-- Dynamic calculation display -->
            <div style="background: var(--clr-surface, #fff); border: 1px solid var(--clr-border); border-radius: 6px; padding: 0.6rem; font-size: 0.78rem; margin-bottom: 0.6rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="color: var(--clr-text-muted);">Days Worked (Full+Half):</span>
                <strong id="admin-prof-sal-days">0 Full + 0 Half (0d)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="color: var(--clr-text-muted);">Earned Pay:</span>
                <strong id="admin-prof-sal-earned">Rs 0</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="color: var(--clr-text-muted);">Previously Paid This Month:</span>
                <strong id="admin-prof-sal-paid" style="color: #dc2626;">Rs 0</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--clr-border); padding-top: 0.3rem;">
                <span style="font-weight: 700;">Remaining Balance Due:</span>
                <strong id="admin-prof-sal-remaining" style="color: var(--clr-primary); font-size: 0.9rem;">Rs 0</strong>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.6rem;">
              <div>
                <label style="font-size: 0.72rem; color: var(--clr-text-muted); display: block; margin-bottom: 0.2rem;">Service Charge (Rs)</label>
                <input type="number" class="form-input prof-sal-sc" min="0" value="0" style="padding: 0.35rem; width: 100%;">
              </div>
              <div>
                <label style="font-size: 0.72rem; color: var(--clr-primary); font-weight: 700; display: block; margin-bottom: 0.2rem;">Amount to Pay (Rs)</label>
                <input type="number" class="form-input prof-sal-pay-now" required min="1" value="0" style="padding: 0.35rem; width: 100%; border: 1px solid var(--clr-primary); font-weight: bold;">
              </div>
            </div>

            <button type="submit" class="btn btn-primary w-full" style="padding: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-weight: 600;">
              <span>💰 Pay &amp; Print Bill</span>
            </button>
          </form>
        </div>

        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">Payment History &amp; Vouchers</h4>
        <div style="max-height: 380px; overflow-y: auto;">
          <table class="table" style="width:100%; text-align:left; font-size: 0.85rem;">
            <thead>
              <tr>
                <th>Period</th>
                <th>Paid</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="prof-sal-body">
              <tr><td colspan="3" style="text-align:center;">Loading payments...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Default calendar to current month and selected profile date to today
  const now = new Date();
  profileCalendarYear = now.getFullYear();
  profileCalendarMonth = now.getMonth();
  selectedProfileDate = getLocalDateStr();

  loadProfileData(emp.id);
}

function updateProfileSalaryCalculations() {
  const form = document.getElementById('admin-profile-sal-form');
  if (!form || !activeEmployee) return;

  const basic = Number(activeEmployee.basicSalary || 0);
  const month = form.querySelector('.prof-sal-month').value;
  const year = String(form.querySelector('.prof-sal-year').value);
  const sc = Number(form.querySelector('.prof-sal-sc')?.value) || 0;

  // Filter attendance for this employee in the chosen month/year
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const empAtt = activeEmployeeAttendance.filter(a => a.date && a.date.startsWith(monthPrefix));
  const fullDays = empAtt.filter(a => a.status === 'Full Day').length;
  const halfDays = empAtt.filter(a => a.status === 'Half Day').length;

  const alreadyPaid = activeEmployeeSalaries
    .filter(p => String(p.month).padStart(2, '0') === String(month).padStart(2, '0') && String(p.year) === year)
    .reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);

  const breakdown = calculateSalaryBreakdown({
    basic,
    fullDays,
    halfDays,
    serviceCharge: sc,
    alreadyPaid
  });

  const daysEl = document.getElementById('admin-prof-sal-days');
  if (daysEl) daysEl.textContent = `${breakdown.fullDays} Full + ${breakdown.halfDays} Half (${breakdown.effectiveDays}d)`;

  const earnedEl = document.getElementById('admin-prof-sal-earned');
  if (earnedEl) earnedEl.textContent = `Rs ${breakdown.earnedBasic.toLocaleString()} (Rs ${breakdown.dailyRate.toFixed(2)}/d)`;

  const paidEl = document.getElementById('admin-prof-sal-paid');
  if (paidEl) paidEl.textContent = `Rs ${breakdown.alreadyPaid.toLocaleString()}`;

  const remainingEl = document.getElementById('admin-prof-sal-remaining');
  if (remainingEl) remainingEl.textContent = `Rs ${breakdown.remaining.toLocaleString()}`;

  const payNowInput = form.querySelector('.prof-sal-pay-now');
  if (payNowInput && (!payNowInput.dataset.userEdited || payNowInput.dataset.userEdited === 'false')) {
    payNowInput.value = breakdown.remaining;
  }
}

function loadProfileData(employeeId) {
  if (unsubProfileAttendance) { unsubProfileAttendance(); }
  if (unsubSalary) { unsubSalary(); }

  // Subscribe to this employee's attendance records
  unsubProfileAttendance = subscribeAttendance(employeeId, (attendanceList) => {
    activeEmployeeAttendance = attendanceList;
    renderProfileAttendanceSection();
    updateProfileSalaryCalculations();
  });

  // Subscribe to this employee's salary payments
  unsubSalary = subscribeSalaryPayments(employeeId, (payments) => {
    activeEmployeeSalaries = payments;
    const tbody = document.getElementById('prof-sal-body');
    let totalPaid = 0;

    if (payments.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--clr-text-muted);">No payment records found.</td></tr>';
    } else {
      if (tbody) tbody.innerHTML = payments.map(pay => {
        totalPaid += Number(pay.totalPaid || 0);
        const daysLabel = pay.effectiveDays !== undefined 
          ? `${pay.effectiveDays}d worked` 
          : (pay.fullDays !== undefined ? `${pay.fullDays + (pay.halfDays || 0) * 0.5}d worked` : '');

        return `
          <tr>
            <td>
              <strong>${pay.month}/${pay.year}</strong>
              <br><small style="color:var(--clr-text-muted)">${pay.paymentType || 'Salary Payment'}</small>
            </td>
            <td>
              <strong style="color: #16a34a;">Rs ${Number(pay.totalPaid).toLocaleString()}</strong>
              ${daysLabel ? `<br><small style="color:var(--clr-text-muted)">${daysLabel}</small>` : ''}
            </td>
            <td style="text-align:right; white-space: nowrap;">
              <button class="btn btn-sm btn-ghost btn-print-sal" data-id="${pay.id}" title="Print Salary Bill" style="color: var(--clr-primary); border: 1px solid var(--clr-border); padding: 0.2rem 0.5rem; margin-right: 0.25rem;">
                🖨️ Bill
              </button>
              <button class="btn btn-sm btn-ghost btn-del-sal" data-id="${pay.id}" title="Delete Payment Record" style="color: #dc2626; border: 1px solid var(--clr-border); padding: 0.2rem 0.5rem;">
                ✕
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    const paidEl = document.getElementById('stat-total-paid');
    if (paidEl) paidEl.textContent = `Rs ${totalPaid.toLocaleString()}`;

    updateProfileSalaryCalculations();
  });
}

function renderProfileAttendanceSection() {
  const container = document.getElementById('prof-att-section-container');
  if (!container) return;

  const todayStr = getLocalDateStr();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthName = monthNames[profileCalendarMonth];
  const viewedMonthStr = `${profileCalendarYear}-${String(profileCalendarMonth + 1).padStart(2, '0')}`;

  // Calculate stats for the viewed month
  let presentCount = 0;
  let absentCount = 0;
  activeEmployeeAttendance.forEach(att => {
    if (att.date && att.date.startsWith(viewedMonthStr)) {
      if (att.status === 'Full Day') presentCount++;
      if (att.status === 'Half Day') presentCount += 0.5;
      if (att.status === 'Absent') absentCount++;
    }
  });

  const presentEl = document.getElementById('stat-days-present');
  if (presentEl) presentEl.textContent = presentCount;
  const absentEl = document.getElementById('stat-days-absent');
  if (absentEl) absentEl.textContent = absentCount;

  const presentLabel = document.getElementById('stat-present-label');
  if (presentLabel) presentLabel.textContent = `Days Present (${currentMonthName} ${profileCalendarYear})`;
  const absentLabel = document.getElementById('stat-absent-label');
  if (absentLabel) absentLabel.textContent = `Days Absent (${currentMonthName} ${profileCalendarYear})`;

  // Current status of selectedProfileDate
  const currentRecord = activeEmployeeAttendance.find(a => a.date === selectedProfileDate);
  const selectedDateStatus = currentRecord?.status || null;
  const rel = getDateRelation(selectedProfileDate);
  const formattedSelectedDate = formatDisplayDate(selectedProfileDate);

  let dateTypeBadge = '';
  if (rel.type === 'today') {
    dateTypeBadge = `<span class="badge-today-date" style="font-size: 0.75rem;">Today</span>`;
  } else if (rel.type === 'past') {
    dateTypeBadge = `<span class="badge-past-date" style="font-size: 0.75rem;">${rel.text}</span>`;
  }

  container.innerHTML = `
    <!-- Month Navigation -->
    <div class="cal-month-nav">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <button class="btn btn-sm btn-ghost" id="prof-cal-prev-month" title="Previous Month" style="padding: 0.3rem 0.6rem; border: 1px solid var(--clr-border);">◀</button>
        <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">${currentMonthName} ${profileCalendarYear}</h3>
        <button class="btn btn-sm btn-ghost" id="prof-cal-next-month" title="Next Month" style="padding: 0.3rem 0.6rem; border: 1px solid var(--clr-border);">▶</button>
      </div>
      <button class="btn btn-sm btn-ghost" id="prof-cal-current-month" style="border: 1px solid var(--clr-border); font-size: 0.8rem;">Current Month</button>
    </div>

    <!-- Mark / Edit Attendance Panel (Supports Previous Dates) -->
    <div class="prof-att-mark-box">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--clr-text);">Date:</span>
          <input type="date" id="prof-att-date-input" class="form-input" style="padding: 0.25rem 0.5rem; font-size: 0.82rem; width: auto;" max="${todayStr}" value="${selectedProfileDate}">
          ${dateTypeBadge}
        </div>
        <div style="font-size: 0.82rem; color: var(--clr-text-muted);">
          Current: <strong>${selectedDateStatus || 'Not Recorded'}</strong>
        </div>
      </div>

      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <span style="font-size: 0.82rem; color: var(--clr-text-muted); margin-right: 0.25rem;">Mark as:</span>
        <button class="btn btn-sm ${selectedDateStatus === 'Full Day' ? 'btn-att-status-full' : 'btn-ghost'} btn-prof-att-mark" data-status="Full Day" style="border: 1px solid var(--clr-border); color: #16a34a; padding: 0.3rem 0.65rem;">
          ✓ Full Day
        </button>
        <button class="btn btn-sm ${selectedDateStatus === 'Half Day' ? 'btn-att-status-half' : 'btn-ghost'} btn-prof-att-mark" data-status="Half Day" style="border: 1px solid var(--clr-border); color: #ca8a04; padding: 0.3rem 0.65rem;">
          ◐ Half Day
        </button>
        <button class="btn btn-sm ${selectedDateStatus === 'Absent' ? 'btn-att-status-absent' : 'btn-ghost'} btn-prof-att-mark" data-status="Absent" style="border: 1px solid var(--clr-border); color: #dc2626; padding: 0.3rem 0.65rem;">
          ✕ Absent
        </button>
        ${selectedDateStatus ? `
          <button class="btn btn-sm btn-ghost btn-prof-att-clear" title="Remove attendance record for this date" style="color: #dc2626; border: 1px dashed #dc2626; margin-left: auto; padding: 0.3rem 0.6rem;">
            Clear Record
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Calendar Grid -->
    <div id="prof-calendar-grid-wrapper">
      ${renderCalendarHTML(profileCalendarYear, profileCalendarMonth, activeEmployeeAttendance, selectedProfileDate)}
    </div>

    <div style="margin-top: 0.75rem; font-size: 0.78rem; color: var(--clr-text-muted); display: flex; align-items: center; justify-content: space-between;">
      <span>💡 Tip: Click any date on the calendar to select that day and mark attendance.</span>
    </div>
  `;
}

function renderCalendarHTML(year, month, attendanceList, selectedDate) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const todayStr = getLocalDateStr();

  const attMap = {};
  attendanceList.forEach(att => {
    attMap[att.date] = att.status;
  });

  let html = `
    <div class="calendar-container">
      <div class="calendar-header">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div>
        <div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div class="calendar-grid">
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const status = attMap[dateStr];
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;

    let pillHtml = '';
    if (status === 'Full Day') pillHtml = '<div class="cal-status-pill cal-full">Full</div>';
    else if (status === 'Half Day') pillHtml = '<div class="cal-status-pill cal-half">Half</div>';
    else if (status === 'Absent') pillHtml = '<div class="cal-status-pill cal-absent">Absent</div>';

    const dayClasses = [
      'calendar-day',
      isFuture ? 'future-day' : 'clickable',
      isSelected ? 'selected-day' : '',
      isToday ? 'today-day' : ''
    ].filter(Boolean).join(' ');

    const titleTooltip = isFuture 
      ? `${dateStr} (Future)` 
      : status 
        ? `${dateStr}: ${status} (Click to edit)` 
        : `${dateStr} (Click to mark attendance)`;

    html += `
      <div class="${dayClasses}" data-date="${dateStr}" title="${titleTooltip}">
        <div class="calendar-date-number">${d}</div>
        ${pillHtml}
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;
  return html;
}

export function destroyEmployeeDetailsPage() {
  if (unsubEmployees) { unsubEmployees(); unsubEmployees = null; }
  if (unsubAllAttendance) { unsubAllAttendance(); unsubAllAttendance = null; }
  if (unsubAllSalaries) { unsubAllSalaries(); unsubAllSalaries = null; }
  if (unsubProfileAttendance) { unsubProfileAttendance(); unsubProfileAttendance = null; }
  if (unsubSalary) { unsubSalary(); unsubSalary = null; }
  activeEmployee = null;
  document.getElementById('admin-emp-modal-overlay')?.remove();
}
