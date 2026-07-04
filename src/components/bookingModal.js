// src/components/bookingModal.js — Full booking form modal
import { createBooking, updateBooking } from '../services/bookingService.js';
import { showToast, showSpinner, hideSpinner } from '../utils/toast.js';
import { toDateStr, formatCurrency } from '../utils/dateHelpers.js';

let modalEl = null;
let currentBooking = null;
let onSavedCallback = null;

export function openBookingModal(opts = {}) {
  const { booking = null, defaultRoom = 1, defaultDate = null, onSaved = () => {} } = opts;
  currentBooking = booking;
  onSavedCallback = onSaved;

  // Remove existing modal
  document.querySelector('.modal-overlay')?.remove();

  const today = toDateStr(new Date());
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));

  const b = booking || {};
  const checkInVal  = b.checkIn  ? toDateStr(b.checkIn?.toDate ? b.checkIn.toDate()  : new Date(b.checkIn))  : (defaultDate || today);
  const checkOutVal = b.checkOut ? toDateStr(b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut)) : (defaultDate ? toDateStr(new Date(new Date(defaultDate).getTime() + 86400000)) : tomorrow);

  const members = b.additionalGuests || [];

  const html = `
    <div class="modal-overlay" id="booking-modal-overlay">
      <div class="modal modal-lg" id="booking-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-bk">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title-bk">
              ${booking ? '✏️ Edit Booking' : '➕ New Booking'}
            </h2>
            <div style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:2px">
              Room ${b.roomNumber || defaultRoom} · ${booking ? 'Update guest details' : 'Fill in guest details'}
            </div>
          </div>
          <button class="modal-close" id="booking-modal-close" aria-label="Close">✕</button>
        </div>

        <div class="modal-body" id="booking-modal-body">
          <form id="booking-form" novalidate>

            <!-- === GUEST INFO === -->
            <div class="section-title">👤 Guest Information</div>
            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-name">Full Name *</label>
                <input type="text" id="bk-name" class="form-control" placeholder="Guest full name" value="${b.guestName||''}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-phone">Tel / WhatsApp *</label>
                <input type="tel" id="bk-phone" class="form-control" placeholder="+94 7X XXX XXXX" value="${b.phone||''}" required />
              </div>
            </div>

            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-passport">Passport Number</label>
                <input type="text" id="bk-passport" class="form-control" placeholder="Passport / NIC number" value="${b.passportNumber||''}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-company">Company / Agency</label>
                <input type="text" id="bk-company" class="form-control" placeholder="Company or agency name" value="${b.companyName||''}" />
              </div>
            </div>

            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-source">Booking Source</label>
                <select id="bk-source" class="form-control">
                  <option value="Direct" ${(b.source||'Direct')==='Direct'?'selected':''}>Direct Walk-in</option>
                  <option value="Booking.com" ${b.source==='Booking.com'?'selected':''}>Booking.com</option>
                  <option value="Airbnb" ${b.source==='Airbnb'?'selected':''}>Airbnb</option>
                  <option value="Agoda" ${b.source==='Agoda'?'selected':''}>Agoda</option>
                  <option value="Visit" ${b.source==='Visit'?'selected':''}>Visit / Referral</option>
                  <option value="Phone" ${b.source==='Phone'?'selected':''}>Phone Reservation</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Special Occasion</label>
                <label class="toggle-wrap" style="height:42px; padding:0 14px; border:1px solid var(--clr-border); border-radius:6px; background:var(--clr-surface)">
                  <span class="toggle">
                    <input type="checkbox" id="bk-birthday" ${b.specialBirthday?'checked':''} />
                    <span class="toggle-slider"></span>
                  </span>
                  <span style="font-size:0.85rem; color:var(--clr-text)">🎂 Birthday / Anniversary</span>
                </label>
              </div>
            </div>

            <div class="divider"></div>

            <!-- === STAY DETAILS === -->
            <div class="section-title">🏠 Room & Stay Details</div>
            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-room">Room Number *</label>
                <select id="bk-room" class="form-control" required>
                  ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${(b.roomNumber||defaultRoom)==n?'selected':''}>${n}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-ac">Air Conditioning</label>
                <select id="bk-ac" class="form-control">
                  <option value="AC" ${(b.acType||'AC')==='AC'?'selected':''}>AC Room</option>
                  <option value="NonAC" ${b.acType==='NonAC'?'selected':''}>Non-AC Room</option>
                </select>
              </div>
            </div>

            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-bed">Bed Type</label>
                <select id="bk-bed" class="form-control">
                  <option value="Single" ${(b.bedType||'Single')==='Single'?'selected':''}>Single Bed</option>
                  <option value="Double" ${b.bedType==='Double'?'selected':''}>Double Bed</option>
                  <option value="Triple" ${b.bedType==='Triple'?'selected':''}>Triple Bed</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-meals">Meal Plan</label>
                <select id="bk-meals" class="form-control">
                  <option value="None" ${(b.meals||'None')==='None'?'selected':''}>No Meals</option>
                  <option value="BB" ${b.meals==='BB'?'selected':''}>BB — Bed & Breakfast</option>
                  <option value="HB" ${b.meals==='HB'?'selected':''}>HB — Half Board</option>
                  <option value="FB" ${b.meals==='FB'?'selected':''}>FB — Full Board</option>
                </select>
              </div>
            </div>

            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-checkin">Check-In Date *</label>
                <input type="date" id="bk-checkin" class="form-control" value="${checkInVal}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-checkout">Check-Out Date *</label>
                <input type="date" id="bk-checkout" class="form-control" value="${checkOutVal}" required />
              </div>
            </div>

            <!-- Night count display -->
            <div id="nights-display" style="
              padding:10px 14px; background:var(--clr-primary-dim);
              border:1px solid rgba(108,138,255,0.2); border-radius:6px;
              font-size:0.85rem; color:var(--clr-primary); font-weight:600;
              margin-bottom:14px; display:flex; align-items:center; gap:8px;
            ">
              🌙 <span id="nights-text">Calculating nights...</span>
            </div>

            <div class="divider"></div>

            <!-- === PRICING === -->
            <div class="section-title">💰 Pricing</div>
            <div class="form-row-3" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-fullprice">Full Price (LKR) *</label>
                <input type="number" id="bk-fullprice" class="form-control" placeholder="0.00" min="0" step="0.01" value="${b.fullPrice||''}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-advance">Advance Paid (LKR)</label>
                <input type="number" id="bk-advance" class="form-control" placeholder="0.00" min="0" step="0.01" value="${b.advancePaid||0}" />
              </div>
              <div class="form-group">
                <label class="form-label">Remaining (LKR)</label>
                <div class="form-control" id="bk-remaining" style="color:var(--clr-accent); font-weight:700; cursor:default;">
                  ${b.fullPrice ? formatCurrency((b.fullPrice||0) - (b.advancePaid||0)) : '—'}
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:14px">
              <label class="form-label" for="bk-notes">Special Notes / Requests</label>
              <textarea id="bk-notes" class="form-control" rows="2" placeholder="Any special requirements or notes...">${b.notes||''}</textarea>
            </div>

            <div class="divider"></div>

            <!-- === ADDITIONAL GUESTS === -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px">
              <div class="section-title" style="margin-bottom:0">👨‍👩‍👧 Additional Guests</div>
              <button type="button" class="btn btn-ghost btn-sm" id="add-guest-btn">+ Add Guest</button>
            </div>

            <div id="additional-guests">
              ${members.map((m,i) => renderGuestRow(i, m)).join('')}
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" id="booking-cancel-btn">Cancel</button>
          ${booking ? `<button type="button" class="btn btn-danger btn-sm" id="booking-delete-btn">🗑 Delete</button>` : ''}
          <button type="button" class="btn btn-accent" id="booking-save-btn">
            ${booking ? '💾 Update Booking' : '✅ Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  modalEl = document.getElementById('booking-modal-overlay');

  bindModalEvents();
  updateNights();
  updateRemaining();
}

function renderGuestRow(index, data = {}) {
  return `
    <div class="form-row guest-row" data-index="${index}" style="margin-bottom:10px; align-items:flex-end">
      <div class="form-group">
        <label class="form-label">Guest ${index+2} Name</label>
        <input type="text" class="form-control guest-name" placeholder="Full name" value="${data.name||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Passport / NIC</label>
        <input type="text" class="form-control guest-passport" placeholder="Passport number" value="${data.passport||''}" />
      </div>
      <button type="button" class="btn btn-danger btn-sm remove-guest" data-index="${index}" style="flex-shrink:0; height:42px">✕</button>
    </div>
  `;
}

function bindModalEvents() {
  const overlay = document.getElementById('booking-modal-overlay');

  // Close
  document.getElementById('booking-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('booking-cancel-btn')?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', handleEscape);

  // Nights update
  document.getElementById('bk-checkin')?.addEventListener('change', updateNights);
  document.getElementById('bk-checkout')?.addEventListener('change', updateNights);

  // Remaining update
  document.getElementById('bk-fullprice')?.addEventListener('input', updateRemaining);
  document.getElementById('bk-advance')?.addEventListener('input', updateRemaining);

  // Add guest
  document.getElementById('add-guest-btn')?.addEventListener('click', () => {
    const container = document.getElementById('additional-guests');
    const count = container.querySelectorAll('.guest-row').length;
    container.insertAdjacentHTML('beforeend', renderGuestRow(count));
    bindRemoveGuest();
  });

  bindRemoveGuest();

  // Save
  document.getElementById('booking-save-btn')?.addEventListener('click', saveBooking);

  // Delete
  document.getElementById('booking-delete-btn')?.addEventListener('click', handleDelete);
}

function bindRemoveGuest() {
  document.querySelectorAll('.remove-guest').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.guest-row').remove();
      // Re-index labels
      document.querySelectorAll('.guest-row').forEach((row, i) => {
        row.querySelector('label')?.closest('.form-group')?.querySelector('label') &&
          (row.querySelector('.form-group label').textContent = `Guest ${i+2} Name`);
      });
    };
  });
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  document.removeEventListener('keydown', handleEscape);
  const overlay = document.getElementById('booking-modal-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  }
}

function updateNights() {
  const ci = document.getElementById('bk-checkin')?.value;
  const co = document.getElementById('bk-checkout')?.value;
  const display = document.getElementById('nights-text');
  if (!ci || !co || !display) return;
  const nights = Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000));
  display.textContent = nights === 0
    ? '⚠️ Check-out must be after check-in'
    : `${nights} night${nights > 1 ? 's' : ''} · ${new Date(ci).toLocaleDateString('en-LK', {weekday:'short',month:'short',day:'numeric'})} → ${new Date(co).toLocaleDateString('en-LK', {weekday:'short',month:'short',day:'numeric'})}`;
}

function updateRemaining() {
  const full = parseFloat(document.getElementById('bk-fullprice')?.value) || 0;
  const adv  = parseFloat(document.getElementById('bk-advance')?.value) || 0;
  const rem = full - adv;
  const el = document.getElementById('bk-remaining');
  if (el) {
    el.textContent = formatCurrency(rem);
    el.style.color = rem <= 0 ? 'var(--clr-success)' : 'var(--clr-accent)';
  }
}

async function saveBooking() {
  const name    = document.getElementById('bk-name')?.value?.trim();
  const phone   = document.getElementById('bk-phone')?.value?.trim();
  const checkIn = document.getElementById('bk-checkin')?.value;
  const checkOut= document.getElementById('bk-checkout')?.value;
  const fullPrice = parseFloat(document.getElementById('bk-fullprice')?.value);

  if (!name) { showToast('Please enter guest name', 'error'); return; }
  if (!phone) { showToast('Please enter phone number', 'error'); return; }
  if (!checkIn || !checkOut) { showToast('Please select dates', 'error'); return; }
  if (new Date(checkOut) <= new Date(checkIn)) { showToast('Check-out must be after check-in', 'error'); return; }
  if (!fullPrice || fullPrice <= 0) { showToast('Please enter the full price', 'error'); return; }

  const advancePaid = parseFloat(document.getElementById('bk-advance')?.value) || 0;

  // Collect additional guests
  const additionalGuests = [];
  document.querySelectorAll('.guest-row').forEach(row => {
    const gName = row.querySelector('.guest-name')?.value?.trim();
    const gPass = row.querySelector('.guest-passport')?.value?.trim();
    if (gName) additionalGuests.push({ name: gName, passport: gPass || '' });
  });

  const data = {
    guestName: name,
    phone,
    roomNumber: parseInt(document.getElementById('bk-room')?.value),
    acType: document.getElementById('bk-ac')?.value,
    bedType: document.getElementById('bk-bed')?.value,
    meals: document.getElementById('bk-meals')?.value,
    checkIn,
    checkOut,
    fullPrice,
    advancePaid,
    remaining: fullPrice - advancePaid,
    passportNumber: document.getElementById('bk-passport')?.value?.trim() || '',
    companyName: document.getElementById('bk-company')?.value?.trim() || '',
    source: document.getElementById('bk-source')?.value,
    specialBirthday: document.getElementById('bk-birthday')?.checked || false,
    notes: document.getElementById('bk-notes')?.value?.trim() || '',
    additionalGuests,
  };

  showSpinner();
  try {
    if (currentBooking) {
      await updateBooking(currentBooking.id, data);
      showToast('Booking updated successfully! 🎉', 'success');
    } else {
      await createBooking(data);
      showToast('Booking confirmed! 🎉', 'success');
    }
    hideSpinner();
    closeModal();
    if (onSavedCallback) onSavedCallback(data);
  } catch (err) {
    hideSpinner();
    console.error(err);
    showToast('Failed to save booking: ' + err.message, 'error');
  }
}

async function handleDelete() {
  if (!currentBooking) return;
  if (!confirm(`Delete booking for ${currentBooking.guestName}? This cannot be undone.`)) return;

  showSpinner();
  try {
    const { deleteBooking } = await import('../services/bookingService.js');
    await deleteBooking(currentBooking.id);
    showToast('Booking deleted', 'info');
    hideSpinner();
    closeModal();
    if (onSavedCallback) onSavedCallback(null);
  } catch (err) {
    hideSpinner();
    showToast('Failed to delete: ' + err.message, 'error');
  }
}
