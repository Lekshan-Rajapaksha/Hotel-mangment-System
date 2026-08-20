import { 
  subscribeEmployees, 
  addEmployee, 
  addAttendance, 
  paySalary,
  subscribeAttendanceByMonth,
  subscribeAllSalaryPayments
} from '../../services/employeeService.js';
import { showToast } from '../../utils/toast.js';

let unsubEmployees = null;
let unsubMonthlyAtt = null;
let unsubAllSalaries = null;
let currentEmployees = [];
let todaysAttendance = {};
let allSalaries = [];

export function renderEmployeePage(container) {
  container.innerHTML = `
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
          <label class="form-label">Monthly Basic Salary (Rs)</label>
          <input type="number" id="emp-basic" class="form-input" required min="0" />
        </div>

        <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end; gap:0.5rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-ghost" id="cancel-add-employee">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Employee</button>
        </div>
      </form>
    </div>

    <div class="employee-grid" id="employee-list-body">
      <div style="text-align:center; grid-column: 1 / -1;">Loading...</div>
    </div>
  `;

  bindEvents();
  loadData();
}

function bindEvents() {
  const addFormContainer = document.getElementById('inline-add-employee');
  document.getElementById('btn-toggle-add').onclick = () => { addFormContainer.style.display = 'block'; };
  document.getElementById('cancel-add-employee').onclick = () => { addFormContainer.style.display = 'none'; };

  document.getElementById('add-employee-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('emp-name').value;
    const phone = document.getElementById('emp-phone').value;
    const role = document.getElementById('emp-role').value;
    const basicSalary = Number(document.getElementById('emp-basic').value);

    try {
      await addEmployee({ name, phone, role, basicSalary });
      showToast('Employee added successfully', 'success');
      addFormContainer.style.display = 'none';
      e.target.reset();
    } catch (err) {
      showToast('Error adding employee', 'error');
    }
  };

  // Event delegation for table buttons (Attendance & Salary)
  document.getElementById('employee-list-body').addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    const emp = currentEmployees.find(emp => emp.id === id);
    if (!emp) return;

    // 1-Click Attendance Handlers
    if (e.target.classList.contains('btn-att-full') || 
        e.target.classList.contains('btn-att-half') || 
        e.target.classList.contains('btn-att-absent')) {
      
      const date = new Date().toISOString().split('T')[0];
      let status = 'Full Day';
      if (e.target.classList.contains('btn-att-half')) status = 'Half Day';
      if (e.target.classList.contains('btn-att-absent')) status = 'Absent';

      try {
        await addAttendance(id, date, status);
        showToast(`${status} marked for ${emp.name} today`, 'success');
      } catch (err) {
        showToast('Error recording attendance', 'error');
      }
    } 
    // Toggle Inline Salary Form
    else if (e.target.classList.contains('btn-toggle-sal')) {
      const formDiv = document.getElementById(`sal-form-${id}`);
      if (formDiv.classList.contains('active')) {
        formDiv.classList.remove('active');
      } else {
        // Close others
        document.querySelectorAll('.inline-form').forEach(el => el.classList.remove('active'));
        formDiv.classList.add('active');
        
        // Trigger calculation calculation for dynamic amounts
        const scInput = formDiv.querySelector('.sal-sc');
        if (scInput) scInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  // Calculate remaining salary dynamically when inputs change
  document.getElementById('employee-list-body').addEventListener('input', (e) => {
    if (e.target.classList.contains('sal-month') || 
        e.target.classList.contains('sal-year') || 
        e.target.classList.contains('sal-sc')) {
      
      const form = e.target.closest('form');
      if (!form) return;
      
      const id = form.dataset.id;
      const basic = Number(form.dataset.basic) || 0;
      const month = form.querySelector('.sal-month').value;
      const year = String(form.querySelector('.sal-year').value);
      const sc = Number(form.querySelector('.sal-sc').value) || 0;

      const totalOwed = basic + sc;
      
      const alreadyPaid = allSalaries
        .filter(p => p.employeeId === id && p.month === month && p.year === year)
        .reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);
      
      const remaining = totalOwed - alreadyPaid;

      form.querySelector('.sal-already-paid').textContent = 'Rs ' + alreadyPaid.toLocaleString();
      form.querySelector('.sal-remaining').textContent = 'Rs ' + Math.max(0, remaining).toLocaleString();
      
      // Auto-update pay now field to remaining amount
      const payNowInput = form.querySelector('.sal-pay-now');
      payNowInput.value = Math.max(0, remaining);
    }
  });

  // Handle Salary Form Submission
  document.getElementById('employee-list-body').addEventListener('submit', async (e) => {
    if (e.target.classList.contains('sal-inline-form')) {
      e.preventDefault();
      const form = e.target;
      const id = form.dataset.id;
      const basic = Number(form.dataset.basic);
      const month = form.querySelector('.sal-month').value;
      const year = form.querySelector('.sal-year').value;
      const sc = Number(form.querySelector('.sal-sc').value);
      const payNow = Number(form.querySelector('.sal-pay-now').value);
      
      try {
        await paySalary(id, { 
          month, 
          year, 
          basic, 
          serviceCharge: sc, 
          totalPaid: payNow, 
          date: new Date().toISOString() 
        });
        showToast('Salary payment recorded', 'success');
        document.getElementById(`sal-form-${id}`).classList.remove('active');
        form.reset();
      } catch (err) {
        showToast('Error recording salary', 'error');
      }
    }
  });
}

function loadData() {
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const todayStr = new Date().toISOString().split('T')[0];

  unsubMonthlyAtt = subscribeAttendanceByMonth(currentMonthStr, (attendanceList) => {
    todaysAttendance = {};
    attendanceList.forEach(att => {
      if (att.date === todayStr) {
        todaysAttendance[att.employeeId] = att.status;
      }
    });
    renderEmployeeGrid();
  });

  unsubAllSalaries = subscribeAllSalaryPayments((payments) => {
    allSalaries = payments;
  });

  unsubEmployees = subscribeEmployees((employees) => {
    currentEmployees = employees;
    renderEmployeeGrid();
  });
}

function renderEmployeeGrid() {
  const tbody = document.getElementById('employee-list-body');
  if (!tbody) return;

  if (currentEmployees.length === 0) {
    tbody.innerHTML = '<div style="text-align:center; grid-column: 1 / -1;">No employees found.</div>';
    return;
  }

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYear = new Date().getFullYear();

  const monthOptions = `
    <option value="01">Jan</option><option value="02">Feb</option><option value="03">Mar</option>
    <option value="04">Apr</option><option value="05">May</option><option value="06">Jun</option>
    <option value="07">Jul</option><option value="08">Aug</option><option value="09">Sep</option>
    <option value="10">Oct</option><option value="11">Nov</option><option value="12">Dec</option>
  `.replace(`value="${currentMonth}"`, `value="${currentMonth}" selected`);

  tbody.innerHTML = currentEmployees.map(emp => {
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const todayStatus = todaysAttendance[emp.id];
    
    // Style active attendance buttons
    const fullActive = todayStatus === 'Full Day' ? 'background: rgba(22, 163, 74, 0.2); color: #15803d; border-color: #16a34a;' : '';
    const halfActive = todayStatus === 'Half Day' ? 'background: rgba(202, 138, 4, 0.2); color: #a16207; border-color: #ca8a04;' : '';
    const absentActive = todayStatus === 'Absent' ? 'background: rgba(220, 38, 38, 0.2); color: #b91c1c; border-color: #dc2626;' : '';

    return `
      <div class="employee-card" data-id="${emp.id}">
        <div class="emp-card-header">
          <div class="emp-avatar">${initials}</div>
          <div class="emp-info">
            <h3>${emp.name}</h3>
            <span class="badge-blue emp-role" style="padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${emp.role || 'Employee'}</span>
          </div>
        </div>
        <div class="emp-details">
          <div>📞 ${emp.phone}</div>
          <div>💰 Rs ${Number(emp.basicSalary).toLocaleString()} (Basic)</div>
        </div>
        <div class="emp-card-actions" style="flex-direction: column;">
          <div style="font-size: 0.75rem; color: var(--clr-text-muted); margin-bottom: 0.25rem;">Mark Today's Attendance:</div>
          <div style="display:flex; gap: 0.5rem; width: 100%;">
            <button class="btn btn-sm btn-ghost btn-att-full" data-id="${emp.id}" style="flex:1; border: 1px solid var(--clr-border); color: #16a34a; padding: 0.25rem; ${fullActive}">Full</button>
            <button class="btn btn-sm btn-ghost btn-att-half" data-id="${emp.id}" style="flex:1; border: 1px solid var(--clr-border); color: #ca8a04; padding: 0.25rem; ${halfActive}">Half</button>
            <button class="btn btn-sm btn-ghost btn-att-absent" data-id="${emp.id}" style="flex:1; border: 1px solid var(--clr-border); color: #dc2626; padding: 0.25rem; ${absentActive}">Absent</button>
          </div>
          
          <button class="btn btn-sm btn-primary btn-toggle-sal" data-id="${emp.id}" style="margin-top: 0.5rem; width: 100%;">Pay Salary</button>
          
          <div class="inline-form" id="sal-form-${emp.id}">
            <form class="sal-inline-form" data-id="${emp.id}" data-basic="${emp.basicSalary}">
              <div style="display:flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <select class="form-input sal-month" required style="padding: 0.25rem; flex: 1;">
                  ${monthOptions}
                </select>
                <input type="number" class="form-input sal-year" required style="padding: 0.25rem; flex: 1;" value="${currentYear}">
              </div>
              <label style="font-size: 0.75rem; color: var(--clr-text-muted);">Service Charge (Rs)</label>
              <input type="number" class="form-input sal-sc" required min="0" value="0" style="padding: 0.25rem; margin-bottom: 0.75rem;">
              
              <!-- Dynamic Partial Payments UI -->
              <div style="font-size: 0.75rem; display:flex; justify-content:space-between; margin-bottom: 0.25rem;">
                <span style="color:var(--clr-text-muted);">Already Paid This Month:</span>
                <strong class="sal-already-paid">Rs 0</strong>
              </div>
              <div style="font-size: 0.75rem; display:flex; justify-content:space-between; margin-bottom: 0.75rem;">
                <span style="color:var(--clr-text-muted);">Remaining Balance:</span>
                <strong class="sal-remaining">Rs 0</strong>
              </div>

              <label style="font-size: 0.75rem; color: var(--clr-primary); font-weight:bold;">Amount to Pay Now (Rs)</label>
              <input type="number" class="form-input sal-pay-now" required min="1" value="${emp.basicSalary}" style="padding: 0.25rem; margin-bottom: 0.75rem; border: 1px solid var(--clr-primary);">

              <button type="submit" class="btn btn-sm btn-primary" style="width: 100%;">Record Payment</button>
            </form>
          </div>
        </div>
      </div>
    `}).join('');
}

export function destroyEmployeePage() {
  if (unsubEmployees) {
    unsubEmployees();
    unsubEmployees = null;
  }
  if (unsubMonthlyAtt) {
    unsubMonthlyAtt();
    unsubMonthlyAtt = null;
  }
  if (unsubAllSalaries) {
    unsubAllSalaries();
    unsubAllSalaries = null;
  }
}
