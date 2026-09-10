// src/pages/admin/analyticsPage.js — Admin analytics with profit, income, expenses & payroll summary
import { subscribeAllBookings } from '../../services/bookingService.js';
import { subscribeUtilityBills } from '../../services/utilityBillService.js';
import { subscribeAllSalaryPayments, subscribeEmployees } from '../../services/employeeService.js';
import { openPrintSalaryBill } from '../../components/printSalaryBill.js';
import { formatCurrency, formatDate, nightCount, MONTHS } from '../../utils/dateHelpers.js';
import Chart from 'chart.js/auto';

let charts = {};
let unsubBookings = null;
let unsubBills = null;
let unsubSalaries = null;
let unsubEmployees = null;

let allBookings = [];
let allUtilityBills = [];
let allSalaryPayments = [];
let allEmployees = [];

let activeExpenseTab = 'payroll'; // 'payroll' | 'bills' | 'all'

export function renderAnalyticsPage(container) {
  const currentYear = new Date().getFullYear();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📊 Analytics & Financial Overview</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">
          Business insights, income, expenses, net profit, payroll breakdown, and hotel performance metrics
        </div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
        <select class="form-control" id="analytics-month" style="width:160px">
          <option value="all" selected>All Months (${currentYear})</option>
          ${MONTHS.map((m, idx) => `<option value="${idx}">${m}</option>`).join('')}
        </select>
        <select class="form-control" id="analytics-year" style="width:110px">
          ${[0, 1, 2].map(i => {
            const y = currentYear - i;
            return `<option value="${y}" ${i === 0 ? 'selected' : ''}>${y}</option>`;
          }).join('')}
        </select>
      </div>
    </div>
    <div class="page-body">

      <!-- Hero Financial KPI Cards -->
      <div class="financial-hero-grid">
        <!-- Income Card -->
        <div class="stat-card" id="card-fin-income">
          <div class="stat-icon green">💰</div>
          <div style="flex:1">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <div class="stat-label">Total Income (Bookings)</div>
              <span class="badge badge-success" style="font-size:0.65rem">Revenue</span>
            </div>
            <div class="stat-value" id="fin-income" style="color:var(--clr-success)">—</div>
            <div class="stat-sub" id="fin-income-sub" style="color:var(--clr-text-muted)">Loading bookings...</div>
          </div>
        </div>

        <!-- Expenses Card -->
        <div class="stat-card" id="card-fin-expenses">
          <div class="stat-icon red">💸</div>
          <div style="flex:1">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <div class="stat-label">Total Expenses</div>
              <span class="badge badge-danger" style="font-size:0.65rem">Outflow</span>
            </div>
            <div class="stat-value" id="fin-expenses" style="color:var(--clr-danger)">—</div>
            <div class="stat-sub" id="fin-expenses-sub" style="color:var(--clr-text-muted)">Loading expenses...</div>
          </div>
        </div>

        <!-- Profit Card -->
        <div class="stat-card profit-positive" id="card-fin-profit">
          <div class="stat-icon teal" id="fin-profit-icon">💎</div>
          <div style="flex:1">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <div class="stat-label">Net Profit</div>
              <span class="badge badge-primary" id="fin-profit-badge" style="font-size:0.65rem">Profit</span>
            </div>
            <div class="stat-value" id="fin-profit" style="color:var(--clr-primary)">—</div>
            <div class="stat-sub" id="fin-profit-sub">Margin: —</div>
          </div>
        </div>
      </div>

      <!-- Secondary Breakdown & Operations Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon amber">⚡</div>
          <div>
            <div class="stat-label">Utility Bills</div>
            <div class="stat-value" id="stat-bills">—</div>
            <div class="stat-sub" id="stat-bills-sub" style="color:var(--clr-text-muted)">0 bills</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon purple">👥</div>
          <div>
            <div class="stat-label">Salaries Paid</div>
            <div class="stat-value" id="stat-salaries">—</div>
            <div class="stat-sub" id="stat-salaries-sub" style="color:var(--clr-text-muted)">0 payments</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon blue">📋</div>
          <div>
            <div class="stat-label">Total Bookings</div>
            <div class="stat-value" id="stat-bookings">—</div>
            <div class="stat-sub" id="stat-bookings-sub" style="color:var(--clr-text-muted)">0 active</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">🛏️</div>
          <div>
            <div class="stat-label">Occupancy Rate</div>
            <div class="stat-value" id="stat-occ">—</div>
            <div class="stat-sub" id="stat-occ-sub" style="color:var(--clr-text-muted)">Across 7 rooms</div>
          </div>
        </div>
      </div>

      <!-- Charts Row 1: Income/Expenses/Profit & Expense Breakdown -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-title">📊 Monthly Financial Performance (Income vs Expenses vs Profit)</div>
          <div style="height: 300px; position:relative">
            <canvas id="chart-finance"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">💸 Expense Breakdown (Bills & Salaries)</div>
          <div style="height: 300px; position:relative">
            <canvas id="chart-expense-breakdown"></canvas>
          </div>
        </div>
      </div>

      <!-- Detailed Expense Summary & Payroll Disbursal Section -->
      <div class="card" style="margin-bottom:28px" id="section-expense-summary">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
          <div>
            <div class="card-title">🧾 Expense Summary & Payroll Disbursals</div>
            <div style="font-size:0.75rem; color:var(--clr-text-muted)">
              Audit who got paid, salary amounts, and utility operational costs for the selected period
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap">
            <button class="tab-pill ${activeExpenseTab === 'payroll' ? 'active' : ''}" id="btn-tab-payroll">
              👥 Who Got Paid (<span id="count-payroll-badge">0</span>)
            </button>
            <button class="tab-pill ${activeExpenseTab === 'bills' ? 'active' : ''}" id="btn-tab-bills">
              ⚡ Utility Bills (<span id="count-bills-badge">0</span>)
            </button>
            <button class="tab-pill ${activeExpenseTab === 'all' ? 'active' : ''}" id="btn-tab-all">
              📋 All Outflows (<span id="count-all-badge">0</span>)
            </button>
          </div>
        </div>

        <div style="padding:4px 0">
          <!-- Tab 1: Staff Payroll Summary (Who got paid how much) -->
          <div id="view-tab-payroll" style="display:${activeExpenseTab === 'payroll' ? 'block' : 'none'}">
            <div id="payroll-summary-content">Loading payroll records...</div>
          </div>

          <!-- Tab 2: Utility Bills Breakdown -->
          <div id="view-tab-bills" style="display:${activeExpenseTab === 'bills' ? 'block' : 'none'}">
            <div id="bills-summary-content">Loading utility bills...</div>
          </div>

          <!-- Tab 3: Unified Outflows -->
          <div id="view-tab-all" style="display:${activeExpenseTab === 'all' ? 'block' : 'none'}">
            <div id="all-outflows-content">Loading expense transactions...</div>
          </div>
        </div>
      </div>

      <!-- Charts Row 2: Occupancy & Room Popularity -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-title">🛏️ Occupancy Rate (%)</div>
          <div style="height: 300px; position:relative">
            <canvas id="chart-occupancy"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">🚪 Room Popularity</div>
          <div style="height: 300px; position:relative">
            <canvas id="chart-rooms"></canvas>
          </div>
        </div>
      </div>

      <!-- Charts Row 3: Meal Plan & Booking Sources -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-title">🍽️ Meal Plan Distribution</div>
          <div style="height: 280px; position:relative">
            <canvas id="chart-meals"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">📡 Booking Sources</div>
          <div style="height: 280px; position:relative">
            <canvas id="chart-sources"></canvas>
          </div>
        </div>
      </div>

      <!-- Weekly Trends & Cash Flow Summary -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px" class="desktop-split-grid">
        <div class="chart-card">
          <div class="chart-card-title">📈 Weekly Inflow Trends (This Month)</div>
          <div style="height: 260px; position:relative">
            <canvas id="chart-weekly"></canvas>
          </div>
        </div>
        <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; justify-content:space-between">
          <div class="card-header" style="margin-bottom:12px">
            <div class="card-title">💡 Cash Flow & Receivables Summary</div>
          </div>
          <div id="cashflow-summary-content" style="padding:4px 0">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

      <!-- Monthly Financial Statement Table -->
      <div class="card" style="margin-bottom:28px">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center">
          <div class="card-title">📑 Monthly Financial Statement (<span id="statement-year-label">${currentYear}</span>)</div>
          <div style="font-size:0.75rem; color:var(--clr-text-muted)">Detailed breakdown of revenue, expenses & margins</div>
        </div>
        <div id="financial-statement-container" style="overflow-x:auto">
          <!-- Populated dynamically -->
        </div>
      </div>

      <!-- Recent Bookings Summary -->
      <div class="card" style="margin-bottom:28px">
        <div class="card-header">
          <div class="card-title">👥 Recent Bookings Summary</div>
        </div>
        <div id="recent-summary">Loading…</div>
      </div>

    </div>
  `;

  // Bind filter change listeners
  const yearSelect = document.getElementById('analytics-year');
  const monthSelect = document.getElementById('analytics-month');

  yearSelect?.addEventListener('change', () => {
    const y = yearSelect.value;
    const optAll = monthSelect?.querySelector('option[value="all"]');
    if (optAll) optAll.textContent = `All Months (${y})`;
    const yrLabel = document.getElementById('statement-year-label');
    if (yrLabel) yrLabel.textContent = y;
    refreshData();
  });

  monthSelect?.addEventListener('change', () => {
    refreshData();
  });

  // Bind tab switching
  setupExpenseTabs();

  startSubscriptions();
}

function setupExpenseTabs() {
  const tabPayroll = document.getElementById('btn-tab-payroll');
  const tabBills = document.getElementById('btn-tab-bills');
  const tabAll = document.getElementById('btn-tab-all');

  const viewPayroll = document.getElementById('view-tab-payroll');
  const viewBills = document.getElementById('view-tab-bills');
  const viewAll = document.getElementById('view-tab-all');

  function setTab(tab) {
    activeExpenseTab = tab;
    [tabPayroll, tabBills, tabAll].forEach(b => b?.classList.remove('active'));
    if (tab === 'payroll') {
      tabPayroll?.classList.add('active');
      if (viewPayroll) viewPayroll.style.display = 'block';
      if (viewBills) viewBills.style.display = 'none';
      if (viewAll) viewAll.style.display = 'none';
    } else if (tab === 'bills') {
      tabBills?.classList.add('active');
      if (viewPayroll) viewPayroll.style.display = 'none';
      if (viewBills) viewBills.style.display = 'block';
      if (viewAll) viewAll.style.display = 'none';
    } else {
      tabAll?.classList.add('active');
      if (viewPayroll) viewPayroll.style.display = 'none';
      if (viewBills) viewBills.style.display = 'none';
      if (viewAll) viewAll.style.display = 'block';
    }
  }

  tabPayroll?.addEventListener('click', () => setTab('payroll'));
  tabBills?.addEventListener('click', () => setTab('bills'));
  tabAll?.addEventListener('click', () => setTab('all'));
}

function startSubscriptions() {
  destroyAnalyticsPage();

  // 1. Subscribe to Bookings
  unsubBookings = subscribeAllBookings((bookings) => {
    allBookings = bookings || [];
    refreshData();
  });

  // 2. Subscribe to Utility Bills
  unsubBills = subscribeUtilityBills((bills) => {
    allUtilityBills = bills || [];
    refreshData();
  });

  // 3. Subscribe to Salary Payments
  unsubSalaries = subscribeAllSalaryPayments((salaries) => {
    allSalaryPayments = salaries || [];
    refreshData();
  });

  // 4. Subscribe to Employees (to resolve names, roles, etc.)
  unsubEmployees = subscribeEmployees((employees) => {
    allEmployees = employees || [];
    refreshData();
  });
}

function refreshData() {
  const yearSelect = document.getElementById('analytics-year');
  const monthSelect = document.getElementById('analytics-month');
  if (!yearSelect) return;

  const year = parseInt(yearSelect.value || new Date().getFullYear());
  const monthFilter = monthSelect ? monthSelect.value : 'all'; // 'all' or '0'..'11'

  // Map employee IDs to employee records
  const empMap = {};
  allEmployees.forEach(e => { if (e && e.id) empMap[e.id] = e; });

  // 1. Filter Bookings
  const yearActiveBookings = allBookings.filter(b => {
    if (b.status !== 'active') return false;
    const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
    return !isNaN(ci.getTime()) && ci.getFullYear() === year;
  });

  // 2. Filter Utility Bills
  const yearBills = allUtilityBills.filter(b => {
    let d = null;
    if (b.date) {
      d = new Date(b.date);
      if (isNaN(d.getTime()) && typeof b.date === 'string') {
        const parts = b.date.split('-');
        if (parts.length >= 2) d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2] || '1'));
      }
    }
    if ((!d || isNaN(d.getTime())) && b.createdAt) {
      d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    }
    return d && !isNaN(d.getTime()) && d.getFullYear() === year;
  });

  // 3. Filter Salary Payments
  const yearSalaries = allSalaryPayments.filter(p => {
    let y = p.year ? parseInt(p.year) : null;
    if (y === null || isNaN(y)) {
      const d = p.date ? new Date(p.date) : (p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null));
      if (d && !isNaN(d.getTime())) y = d.getFullYear();
    }
    return y === year;
  });

  // Compute 12-month arrays
  const monthlyIncome = Array(12).fill(0);
  const monthlyBills = Array(12).fill(0);
  const monthlySalaries = Array(12).fill(0);

  yearActiveBookings.forEach(b => {
    const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
    const m = ci.getMonth();
    monthlyIncome[m] += Number(b.fullPrice || 0);
  });

  yearBills.forEach(b => {
    let d = null;
    if (b.date) {
      d = new Date(b.date);
      if (isNaN(d.getTime()) && typeof b.date === 'string') {
        const parts = b.date.split('-');
        if (parts.length >= 2) d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2] || '1'));
      }
    }
    if ((!d || isNaN(d.getTime())) && b.createdAt) {
      d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    }
    if (d && !isNaN(d.getTime())) {
      const m = d.getMonth();
      monthlyBills[m] += Number(b.amount || 0);
    }
  });

  yearSalaries.forEach(p => {
    let m = p.month !== undefined && p.month !== null ? (parseInt(p.month) - 1) : null;
    if (m === null || isNaN(m) || m < 0 || m > 11) {
      const d = p.date ? new Date(p.date) : (p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null));
      if (d && !isNaN(d.getTime())) m = d.getMonth();
    }
    if (m !== null && !isNaN(m) && m >= 0 && m <= 11) {
      monthlySalaries[m] += Number(p.totalPaid || p.amount || 0);
    }
  });

  const monthlyExpenses = monthlyBills.map((b, i) => b + monthlySalaries[i]);
  const monthlyProfit = monthlyIncome.map((inc, i) => inc - monthlyExpenses[i]);

  // Selected period totals (Year or specific month)
  let periodIncome = 0;
  let periodBills = 0;
  let periodSalaries = 0;
  let periodExpenses = 0;
  let periodProfit = 0;
  let periodBookings = [];
  let periodBillsList = [];
  let periodSalariesList = [];

  if (monthFilter === 'all') {
    periodIncome = monthlyIncome.reduce((s, v) => s + v, 0);
    periodBills = monthlyBills.reduce((s, v) => s + v, 0);
    periodSalaries = monthlySalaries.reduce((s, v) => s + v, 0);
    periodExpenses = periodBills + periodSalaries;
    periodProfit = periodIncome - periodExpenses;
    periodBookings = yearActiveBookings;
    periodBillsList = yearBills;
    periodSalariesList = yearSalaries;
  } else {
    const m = parseInt(monthFilter);
    periodIncome = monthlyIncome[m];
    periodBills = monthlyBills[m];
    periodSalaries = monthlySalaries[m];
    periodExpenses = monthlyExpenses[m];
    periodProfit = monthlyProfit[m];

    periodBookings = yearActiveBookings.filter(b => {
      const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
      return ci.getMonth() === m;
    });

    periodBillsList = yearBills.filter(b => {
      let d = null;
      if (b.date) {
        d = new Date(b.date);
        if (isNaN(d.getTime()) && typeof b.date === 'string') {
          const parts = b.date.split('-');
          if (parts.length >= 2) d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2] || '1'));
        }
      }
      if ((!d || isNaN(d.getTime())) && b.createdAt) {
        d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      }
      return d && d.getMonth() === m;
    });

    periodSalariesList = yearSalaries.filter(p => {
      let pm = p.month !== undefined && p.month !== null ? (parseInt(p.month) - 1) : null;
      if (pm === null || isNaN(pm) || pm < 0 || pm > 11) {
        const d = p.date ? new Date(p.date) : (p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null));
        if (d && !isNaN(d.getTime())) pm = d.getMonth();
      }
      return pm === m;
    });
  }

  // Update DOM Cards
  updateFinancialCards({
    income: periodIncome,
    expenses: periodExpenses,
    profit: periodProfit,
    bills: periodBills,
    salaries: periodSalaries,
    bookingsCount: periodBookings.length,
    billsCount: periodBillsList.length,
    salariesCount: periodSalariesList.length,
    bookings: periodBookings,
    year,
    monthFilter
  });

  // Update Expense Summary Section (Who got paid how much, utility bills, combined)
  renderExpenseSummarySection({
    salaries: periodSalariesList,
    bills: periodBillsList,
    totalSalaries: periodSalaries,
    totalBills: periodBills,
    totalExpenses: periodExpenses,
    empMap,
    year,
    monthFilter
  });

  // Update Cash Flow Summary Box
  updateCashFlowSummary(periodBookings, periodBills, periodSalaries, periodProfit);

  // Render Charts
  renderFinanceChart(monthlyIncome, monthlyExpenses, monthlyProfit);
  renderExpenseBreakdownChart(periodSalaries, periodBillsList);
  renderOccupancyChart(yearActiveBookings, year);
  renderRoomChart(periodBookings);
  renderMealChart(periodBookings);
  renderSourceChart(periodBookings);
  renderWeeklyChart(periodBookings);

  // Render Statement & Bookings Tables
  renderFinancialStatementTable(year, monthlyIncome, monthlyBills, monthlySalaries, monthlyExpenses, monthlyProfit, monthFilter);
  renderRecentSummary(periodBookings);
}

function updateFinancialCards({
  income,
  expenses,
  profit,
  bills,
  salaries,
  bookingsCount,
  billsCount,
  salariesCount,
  bookings,
  year,
  monthFilter
}) {
  const marginPct = income > 0 ? ((profit / income) * 100).toFixed(1) : (expenses > 0 ? '-100.0' : '0.0');
  const isProfit = profit >= 0;

  // 1. Income Card
  const incEl = document.getElementById('fin-income');
  const incSub = document.getElementById('fin-income-sub');
  if (incEl) incEl.textContent = formatCurrency(income);
  if (incSub) {
    const avg = bookingsCount ? Math.round(income / bookingsCount) : 0;
    incSub.textContent = `${bookingsCount} bookings · Avg ${formatCurrency(avg)}/booking`;
  }

  // 2. Expenses Card
  const expEl = document.getElementById('fin-expenses');
  const expSub = document.getElementById('fin-expenses-sub');
  if (expEl) expEl.textContent = formatCurrency(expenses);
  if (expSub) {
    expSub.textContent = `Bills: ${formatCurrency(bills)} · Salaries: ${formatCurrency(salaries)}`;
  }

  // 3. Profit Card
  const profitEl = document.getElementById('fin-profit');
  const profitSub = document.getElementById('fin-profit-sub');
  const profitCard = document.getElementById('card-fin-profit');
  const profitIcon = document.getElementById('fin-profit-icon');
  const profitBadge = document.getElementById('fin-profit-badge');

  if (profitEl) {
    profitEl.textContent = (profit < 0 ? '- ' : '') + formatCurrency(Math.abs(profit));
    profitEl.style.color = isProfit ? 'var(--clr-success)' : 'var(--clr-danger)';
  }
  if (profitSub) {
    profitSub.textContent = `Net Margin: ${marginPct}% · (${formatCurrency(income)} − ${formatCurrency(expenses)})`;
    profitSub.style.color = isProfit ? 'var(--clr-success)' : 'var(--clr-danger)';
  }
  if (profitCard) {
    profitCard.className = `stat-card ${isProfit ? 'profit-positive' : 'profit-negative'}`;
  }
  if (profitIcon) {
    profitIcon.textContent = isProfit ? '💎' : '⚠️';
    profitIcon.className = `stat-icon ${isProfit ? 'green' : 'red'}`;
  }
  if (profitBadge) {
    profitBadge.textContent = isProfit ? 'Net Profit' : 'Net Deficit';
    profitBadge.className = `badge ${isProfit ? 'badge-success' : 'badge-danger'}`;
  }

  // 4. Secondary cards
  const billsEl = document.getElementById('stat-bills');
  const billsSub = document.getElementById('stat-bills-sub');
  if (billsEl) billsEl.textContent = formatCurrency(bills);
  if (billsSub) billsSub.textContent = `${billsCount} utility bills recorded`;

  const salsEl = document.getElementById('stat-salaries');
  const salsSub = document.getElementById('stat-salaries-sub');
  if (salsEl) salsEl.textContent = formatCurrency(salaries);
  if (salsSub) salsSub.textContent = `${salariesCount} payroll transactions`;

  const bksEl = document.getElementById('stat-bookings');
  const bksSub = document.getElementById('stat-bookings-sub');
  if (bksEl) bksEl.textContent = bookingsCount;
  if (bksSub) {
    const paidCount = bookings.filter(b => !b.remaining || b.remaining <= 0).length;
    bksSub.textContent = `${paidCount} fully paid · ${bookingsCount - paidCount} with balance`;
  }

  // Occupancy rate calculation
  const occEl = document.getElementById('stat-occ');
  const occSub = document.getElementById('stat-occ-sub');
  const totalNights = bookings.reduce((s, b) => s + nightCount(b.checkIn, b.checkOut), 0);
  
  let daysInPeriod = 365;
  if (monthFilter !== 'all') {
    const m = parseInt(monthFilter);
    daysInPeriod = new Date(year, m + 1, 0).getDate();
  }
  const maxNights = 7 * daysInPeriod;
  const occPct = maxNights > 0 ? ((totalNights / maxNights) * 100).toFixed(1) : 0;

  if (occEl) occEl.textContent = `${occPct}%`;
  if (occSub) occSub.textContent = `${totalNights} room-nights booked of ${maxNights}`;
}

function renderExpenseSummarySection({
  salaries,
  bills,
  totalSalaries,
  totalBills,
  totalExpenses,
  empMap,
  year,
  monthFilter
}) {
  // Update badge counts on tab buttons
  const countPayrollBadge = document.getElementById('count-payroll-badge');
  const countBillsBadge = document.getElementById('count-bills-badge');
  const countAllBadge = document.getElementById('count-all-badge');
  if (countPayrollBadge) countPayrollBadge.textContent = salaries.length;
  if (countBillsBadge) countBillsBadge.textContent = bills.length;
  if (countAllBadge) countAllBadge.textContent = salaries.length + bills.length;

  // 1. Group salaries by employee ("Who got paid how much")
  const employeePayments = {};
  salaries.forEach(p => {
    const empId = p.employeeId || 'unknown';
    const emp = empMap[empId] || { name: p.employeeName || 'Staff Member', role: 'Staff' };
    if (!employeePayments[empId]) {
      employeePayments[empId] = {
        empId,
        name: emp.name || 'Staff Member',
        role: emp.role || 'Staff',
        basicSalary: emp.basicSalary || p.basic || 0,
        phone: emp.phone || '',
        totalPaid: 0,
        count: 0,
        payments: []
      };
    }
    employeePayments[empId].totalPaid += Number(p.totalPaid || p.amount || 0);
    employeePayments[empId].count += 1;
    employeePayments[empId].payments.push(p);
  });

  const empList = Object.values(employeePayments).sort((a, b) => b.totalPaid - a.totalPaid);

  // --- RENDER TAB 1: WHO GOT PAID HOW MUCH ---
  const payrollContainer = document.getElementById('payroll-summary-content');
  if (payrollContainer) {
    if (empList.length === 0) {
      payrollContainer.innerHTML = `
        <div style="padding:32px 16px; text-align:center; color:var(--clr-text-muted)">
          <div style="font-size:2rem; margin-bottom:8px">👥</div>
          <div style="font-weight:600">No salary payments recorded for this period</div>
          <div style="font-size:0.8rem; margin-top:4px">Disbursed employee payments will automatically appear here with exact breakdown and print vouchers.</div>
        </div>
      `;
    } else {
      let empRowsHtml = '';
      empList.forEach((item, i) => {
        const pct = totalSalaries > 0 ? ((item.totalPaid / totalSalaries) * 100).toFixed(1) : 0;
        const initials = item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';

        empRowsHtml += `
          <tr>
            <td data-label="Staff Member">
              <div style="display:flex; align-items:center; gap:10px">
                <div style="width:36px; height:36px; border-radius:50%; background:var(--clr-primary-dim); color:var(--clr-primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem; flex-shrink:0">
                  ${initials}
                </div>
                <div>
                  <div style="font-weight:600; color:var(--clr-text)">${item.name}</div>
                  <div style="font-size:0.75rem; color:var(--clr-text-muted)">${item.phone || item.role}</div>
                </div>
              </div>
            </td>
            <td data-label="Designation">
              <span class="badge badge-primary">${item.role}</span>
            </td>
            <td data-label="Basic Salary">
              ${item.basicSalary ? formatCurrency(item.basicSalary) : '—'}
            </td>
            <td data-label="Disbursals">
              <span style="font-weight:600">${item.count} payment${item.count > 1 ? 's' : ''}</span>
            </td>
            <td data-label="Total Paid" style="font-weight:700; color:var(--clr-primary); font-size:1rem">
              ${formatCurrency(item.totalPaid)}
            </td>
            <td data-label="% of Payroll">
              <div style="display:flex; align-items:center; gap:8px">
                <div style="flex:1; max-width:80px; height:6px; background:var(--clr-border); border-radius:999px; overflow:hidden">
                  <div style="width:${pct}%; height:100%; background:var(--clr-primary); border-radius:999px"></div>
                </div>
                <span style="font-size:0.8rem; font-weight:600; color:var(--clr-text-muted)">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      });

      // Individual payment slips in this period
      let paymentSlipsHtml = '';
      const sortedPayments = [...salaries].sort((a, b) => {
        const dA = new Date(a.date || a.createdAt || 0).getTime();
        const dB = new Date(b.date || b.createdAt || 0).getTime();
        return dB - dA;
      });

      sortedPayments.forEach((p, idx) => {
        const emp = empMap[p.employeeId] || { name: p.employeeName || 'Staff Member', role: 'Staff' };
        const voucherNo = `SAL-${String(p.id || idx).slice(-6).toUpperCase()}`;
        const amount = Number(p.totalPaid || p.amount || 0);
        const mIdx = p.month !== undefined && p.month !== null ? parseInt(p.month, 10) - 1 : null;
        const periodLabel = mIdx !== null && mIdx >= 0 && mIdx < 12 ? `${MONTHS[mIdx]} ${p.year || ''}` : `${p.year || ''}`;

        paymentSlipsHtml += `
          <tr>
            <td data-label="Voucher #" style="font-family:monospace; font-size:0.8rem; color:var(--clr-text-muted)">${voucherNo}</td>
            <td data-label="Date">${formatDate(p.date || p.createdAt, true)}</td>
            <td data-label="Employee">
              <strong>${emp.name}</strong> <span style="font-size:0.75rem; color:var(--clr-text-muted)">(${emp.role})</span>
            </td>
            <td data-label="Period">${periodLabel}</td>
            <td data-label="Payment Type">
              <span class="badge ${p.paymentType?.includes('Advance') ? 'badge-accent' : 'badge-success'}">
                ${p.paymentType || 'Salary Settlement'}
              </span>
            </td>
            <td data-label="Amount Paid" style="font-weight:700; color:var(--clr-success)">
              ${formatCurrency(amount)}
            </td>
            <td data-label="Actions">
              <button class="btn btn-secondary btn-sm print-salary-btn" data-pay-id="${p.id}" title="Print Slip" style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; font-size:0.75rem">
                🖨️ Slip
              </button>
            </td>
          </tr>
        `;
      });

      payrollContainer.innerHTML = `
        <!-- Aggregate Highlights -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:18px">
          <div style="background:var(--clr-surface-2); padding:12px 16px; border-radius:8px; border:1px solid var(--clr-border)">
            <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase">Total Payroll Disbursed</div>
            <div style="font-size:1.35rem; font-weight:800; color:var(--clr-primary); margin-top:2px">${formatCurrency(totalSalaries)}</div>
          </div>
          <div style="background:var(--clr-surface-2); padding:12px 16px; border-radius:8px; border:1px solid var(--clr-border)">
            <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase">Staff Members Paid</div>
            <div style="font-size:1.35rem; font-weight:800; color:var(--clr-text); margin-top:2px">${empList.length} employee${empList.length > 1 ? 's' : ''}</div>
          </div>
          <div style="background:var(--clr-surface-2); padding:12px 16px; border-radius:8px; border:1px solid var(--clr-border)">
            <div style="font-size:0.75rem; color:var(--clr-text-muted); font-weight:600; text-transform:uppercase">Total Salary Transactions</div>
            <div style="font-size:1.35rem; font-weight:800; color:var(--clr-text); margin-top:2px">${salaries.length} payout${salaries.length > 1 ? 's' : ''}</div>
          </div>
        </div>

        <!-- Who Got Paid Summary Table -->
        <div style="margin-bottom:20px">
          <div style="font-weight:700; font-size:0.9rem; margin-bottom:8px; color:var(--clr-text)">
            👥 Staff Earnings Summary (Who got paid how much)
          </div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Basic Salary</th>
                  <th>Disbursals</th>
                  <th>Total Amount Paid</th>
                  <th>Share of Payroll</th>
                </tr>
              </thead>
              <tbody>
                ${empRowsHtml}
              </tbody>
              <tfoot style="background:var(--clr-surface-2); font-weight:700; border-top:2px solid var(--clr-border)">
                <tr>
                  <td colspan="4">Total Staff Payroll</td>
                  <td style="color:var(--clr-primary); font-size:1.05rem">${formatCurrency(totalSalaries)}</td>
                  <td>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Detailed Salary Payouts Log -->
        <div>
          <div style="font-weight:700; font-size:0.9rem; margin-bottom:8px; color:var(--clr-text)">
            🧾 Salary Payouts & Slips Log
          </div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Payment Date</th>
                  <th>Staff Member</th>
                  <th>Month / Period</th>
                  <th>Type</th>
                  <th>Amount Paid</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${paymentSlipsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  // --- RENDER TAB 2: UTILITY BILLS BREAKDOWN ---
  const billsContainer = document.getElementById('bills-summary-content');
  if (billsContainer) {
    if (bills.length === 0) {
      billsContainer.innerHTML = `
        <div style="padding:32px 16px; text-align:center; color:var(--clr-text-muted)">
          <div style="font-size:2rem; margin-bottom:8px">⚡</div>
          <div style="font-weight:600">No utility bills recorded for this period</div>
          <div style="font-size:0.8rem; margin-top:4px">Logged operational bills (Light, Water, Internet, Gas, etc.) will appear here.</div>
        </div>
      `;
    } else {
      const typeMap = {
        'Light': { total: 0, count: 0, icon: '⚡' },
        'Water': { total: 0, count: 0, icon: '💧' },
        'Internet': { total: 0, count: 0, icon: '🌐' },
        'Gas': { total: 0, count: 0, icon: '🔥' },
        'Maintenance': { total: 0, count: 0, icon: '🛠️' },
        'Other': { total: 0, count: 0, icon: '🧾' }
      };

      bills.forEach(b => {
        const t = b.type || 'Other';
        if (!typeMap[t]) typeMap[t] = { total: 0, count: 0, icon: '🧾' };
        typeMap[t].total += Number(b.amount || 0);
        typeMap[t].count += 1;
      });

      const billCardsHtml = Object.entries(typeMap)
        .filter(([_, data]) => data.total > 0 || data.count > 0)
        .map(([type, data]) => `
          <div style="background:var(--clr-surface-2); padding:12px 16px; border-radius:8px; border:1px solid var(--clr-border)">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-size:0.8rem; font-weight:700">${data.icon} ${type}</span>
              <span style="font-size:0.72rem; color:var(--clr-text-muted)">${data.count} bill${data.count > 1 ? 's' : ''}</span>
            </div>
            <div style="font-size:1.15rem; font-weight:800; color:var(--clr-accent); margin-top:4px">${formatCurrency(data.total)}</div>
          </div>
        `).join('');

      let billRowsHtml = '';
      const sortedBills = [...bills].sort((a, b) => {
        const dA = new Date(a.date || a.createdAt || 0).getTime();
        const dB = new Date(b.date || b.createdAt || 0).getTime();
        return dB - dA;
      });

      sortedBills.forEach(b => {
        let typeEmoji = '🧾';
        if (b.type === 'Light') typeEmoji = '⚡';
        if (b.type === 'Water') typeEmoji = '💧';
        if (b.type === 'Internet') typeEmoji = '🌐';
        if (b.type === 'Gas') typeEmoji = '🔥';
        if (b.type === 'Maintenance') typeEmoji = '🛠️';

        billRowsHtml += `
          <tr>
            <td data-label="Date">${formatDate(b.date || b.createdAt, true)}</td>
            <td data-label="Type">
              <span style="font-weight:600">${typeEmoji} ${b.type || 'Other'}</span>
            </td>
            <td data-label="Description">${b.description || '—'}</td>
            <td data-label="Amount" style="font-weight:700; color:var(--clr-accent)">
              ${formatCurrency(b.amount || 0)}
            </td>
          </tr>
        `;
      });

      billsContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:18px">
          ${billCardsHtml}
        </div>

        <div style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${billRowsHtml}
            </tbody>
            <tfoot style="background:var(--clr-surface-2); font-weight:700; border-top:2px solid var(--clr-border)">
              <tr>
                <td colspan="3">Total Utility Bills</td>
                <td style="color:var(--clr-accent); font-size:1.05rem">${formatCurrency(totalBills)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }
  }

  // --- RENDER TAB 3: ALL OUTFLOWS COMBINED ---
  const allContainer = document.getElementById('all-outflows-content');
  if (allContainer) {
    const combinedOutflows = [
      ...salaries.map(s => {
        const emp = empMap[s.employeeId] || { name: s.employeeName || 'Staff Member', role: 'Staff' };
        return {
          type: 'Salary',
          categoryBadge: 'badge-primary',
          title: `👥 Payroll: ${emp.name}`,
          desc: `${s.paymentType || 'Salary'} · ${emp.role}`,
          amount: Number(s.totalPaid || s.amount || 0),
          date: s.date || s.createdAt,
          raw: s,
          isSalary: true,
          emp
        };
      }),
      ...bills.map(b => ({
        type: 'Utility Bill',
        categoryBadge: 'badge-accent',
        title: `⚡ Bill: ${b.type || 'Operational Expense'}`,
        desc: b.description || 'Hotel Operational Expense',
        amount: Number(b.amount || 0),
        date: b.date || b.createdAt,
        raw: b,
        isSalary: false
      }))
    ].sort((a, b) => {
      const dA = new Date(a.date || 0).getTime();
      const dB = new Date(b.date || 0).getTime();
      return dB - dA;
    });

    if (combinedOutflows.length === 0) {
      allContainer.innerHTML = `
        <div style="padding:32px 16px; text-align:center; color:var(--clr-text-muted)">
          <div style="font-size:2rem; margin-bottom:8px">📋</div>
          <div style="font-weight:600">No expense records logged for this period</div>
        </div>
      `;
    } else {
      let combinedRowsHtml = '';
      combinedOutflows.forEach(item => {
        combinedRowsHtml += `
          <tr>
            <td data-label="Date">${formatDate(item.date, true)}</td>
            <td data-label="Type">
              <span class="badge ${item.categoryBadge}">${item.type}</span>
            </td>
            <td data-label="Beneficiary / Item" style="font-weight:600">${item.title}</td>
            <td data-label="Description" style="color:var(--clr-text-muted)">${item.desc}</td>
            <td data-label="Outflow Amount" style="font-weight:700; color:var(--clr-danger)">
              ${formatCurrency(item.amount)}
            </td>
          </tr>
        `;
      });

      allContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:10px 16px; background:var(--clr-danger-dim); border-radius:8px; border:1px solid rgba(239,68,68,0.2)">
          <div>
            <span style="font-weight:700; color:var(--clr-text)">Total Cash Outflow:</span>
            <span style="font-size:0.8rem; color:var(--clr-text-muted); margin-left:8px">(${salaries.length} payroll + ${bills.length} bills)</span>
          </div>
          <strong style="font-size:1.15rem; color:var(--clr-danger)">${formatCurrency(totalExpenses)}</strong>
        </div>

        <div style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Payee / Item</th>
                <th>Details</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${combinedRowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // Bind print voucher buttons in the salary log
  document.querySelectorAll('.print-salary-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const payId = btn.dataset.payId;
      const payment = salaries.find(p => p.id === payId);
      if (!payment) return;
      const emp = empMap[payment.employeeId] || {
        name: payment.employeeName || 'Staff Member',
        role: 'Staff'
      };
      openPrintSalaryBill(payment, emp);
    });
  });
}

function updateCashFlowSummary(bookings, bills, salaries, profit) {
  const container = document.getElementById('cashflow-summary-content');
  if (!container) return;

  const totalAdvance = bookings.reduce((s, b) => s + Number(b.advancePaid || 0), 0);
  const totalRemaining = bookings.reduce((s, b) => {
    const rem = b.remaining !== undefined && b.remaining !== null
      ? Number(b.remaining)
      : Math.max(0, Number(b.fullPrice || 0) - Number(b.advancePaid || 0));
    return s + rem;
  }, 0);

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; font-size:0.86rem">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--clr-surface-2); border-radius:8px">
        <span style="color:var(--clr-text-muted)">💵 Advance Collected:</span>
        <strong style="color:var(--clr-success)">${formatCurrency(totalAdvance)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--clr-surface-2); border-radius:8px">
        <span style="color:var(--clr-text-muted)">⏳ Pending Receivables:</span>
        <strong style="color:var(--clr-accent)">${formatCurrency(totalRemaining)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--clr-surface-2); border-radius:8px">
        <span style="color:var(--clr-text-muted)">⚡ Operational Expenses (Bills):</span>
        <strong style="color:var(--clr-danger)">${formatCurrency(bills)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--clr-surface-2); border-radius:8px">
        <span style="color:var(--clr-text-muted)">👥 Payroll Outflow (Salaries):</span>
        <strong style="color:var(--clr-danger)">${formatCurrency(salaries)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:${profit >= 0 ? 'var(--clr-success-dim)' : 'var(--clr-danger-dim)'}; border-radius:8px; border:1px solid ${profit >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}">
        <span style="font-weight:700; color:var(--clr-text)">Net Financial Result:</span>
        <strong style="font-size:1.05rem; color:${profit >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)'}">
          ${profit < 0 ? '-' : '+'}${formatCurrency(Math.abs(profit))}
        </strong>
      </div>
    </div>
  `;
}

