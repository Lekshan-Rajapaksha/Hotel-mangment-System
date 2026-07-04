// src/pages/receptionist/calendarPage.js — Calendar view for receptionist
import { renderCalendar, destroyCalendar } from '../../components/calendar.js';
import { openBookingModal } from '../../components/bookingModal.js';

export function renderCalendarPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📅 Room Calendar</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">
          Click any empty cell to book · Click booked cell to view/edit
        </div>
      </div>
      <button class="btn btn-accent" id="new-booking-btn">
        ➕ New Booking
      </button>
    </div>
    <div class="page-body">
      <div id="calendar-mount"></div>
    </div>
  `;

  renderCalendar(document.getElementById('calendar-mount'), 'receptionist');

  document.getElementById('new-booking-btn')?.addEventListener('click', () => {
    openBookingModal({ onSaved: () => {} });
  });
}
