// src/pages/admin/dashboard.js — Admin panel shell
import { renderSidebar, renderMobileHeader, bindMobileHeader, setActiveNav } from '../../components/sidebar.js';
import { renderAdminCalendarPage } from './adminCalendarPage.js';
import { renderAnalyticsPage, destroyAnalyticsPage } from './analyticsPage.js';
import { renderBillsPage } from './billsPage.js';
import { renderUtilityBillsPage, destroyUtilityBillsAdminPage } from './utilityBillsPage.js';
import { renderNotificationsPage, destroyNotificationsPage } from './notificationsPage.js';
import { renderRoomSummaryPage } from './roomSummaryPage.js';
import { renderEmployeeDetailsPage, destroyEmployeeDetailsPage } from './employeeDetailsPage.js';
import { renderCommissionPage, destroyCommissionPage } from '../receptionist/commissionPage.js';

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

  // Tear down listeners when leaving pages
  if (currentPage !== 'notifications') destroyNotificationsPage();
  if (currentPage !== 'utility') {
    if (typeof destroyUtilityBillsAdminPage === 'function') destroyUtilityBillsAdminPage();
  }
  if (currentPage !== 'employees') destroyEmployeeDetailsPage();
  if (currentPage !== 'analytics') destroyAnalyticsPage();
  if (currentPage !== 'commission') destroyCommissionPage();

  currentPage = page;

  if (page === 'calendar') {
    renderAdminCalendarPage(container);
  } else if (page === 'roomsummary') {
    renderRoomSummaryPage(container);
  } else if (page === 'analytics') {
    renderAnalyticsPage(container);
  } else if (page === 'bills') {
    renderBillsPage(container);
  } else if (page === 'utility') {
    renderUtilityBillsPage(container);
  } else if (page === 'notifications') {
    renderNotificationsPage(container);
  } else if (page === 'employees') {
    renderEmployeeDetailsPage(container);
  } else if (page === 'commission') {
    renderCommissionPage(container, { isAdmin: true });
  }
}

