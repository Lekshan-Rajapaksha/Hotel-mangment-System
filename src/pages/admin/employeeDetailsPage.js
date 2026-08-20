import { 
  subscribeEmployees, 
  subscribeAttendance, 
  subscribeSalaryPayments,
  deleteSalaryPayment
} from '../../services/employeeService.js';

let unsubEmployees = null;
let unsubAttendance = null;
let unsubSalary = null;
let currentEmployees = [];

export function renderEmployeeDetailsPage(container) {
  // We'll maintain two main views: the grid, and the detailed profile.
  container.innerHTML = `
    <div id="admin-emp-grid-view">
      <div class="page-header">
        <h2 class="page-title">Employees Details (Admin)</h2>
      </div>
      <div class="employee-grid" id="admin-employee-list-body">
        <div style="text-align:center; grid-column: 1 / -1;">Loading...</div>
      </div>
    </div>
    
    <div id="admin-emp-profile-view" style="display:none;">
      <button class="btn btn-ghost" id="btn-back-to-grid" style="margin-bottom: 1rem;">← Back to Employees</button>
      <div id="profile-content-area"></div>
    </div>
  `;

  bindEvents();
  loadData();
}

function bindEvents() {
  document.getElementById('btn-back-to-grid').addEventListener('click', () => {
    document.getElementById('admin-emp-profile-view').style.display = 'none';
    document.getElementById('admin-emp-grid-view').style.display = 'block';
    
    // Clean up profile subscriptions
    if (unsubAttendance) { unsubAttendance(); unsubAttendance = null; }
    if (unsubSalary) { unsubSalary(); unsubSalary = null; }
  });

  document.getElementById('admin-employee-list-body').addEventListener('click', (e) => {
    const card = e.target.closest('.employee-card');
    if (!card) return;
    
    const id = card.dataset.id;
    const emp = currentEmployees.find(e => e.id === id);
    if (emp) {
      openProfileView(emp);
    }
  });

  document.getElementById('profile-content-area').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-del-sal')) {
      const payId = e.target.dataset.id;
      if (confirm('Are you sure you want to delete this salary payment? This action cannot be undone.')) {
        try {
          await deleteSalaryPayment(payId);
        } catch (err) {
          console.error('Failed to delete payment', err);
          alert('Error deleting payment.');
        }
      }
    }
  });
}

function loadData() {
  unsubEmployees = subscribeEmployees((employees) => {
    currentEmployees = employees;
    const grid = document.getElementById('admin-employee-list-body');
    if (!grid) return;

    if (employees.length === 0) {
      grid.innerHTML = '<div style="text-align:center; grid-column: 1 / -1;">No employees found.</div>';
      return;
    }

    grid.innerHTML = employees.map(emp => {
      const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      return `
      <div class="employee-card" data-id="${emp.id}">
        <div class="emp-card-header">
          <div class="emp-avatar">${initials}</div>
          <div class="emp-info">
            <h3>${emp.name}</h3>
            <span class="badge-blue emp-role" style="padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${emp.role || 'Employee'}</span>
          </div>
        </div>
        <div class="emp-details" style="margin-top: 1rem;">
          <div>📞 ${emp.phone}</div>
          <div>💰 Rs ${Number(emp.basicSalary).toLocaleString()} (Basic)</div>
        </div>
        <div style="margin-top: auto; padding-top: 1rem; color: var(--clr-primary); font-size: 0.85rem; font-weight: 500;">
          View Full Profile →
        </div>
      </div>
    `}).join('');
  });
}

