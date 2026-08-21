// src/pages/admin/analyticsPage.js — Admin analytics with charts
import { subscribeAllBookings } from '../../services/bookingService.js';
import { formatCurrency, nightCount, MONTHS } from '../../utils/dateHelpers.js';
import Chart from 'chart.js/auto';

let charts = {};
let unsubscribe = null;

export function renderAnalyticsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📊 Analytics & Revenue</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">Business insights and performance metrics</div>
      </div>
      <select class="form-control" id="analytics-year" style="width:120px">
        ${[0,1,2].map(i => { const y = new Date().getFullYear() - i; return `<option value="${y}" ${i===0?'selected':''}>${y}</option>`; }).join('')}
      </select>
    </div>
    <div class="page-body">

      <!-- Stats Cards -->
      <div class="stats-grid" id="stats-cards">
        ${renderStatSkeleton()}
      </div>

      <!-- Charts Row 1 -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-title">💰 Monthly Revenue (LKR)</div>
          <canvas id="chart-revenue"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">🛏️ Occupancy Rate (%)</div>
          <canvas id="chart-occupancy"></canvas>
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card-title">🚪 Room Popularity</div>
          <canvas id="chart-rooms"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">🍽️ Meal Plan Distribution</div>
          <canvas id="chart-meals"></canvas>
        </div>
      </div>

      <!-- Booking Source chart -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px">
        <div class="chart-card">
          <div class="chart-card-title">📡 Booking Sources</div>
          <canvas id="chart-sources"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">📈 Weekly Trends (This Month)</div>
          <canvas id="chart-weekly"></canvas>
        </div>
      </div>

      <!-- Top Guests -->
      <div class="card" style="margin-bottom:28px">
        <div class="card-header">
          <div class="card-title">👥 Recent Bookings Summary</div>
        </div>
        <div id="recent-summary">Loading…</div>
      </div>
    </div>
  `;

  document.getElementById('analytics-year')?.addEventListener('change', () => {
    if (unsubscribe) { unsubscribe(); }
    startSubscription();
  });

  startSubscription();
}

function startSubscription() {
  // Destroy old charts
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeAllBookings((allBookings) => {
    const year = parseInt(document.getElementById('analytics-year')?.value || new Date().getFullYear());
    const bookings = allBookings.filter(b => {
      const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
      return ci.getFullYear() === year && b.status === 'active';
    });

    updateStats(bookings);
    renderRevenueChart(bookings);
    renderOccupancyChart(bookings, year);
    renderRoomChart(bookings);
    renderMealChart(bookings);
    renderSourceChart(bookings);
    renderWeeklyChart(bookings);
    renderRecentSummary(bookings);
  });
}

function renderStatSkeleton() {
  return ['Total Revenue', 'Total Bookings', 'Avg Stay', 'Occupancy Rate'].map((label, i) => {
    const icons = ['💰','📋','🌙','📊'];
    const colors = ['blue','orange','green','purple'];
    return `
      <div class="stat-card">
        <div class="stat-icon ${colors[i]}">${icons[i]}</div>
        <div>
          <div class="stat-label">${label}</div>
          <div class="stat-value" id="stat-${i}">—</div>
          <div class="stat-sub" id="stat-sub-${i}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function updateStats(bookings) {
  const totalRev = bookings.reduce((s,b) => s + (b.fullPrice||0), 0);
  const avgNights = bookings.length
    ? (bookings.reduce((s,b) => s + nightCount(b.checkIn, b.checkOut), 0) / bookings.length).toFixed(1)
    : 0;

  // Occupancy: booked room-nights / (7 rooms × 365 days) × 100
  const totalNights = bookings.reduce((s,b) => s + nightCount(b.checkIn, b.checkOut), 0);
  const maxNights = 7 * 365;
  const occ = ((totalNights / maxNights) * 100).toFixed(1);

  const vals = [
    formatCurrency(totalRev),
    bookings.length,
    `${avgNights} nights`,
    `${occ}%`
  ];
  vals.forEach((v,i) => {
    const el = document.getElementById(`stat-${i}`);
    if (el) el.textContent = v;
  });

  const subs = [
    `${bookings.filter(b => !b.remaining || b.remaining<=0).length} fully paid`,
    `${bookings.filter(b => { const d=b.checkOut?.toDate?b.checkOut.toDate():new Date(b.checkOut); return d>=new Date(); }).length} upcoming`,
    `Across all rooms`,
    `Room occupancy rate`
  ];
  subs.forEach((s,i) => {
    const el = document.getElementById(`stat-sub-${i}`);
    if (el) el.textContent = s;
  });
}

function getMonthlyData(bookings) {
  const months = Array(12).fill(0);
  bookings.forEach(b => {
    const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
    const m = ci.getMonth();
    months[m] += (b.fullPrice || 0);
  });
  return months;
}

