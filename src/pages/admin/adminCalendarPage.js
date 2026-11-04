// src/pages/admin/adminCalendarPage.js — Admin read-only calendar
import { renderCalendar } from '../../components/calendar.js';
import { icon } from '../../components/icons.js';

export function renderAdminCalendarPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('calendar', { size: 26 })} Room Calendar</h1>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge badge-primary" style="display:inline-flex; align-items:center; gap:4px">
          ${icon('shield', { size: 13 })} Admin View
        </span>
      </div>
    </div>
    <div class="page-body">
      <div id="calendar-mount"></div>
    </div>
  `;

  renderCalendar(document.getElementById('calendar-mount'), 'admin');
}
