// src/pages/admin/adminCalendarPage.js — Admin read-only calendar
import { renderCalendar } from '../../components/calendar.js';

export function renderAdminCalendarPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📅 Room Calendar</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">
          Click a booked cell to view details or delete the booking
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge badge-primary">🔑 Admin View</span>
      </div>
    </div>
    <div class="page-body">
      <div id="calendar-mount"></div>
    </div>
  `;

  renderCalendar(document.getElementById('calendar-mount'), 'admin');
}