const CHART_COLORS = {
  primary:     'rgba(79,114,245,0.85)',
  primaryLine: '#4f72f5',
  accent:      'rgba(245,105,42,0.85)',
  success:     'rgba(34,197,94,0.85)',
  successLine: '#22c55e',
  danger:      'rgba(239,68,68,0.85)',
  dangerLine:  '#ef4444',
  purple:      'rgba(124,92,246,0.85)',
  pink:        'rgba(244,114,182,0.85)',
  teal:        'rgba(20,184,166,0.85)',
  yellow:      'rgba(245,158,11,0.85)',
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#64748b', font: { family: 'Inter', size: 12 } } }
  },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,78,0.06)' } },
    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,78,0.08)' } }
  }
};

function renderFinanceChart(income, expenses, profit) {
  const canvas = document.getElementById('chart-finance');
  if (!canvas) return;
  charts.finance?.destroy();

  charts.finance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: MONTHS.map(m => m.slice(0, 3)),
      datasets: [
        {
          type: 'bar',
          label: 'Income (LKR)',
          data: income,
          backgroundColor: CHART_COLORS.primary,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          type: 'bar',
          label: 'Expenses (LKR)',
          data: expenses,
          backgroundColor: CHART_COLORS.danger,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          type: 'line',
          label: 'Net Profit (LKR)',
          data: profit,
          borderColor: CHART_COLORS.successLine,
          backgroundColor: 'rgba(34,197,94,0.1)',
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: CHART_COLORS.successLine,
          pointRadius: 4,
          fill: false,
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => `  ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      }
    }
  });
}

function renderExpenseBreakdownChart(salariesTotal, bills) {
  const canvas = document.getElementById('chart-expense-breakdown');
  if (!canvas) return;
  charts.expenseBreakdown?.destroy();

  // Categorize bills
  const typeMap = {
    'Light': 0,
    'Water': 0,
    'Internet': 0,
    'Gas': 0,
    'Maintenance': 0,
    'Other': 0
  };

  bills.forEach(b => {
    const t = b.type || 'Other';
    if (typeMap[t] !== undefined) typeMap[t] += Number(b.amount || 0);
    else typeMap['Other'] += Number(b.amount || 0);
  });

  const categories = [
    { label: 'Staff Salaries', amount: salariesTotal, color: CHART_COLORS.purple },
    { label: 'Electricity (Light)', amount: typeMap.Light, color: CHART_COLORS.yellow },
    { label: 'Water', amount: typeMap.Water, color: CHART_COLORS.teal },
    { label: 'Internet', amount: typeMap.Internet, color: CHART_COLORS.primary },
    { label: 'Gas', amount: typeMap.Gas, color: CHART_COLORS.accent },
    { label: 'Maintenance', amount: typeMap.Maintenance, color: CHART_COLORS.danger },
    { label: 'Other Expenses', amount: typeMap.Other, color: CHART_COLORS.pink },
  ].filter(c => c.amount > 0);

  if (categories.length === 0) {
    categories.push({ label: 'No Expenses Recorded', amount: 1, color: 'rgba(148,163,184,0.3)' });
  }

  charts.expenseBreakdown = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: categories.map(c => c.label),
      datasets: [{
        data: categories.map(c => c.amount),
        backgroundColor: categories.map(c => c.color),
        borderWidth: 2,
        borderColor: '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#64748b', font: { family: 'Inter', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (categories[0].label === 'No Expenses Recorded') return ' No expenses recorded';
              return ` ${ctx.label}: ${formatCurrency(ctx.raw)}`;
            }
          }
        }
      }
    }
  });
}

function renderOccupancyChart(bookings, year) {
  const canvas = document.getElementById('chart-occupancy');
  if (!canvas) return;
  charts.occupancy?.destroy();

  const monthlyNights = Array(12).fill(0);
  bookings.forEach(b => {
    const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
    monthlyNights[ci.getMonth()] += nightCount(b.checkIn, b.checkOut);
  });

  const maxPerMonth = MONTHS.map((_, i) => {
    const days = new Date(year, i + 1, 0).getDate();
    return days * 7;
  });

  charts.occupancy = new Chart(canvas, {
    type: 'line',
    data: {
      labels: MONTHS.map(m => m.slice(0, 3)),
      datasets: [{
        label: 'Occupancy %',
        data: monthlyNights.map((n, i) => +((n / maxPerMonth[i] * 100).toFixed(1))),
        borderColor: CHART_COLORS.primaryLine,
        backgroundColor: 'rgba(108,138,255,0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: CHART_COLORS.primaryLine,
        pointRadius: 4,
      }]
    },
    options: { ...chartDefaults }
  });
}

function renderRoomChart(bookings) {
  const canvas = document.getElementById('chart-rooms');
  if (!canvas) return;
  charts.rooms?.destroy();

  const roomCounts = Array(7).fill(0);
  bookings.forEach(b => {
    if (b.roomNumber >= 1 && b.roomNumber <= 7) {
      roomCounts[b.roomNumber - 1]++;
    }
  });

  charts.rooms = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: [1, 2, 3, 4, 5, 6, 7].map(n => `Room ${n}`),
      datasets: [{
        data: roomCounts,
        backgroundColor: [
          CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.success,
          CHART_COLORS.purple, CHART_COLORS.pink, CHART_COLORS.teal, CHART_COLORS.yellow
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } }, position: 'right' }
      }
    }
  });
}

function renderMealChart(bookings) {
  const canvas = document.getElementById('chart-meals');
  if (!canvas) return;
  charts.meals?.destroy();

  const meals = { BB: 0, HB: 0, FB: 0, None: 0 };
  bookings.forEach(b => { meals[b.meals] = (meals[b.meals] || 0) + 1; });

  charts.meals = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: ['Bed & Breakfast', 'Half Board', 'Full Board', 'Room Only'],
      datasets: [{
        data: [meals.BB, meals.HB, meals.FB, meals.None],
        backgroundColor: [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.success, CHART_COLORS.purple],
        borderWidth: 2,
        borderColor: '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } }, position: 'right' }
      }
    }
  });
}

function renderSourceChart(bookings) {
  const canvas = document.getElementById('chart-sources');
  if (!canvas) return;
  charts.sources?.destroy();

  const sources = {};
  bookings.forEach(b => {
    const s = b.source || 'Direct';
    sources[s] = (sources[s] || 0) + 1;
  });

  const labels = Object.keys(sources);
  const data = Object.values(sources);
  const colors = [
    CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.success,
    CHART_COLORS.purple, CHART_COLORS.pink, CHART_COLORS.teal
  ];

  charts.sources = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Bookings',
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      ...chartDefaults,
      plugins: { ...chartDefaults.plugins, legend: { display: false } }
    }
  });
}

function renderWeeklyChart(bookings) {
  const canvas = document.getElementById('chart-weekly');
  if (!canvas) return;
  charts.weekly?.destroy();

  const now = new Date();
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  const weekRevenue = Array(5).fill(0);

  bookings.forEach(b => {
    const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
    if (ci.getMonth() === now.getMonth() && ci.getFullYear() === now.getFullYear()) {
      const week = Math.min(4, Math.floor((ci.getDate() - 1) / 7));
      weekRevenue[week] += Number(b.fullPrice || 0);
    }
  });

  charts.weekly = new Chart(canvas, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Revenue (LKR)',
        data: weekRevenue,
        borderColor: CHART_COLORS.accent,
        backgroundColor: 'rgba(255,123,79,0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: CHART_COLORS.accent,
        pointRadius: 5,
      }]
    },
    options: { ...chartDefaults }
  });
}

function renderFinancialStatementTable(year, monthlyIncome, monthlyBills, monthlySalaries, monthlyExpenses, monthlyProfit, activeMonth) {
  const container = document.getElementById('financial-statement-container');
  if (!container) return;

  const totalInc = monthlyIncome.reduce((s, v) => s + v, 0);
  const totalB = monthlyBills.reduce((s, v) => s + v, 0);
  const totalS = monthlySalaries.reduce((s, v) => s + v, 0);
  const totalExp = monthlyExpenses.reduce((s, v) => s + v, 0);
  const totalProf = monthlyProfit.reduce((s, v) => s + v, 0);
  const totalMargin = totalInc > 0 ? ((totalProf / totalInc) * 100).toFixed(1) : '0.0';

  let rowsHtml = '';
  MONTHS.forEach((mName, i) => {
    const inc = monthlyIncome[i];
    const b = monthlyBills[i];
    const s = monthlySalaries[i];
    const exp = monthlyExpenses[i];
    const prof = monthlyProfit[i];
    const margin = inc > 0 ? ((prof / inc) * 100).toFixed(1) : (exp > 0 ? '-100.0' : '0.0');
    const isSelected = activeMonth !== 'all' && parseInt(activeMonth) === i;

    rowsHtml += `
      <tr style="${isSelected ? 'background:rgba(79,114,245,0.08); font-weight:600' : ''}">
        <td data-label="Month" style="font-weight:600">
          ${isSelected ? '👉 ' : ''}${mName}
        </td>
        <td data-label="Income" style="color:var(--clr-success); font-weight:600">
          ${formatCurrency(inc)}
        </td>
        <td data-label="Utility Bills" style="color:var(--clr-text-muted)">
          ${formatCurrency(b)}
        </td>
        <td data-label="Salaries" style="color:var(--clr-text-muted)">
          ${formatCurrency(s)}
        </td>
        <td data-label="Total Expenses" style="color:var(--clr-danger); font-weight:600">
          ${formatCurrency(exp)}
        </td>
        <td data-label="Net Profit" style="color:${prof >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)'}; font-weight:700">
          ${prof < 0 ? '-' : ''}${formatCurrency(Math.abs(prof))}
        </td>
        <td data-label="Margin" style="font-weight:600">
          <span class="badge ${prof >= 0 ? 'badge-success' : 'badge-danger'}">${margin}%</span>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Booking Income</th>
          <th>Utility Bills</th>
          <th>Salaries Paid</th>
          <th>Total Expenses</th>
          <th>Net Profit / Loss</th>
          <th>Margin (%)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot style="background:var(--clr-surface-2); font-weight:700; border-top:2px solid var(--clr-border)">
        <tr>
          <td>Total ${year}</td>
          <td style="color:var(--clr-success)">${formatCurrency(totalInc)}</td>
          <td>${formatCurrency(totalB)}</td>
          <td>${formatCurrency(totalS)}</td>
          <td style="color:var(--clr-danger)">${formatCurrency(totalExp)}</td>
          <td style="color:${totalProf >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)'}">
            ${totalProf < 0 ? '-' : ''}${formatCurrency(Math.abs(totalProf))}
          </td>
          <td>
            <span class="badge ${totalProf >= 0 ? 'badge-success' : 'badge-danger'}">${totalMargin}%</span>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

function renderRecentSummary(bookings) {
  const el = document.getElementById('recent-summary');
  if (!el) return;

  const recent = bookings.slice(0, 8);

  if (!recent.length) {
    el.innerHTML = `<div style="padding:20px; color:var(--clr-text-muted); text-align:center">No bookings for this period</div>`;
    return;
  }

  el.innerHTML = `
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Guest</th>
            <th>Room</th>
            <th>Check-In</th>
            <th>Nights</th>
            <th>Source</th>
            <th>Revenue</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(b => {
            const nights = nightCount(b.checkIn, b.checkOut);
            const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
            const co = b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut);
            const now = new Date();
            const isPast = co < now;
            const isCurrent = ci <= now && co >= now;
            const statusLabel = isPast ? '✅ Done' : isCurrent ? '🟢 Active' : '🔵 Upcoming';
            const statusColor = isPast ? 'var(--clr-text-muted)' : isCurrent ? 'var(--clr-success)' : 'var(--clr-primary)';
            return `
              <tr>
                <td data-label="Guest">
                  <div style="font-weight:600">${b.guestName || 'Guest'}</div>
                  <div style="font-size:0.75rem;color:var(--clr-text-muted)">${b.phone || ''}</div>
                </td>
                <td data-label="Room"><span style="font-weight:700;color:var(--clr-primary)">Room ${b.roomNumber}</span></td>
                <td data-label="Check-In">${formatDate(b.checkIn, true)}</td>
                <td data-label="Nights">${nights}</td>
                <td data-label="Source"><span class="badge badge-primary">${b.source || 'Direct'}</span></td>
                <td data-label="Revenue" style="font-weight:700">${formatCurrency(b.fullPrice)}</td>
                <td data-label="Status" style="color:${statusColor};font-weight:600;font-size:0.82rem">${statusLabel}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function destroyAnalyticsPage() {
  if (unsubBookings) { unsubBookings(); unsubBookings = null; }
  if (unsubBills) { unsubBills(); unsubBills = null; }
  if (unsubSalaries) { unsubSalaries(); unsubSalaries = null; }
  if (unsubEmployees) { unsubEmployees(); unsubEmployees = null; }
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};
}