function openProfileView(emp) {
  document.getElementById('admin-emp-grid-view').style.display = 'none';
  document.getElementById('admin-emp-profile-view').style.display = 'block';
  
  const contentArea = document.getElementById('profile-content-area');
  const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  contentArea.innerHTML = `
    <div class="profile-header-section">
      <div class="profile-avatar">${initials}</div>
      <div class="profile-title">
        <h2>${emp.name}</h2>
        <span class="badge-blue" style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-weight: 500; display: inline-block; margin-top: 0.5rem;">${emp.role || 'Employee'}</span>
        <p>📞 ${emp.phone} &nbsp;|&nbsp; 💰 Basic: Rs ${Number(emp.basicSalary).toLocaleString()}</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card-title">Total Paid</div>
        <div class="stat-card-value" id="stat-total-paid">Rs 0</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Days Present</div>
        <div class="stat-card-value" id="stat-days-present" style="color: #16a34a;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Days Absent</div>
        <div class="stat-card-value" id="stat-days-absent" style="color: #dc2626;">0</div>
      </div>
    </div>

    <div class="profile-tables-layout">
      <!-- Attendance Column -->
      <div class="card">
        <h3 style="margin-top:0; margin-bottom: 1rem;">Attendance (This Month)</h3>
        <div id="prof-att-calendar">
          <div style="text-align:center;">Loading calendar...</div>
        </div>
      </div>

      <!-- Salary Column -->
      <div class="card">
        <h3 style="margin-top:0; margin-bottom: 1rem;">Salary History</h3>
        <div style="max-height: 400px; overflow-y: auto;">
          <table class="table" style="width:100%; text-align:left;">
            <thead>
              <tr>
                <th>Period</th>
                <th>Paid (Rs)</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="prof-sal-body">
              <tr><td colspan="2" style="text-align:center;">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  loadProfileData(emp.id);
}

function loadProfileData(employeeId) {
  if (unsubAttendance) { unsubAttendance(); }
  if (unsubSalary) { unsubSalary(); }

  unsubAttendance = subscribeAttendance(employeeId, (attendanceList) => {
    let presentCount = 0;
    let absentCount = 0;

    // Calculate stats
    attendanceList.forEach(att => {
      if (att.status === 'Full Day') presentCount++;
      if (att.status === 'Half Day') presentCount += 0.5;
      if (att.status === 'Absent') absentCount++;
    });

    const presentEl = document.getElementById('stat-days-present');
    if (presentEl) presentEl.textContent = presentCount;
    
    const absentEl = document.getElementById('stat-days-absent');
    if (absentEl) absentEl.textContent = absentCount;

    // Render Calendar
    const calContainer = document.getElementById('prof-att-calendar');
    if (calContainer) {
      calContainer.innerHTML = renderCalendar(attendanceList);
    }
  });

  unsubSalary = subscribeSalaryPayments(employeeId, (payments) => {
    const tbody = document.getElementById('prof-sal-body');
    let totalPaid = 0;

    if (payments.length === 0) {
      if(tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--clr-text-muted);">No payment records found.</td></tr>';
    } else {
      if(tbody) tbody.innerHTML = payments.map(pay => {
        totalPaid += Number(pay.totalPaid || 0);
        return `
        <tr>
          <td>${pay.month}/${pay.year}</td>
          <td><strong>${Number(pay.totalPaid).toLocaleString()}</strong><br><small style="color:var(--clr-text-muted)">Basic: ${pay.basic} + SC: ${pay.serviceCharge}</small></td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-ghost btn-del-sal" data-id="${pay.id}" style="color: #dc2626; padding: 0.25rem 0.5rem; min-width: auto;">✕</button>
          </td>
        </tr>
      `}).join('');
    }

    const paidEl = document.getElementById('stat-total-paid');
    if (paidEl) paidEl.textContent = `Rs ${totalPaid.toLocaleString()}`;
  });
}

export function destroyEmployeeDetailsPage() {
  if (unsubEmployees) { unsubEmployees(); unsubEmployees = null; }
  if (unsubAttendance) { unsubAttendance(); unsubAttendance = null; }
  if (unsubSalary) { unsubSalary(); unsubSalary = null; }
}

function renderCalendar(attendanceList) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const attMap = {};
  attendanceList.forEach(att => { attMap[att.date] = att.status; });

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
    
    let pillHtml = '';
    if (status === 'Full Day') pillHtml = '<div class="cal-status-pill cal-full">Full</div>';
    else if (status === 'Half Day') pillHtml = '<div class="cal-status-pill cal-half">Half</div>';
    else if (status === 'Absent') pillHtml = '<div class="cal-status-pill cal-absent">Absent</div>';

    html += `
      <div class="calendar-day">
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
