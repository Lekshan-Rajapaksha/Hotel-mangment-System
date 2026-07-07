// src/pages/admin/dashboard.js — Admin panel shell
import { renderSidebar, renderMobileHeader, bindMobileHeader, setActiveNav } from '../../components/sidebar.js';
import { renderAdminCalendarPage } from './adminCalendarPage.js';
import { renderAnalyticsPage } from './analyticsPage.js';
import { renderBillsPage } from './billsPage.js';
import { renderNotificationsPage } from './notificationsPage.js';
import { renderRoomSummaryPage } from './roomSummaryPage.js';

let currentPage = 'calendar';

export function renderAdminDashboard(user, userProfile) {
  const userName = userProfile?.name || user.email?.split('@')[0] || 'Admin';
  renderShell('calendar', userName);
  loadPage('calendar');
}

function renderShell(page, userName) {
  const app = document.getElementById('app');
  const sidebar = renderSidebar('admin', page, navigateTo, userName);

  app.innerHTML = `
    ${renderMobileHeader('Blue Cove Admin')}
    ${sidebar.html}
    <main class="main-content" id="main-content">
      <div id="page-container"></div>
    </main>
  `;

  sidebar.bindEvents();
  bindMobileHeader();
}

function navigateTo(page) {
  if (page === currentPage) return;
  currentPage = page;
  setActiveNav(page);
  loadPage(page);
}

function loadPage(page) {
  const container = document.getElementById('page-container');
  if (!container) return;
  currentPage = page;

  if (page === 'calendar') {
    renderAdminCalendarPage(container);
  } else if (page === 'roomsummary') {
    renderRoomSummaryPage(container);
  } else if (page === 'analytics') {
    renderAnalyticsPage(container);
  } else if (page === 'bills') {
    renderBillsPage(container);
  } else if (page === 'notifications') {
    renderNotificationsPage(container);
  }
}