const CHART_COLORS = {
  primary:     'rgba(79,114,245,0.85)',
  primaryLine: '#4f72f5',
  accent:      'rgba(245,105,42,0.85)',
  success:     'rgba(34,197,94,0.85)',
  purple:      'rgba(124,92,246,0.85)',
  pink:        'rgba(244,114,182,0.85)',
  teal:        'rgba(20,184,166,0.85)',
  yellow:      'rgba(245,158,11,0.85)',
};

const chartDefaults = {
  plugins: {
    legend: { labels: { color: '#64748b', font: { family: 'Inter', size: 12 } } }
  },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,78,0.06)' } },
    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,45,78,0.08)' } }
  }
};

function renderRevenueChart(bookings) {
  const canvas = document.getElementById('chart-revenue');
  if (!canvas) return;
  charts.revenue?.destroy();
  const data = getMonthlyData(bookings);
  charts.revenue = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: MONTHS.map(m => m.slice(0,3)),
      datasets: [{
        label: 'Revenue (LKR)',
        data,
        backgroundColor: CHART_COLORS.primary,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: { label: ctx => `  LKR ${ctx.raw.toLocaleString()}` }
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

  // Days in each month × 7 rooms = max nights
  const maxPerMonth = MONTHS.map((_, i) => {
    const days = new Date(year, i+1, 0).getDate();
    return days * 7;
  });

  charts.occupancy = new Chart(canvas, {
    type: 'line',
    data: {
      labels: MONTHS.map(m => m.slice(0,3)),
      datasets: [{
        label: 'Occupancy %',
        data: monthlyNights.map((n,i) => +((n/maxPerMonth[i]*100).toFixed(1))),
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
  bookings.forEach(b => { roomCounts[b.roomNumber-1]++; });
  charts.rooms = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: [1,2,3,4,5,6,7].map(n => `Room ${n}`),
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
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } }, position: 'right' } }
    }
  });
}

function renderMealChart(bookings) {
  const canvas = document.getElementById('chart-meals');
  if (!canvas) return;
  charts.meals?.destroy();
  const meals = { BB: 0, HB: 0, FB: 0, None: 0 };
  bookings.forEach(b => { meals[b.meals] = (meals[b.meals]||0) + 1; });
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
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } }, position: 'right' } }
    }
  });
}

function renderSourceChart(bookings) {
  const canvas = document.getElementById('chart-sources');
  if (!canvas) return;
  charts.sources?.destroy();
  const sources = {};
  bookings.forEach(b => { const s = b.source||'Direct'; sources[s] = (sources[s]||0)+1; });
  const labels = Object.keys(sources);
  const data = Object.values(sources);
  const colors = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.success,
    CHART_COLORS.purple, CHART_COLORS.pink, CHART_COLORS.teal];
  charts.sources = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Bookings', data, backgroundColor: colors.slice(0,labels.length), borderRadius: 6, borderSkipped: false }]
    },
    options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
  });
}

function renderWeeklyChart(bookings) {
  const canvas = document.getElementById('chart-weekly');
  if (!canvas) return;
  charts.weekly?.destroy();

  // This month's weekly revenue breakdown
  const now = new Date();
  const weeks = ['Week 1','Week 2','Week 3','Week 4','Week 5'];
  const weekRevenue = Array(5).fill(0);
  bookings.forEach(b => {
    const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
    if (ci.getMonth() === now.getMonth() && ci.getFullYear() === now.getFullYear()) {
      const week = Math.min(4, Math.floor((ci.getDate()-1)/7));
      weekRevenue[week] += (b.fullPrice||0);
    }
  });

  charts.weekly = new Chart(canvas, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Revenue',
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
            const rem = b.remaining ?? (b.fullPrice - (b.advancePaid||0));
            const ci = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn);
            const co = b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut);
            const now = new Date();
            const isPast = co < now;
            const isCurrent = ci <= now && co >= now;
            const statusLabel = isPast ? '✅ Done' : isCurrent ? '🟢 Active' : '🔵 Upcoming';
            const statusColor = isPast ? 'var(--clr-text-muted)' : isCurrent ? 'var(--clr-success)' : 'var(--clr-primary)';
            return `
              <tr>
                <td data-label="Guest"><div style="font-weight:600">${b.guestName}</div><div style="font-size:0.75rem;color:var(--clr-text-muted)">${b.phone}</div></td>
                <td data-label="Room"><span style="font-weight:700;color:var(--clr-primary)">Room ${b.roomNumber}</span></td>
                <td data-label="Check-In">${formatDate(b.checkIn, true)}</td>
                <td data-label="Nights">${nights}</td>
                <td data-label="Source"><span class="badge badge-primary">${b.source||'Direct'}</span></td>
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
