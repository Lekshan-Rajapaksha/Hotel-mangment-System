// src/pages/receptionist/dashboard.js — Receptionist panel shell
import { renderSidebar, renderMobileHeader, bindMobileHeader, setActiveNav } from '../../components/sidebar.js';
import { renderCalendarPage } from './calendarPage.js';
import { renderMyBookingsPage } from './myBookingsPage.js';
import { renderPricingPage, destroyPricingPage } from './pricingPage.js';

let currentPage = 'calendar';
let userData = null;
let unsubPage = null;

export function renderReceptionistDashboard(user, userProfile) {
  userData = userProfile || { name: user.email?.split('@')[0] || 'Receptionist' };
  const userName = userData.name || user.email?.split('@')[0] || 'Receptionist';

  renderShell('calendar', userName);
  loadPage('calendar');
}

function renderShell(page, userName) {
  const app = document.getElementById('app');

  const sidebar = renderSidebar('receptionist', page, navigateTo, userName);

  app.innerHTML = `
    ${renderMobileHeader('Blue Cove Reception')}
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

  // Destroy old subscriptions if any
  if (unsubPage && typeof unsubPage === 'function') { unsubPage(); unsubPage = null; }

  currentPage = page;

  if (page === 'calendar') {
    destroyPricingPage();
    renderCalendarPage(container);
  } else if (page === 'bookings') {
    destroyPricingPage();
    renderMyBookingsPage(container);
  } else if (page === 'pricing') {
    renderPricingPage(container);
  }
}
