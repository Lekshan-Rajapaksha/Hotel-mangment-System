// src/components/bookingModal.js — Full booking form modal
import { createBooking, updateBooking, getNextBookingNumber, formatBookingNumber } from '../services/bookingService.js';
import { showToast, showSpinner, hideSpinner } from '../utils/toast.js';
import { toDateStr, formatCurrency } from '../utils/dateHelpers.js';
import { calculateGroupAdvanceDistribution } from '../utils/billingHelpers.js';
import { openPrintBill, openConsolidatedPrintBill } from './printBill.js';
import { getPrices, DEFAULT_PRICES } from '../services/priceService.js';

let modalEl = null;
let currentBooking = null;
let onSavedCallback = null;
let _allBookings = []; // cache of all active bookings for conflict detection
let _prices = { ...DEFAULT_PRICES }; // cached price log — loaded fresh each time modal opens
let _relatedGroupBookings = []; // all bookings belonging to the same group/guest when editing

export async function openBookingModal(opts = {}) {
  const { booking = null, defaultRoom = 1, defaultDate = null, onSaved = () => {}, allBookings = [] } = opts;
  _allBookings = allBookings;
  currentBooking = booking;
  onSavedCallback = onSaved;

  // Identify if this booking is part of a multi-room group reservation
  _relatedGroupBookings = [];
  if (booking) {
    const bCi = booking.checkIn?.toDate ? booking.checkIn.toDate() : new Date(booking.checkIn);
    const bCo = booking.checkOut?.toDate ? booking.checkOut.toDate() : new Date(booking.checkOut);
    _relatedGroupBookings = (_allBookings || []).filter(other => {
      if (!other || other.status === 'cancelled') return false;
      if (booking.groupBookingId && other.groupBookingId && other.groupBookingId === booking.groupBookingId) {
        return true;
      }
      const matchPhone = booking.phone && other.phone && String(booking.phone).trim() === String(other.phone).trim();
      const matchName = booking.guestName && other.guestName && booking.guestName.toLowerCase().trim() === other.guestName.toLowerCase().trim();
      if (!matchPhone && !matchName) return false;
      const oCi = other.checkIn?.toDate ? other.checkIn.toDate() : new Date(other.checkIn);
      const oCo = other.checkOut?.toDate ? other.checkOut.toDate() : new Date(other.checkOut);
      return (bCi < oCo && bCo > oCi);
    });
  }

  const isGroupEdit = Boolean(booking && _relatedGroupBookings.length > 1);
  const groupTotalAdvance = isGroupEdit ? _relatedGroupBookings.reduce((sum, item) => sum + (Number(item.advancePaid) || 0), 0) : 0;
  const groupTotalFullPrice = isGroupEdit ? _relatedGroupBookings.reduce((sum, item) => sum + (Number(item.fullPrice) || 0), 0) : 0;
  const groupTotalDiscount = isGroupEdit ? _relatedGroupBookings.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0) : 0;

  // Load latest prices from Price Log (Firestore) — fall back to defaults silently
  try { _prices = await getPrices(); } catch (_) { _prices = { ...DEFAULT_PRICES }; }

  // Resolve booking number (either existing or next sequential number starting from 01)
  let bookingNo = booking?.bookingNumber || '';
  if (!booking && !bookingNo) {
    try {
      bookingNo = await getNextBookingNumber();
    } catch (_) {
      bookingNo = '01';
    }
  } else if (bookingNo) {
    bookingNo = formatBookingNumber(bookingNo);
  }

  // Remove existing modal
  document.querySelector('.modal-overlay')?.remove();

  const today = toDateStr(new Date());
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));

  const b = booking || {};
  const checkInVal  = b.checkIn  ? toDateStr(b.checkIn?.toDate ? b.checkIn.toDate()  : new Date(b.checkIn))  : (defaultDate || today);
  const checkOutVal = b.checkOut ? toDateStr(b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut)) : (defaultDate ? toDateStr(new Date(new Date(defaultDate).getTime() + 86400000)) : tomorrow);

  const members = b.additionalGuests || [];
  const extraCharges = b.extraCharges || [];

  const html = `
    <div class="modal-overlay" id="booking-modal-overlay">
      <div class="modal modal-lg" id="booking-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-bk">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title-bk" style="display:flex; align-items:center; gap:8px">
              ${booking ? `✏️ Edit Booking <span class="badge badge-accent">#${bookingNo}</span>` : `➕ New Booking <span class="badge badge-primary">#${bookingNo}</span>`}
            </h2>
            <div id="modal-subtitle-bk" style="font-size:0.78rem;color:var(--clr-text-muted);margin-top:2px">
              Room ${b.roomNumber || defaultRoom} · ${booking ? 'Update guest details' : 'Fill in guest details'}
            </div>
          </div>
          <button class="modal-close" id="booking-modal-close" aria-label="Close">✕</button>
        </div>

        <div class="modal-body" id="booking-modal-body">
          <form id="booking-form" novalidate>
            <input type="hidden" id="bk-number" value="${bookingNo}" />

            <!-- === GUEST INFO === -->
            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center">
              <span>👤 Guest Information</span>
              <span class="badge badge-primary" style="font-size:0.8rem; font-weight:700">Booking #${bookingNo}</span>
            </div>
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
                <div style="display:flex; flex-direction:column; gap:8px">

                  <!-- Birthday -->
                  <label class="toggle-wrap" style="height:38px; padding:0 14px; border:1px solid var(--clr-border); border-radius:6px; background:var(--clr-surface)">
                    <span class="toggle">
                      <input type="checkbox" id="bk-birthday" ${b.specialBirthday?'checked':''} />
                      <span class="toggle-slider"></span>
                    </span>
                    <span style="font-size:0.85rem; color:var(--clr-text)">🎂 Birthday</span>
                  </label>
                  <div id="bk-birthday-date-wrap" style="display:${b.specialBirthday?'flex':'none'}; align-items:center; gap:8px; padding:8px 14px; background:var(--clr-primary-dim); border:1px solid rgba(108,138,255,0.25); border-radius:6px">
                    <span style="font-size:0.8rem; color:var(--clr-primary); white-space:nowrap">🎂 Birthday date</span>
                    <input type="date" id="bk-birthday-date" class="form-control"
                      style="flex:1; height:34px; font-size:0.82rem"
                      value="${b.birthdayDate||''}"
                      min="${checkInVal}" max="${checkOutVal}" />
                  </div>

                  <!-- Anniversary -->
                  <label class="toggle-wrap" style="height:38px; padding:0 14px; border:1px solid var(--clr-border); border-radius:6px; background:var(--clr-surface)">
                    <span class="toggle">
                      <input type="checkbox" id="bk-anniversary" ${b.specialAnniversary?'checked':''} />
                      <span class="toggle-slider"></span>
                    </span>
                    <span style="font-size:0.85rem; color:var(--clr-text)">💑 Anniversary</span>
                  </label>
                  <div id="bk-anniversary-date-wrap" style="display:${b.specialAnniversary?'flex':'none'}; align-items:center; gap:8px; padding:8px 14px; background:rgba(255,182,193,0.12); border:1px solid rgba(255,105,180,0.25); border-radius:6px">
                    <span style="font-size:0.8rem; color:#e879a0; white-space:nowrap">💑 Anniversary date</span>
                    <input type="date" id="bk-anniversary-date" class="form-control"
                      style="flex:1; height:34px; font-size:0.82rem"
                      value="${b.anniversaryDate||''}"
                      min="${checkInVal}" max="${checkOutVal}" />
                  </div>

                </div>
              </div>
            </div>

            <div class="divider"></div>

            ${!booking ? `
            <!-- === RESERVATION TYPE SELECTOR === -->
            <div style="background:var(--clr-surface-alt, rgba(255,255,255,0.03)); border:1px solid var(--clr-border); border-radius:10px; padding:12px 14px; margin-bottom:16px">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
                <span style="font-weight:700; font-size:0.85rem; color:var(--clr-text)">📋 Reservation Type</span>
                <span id="bk-multi-badge" class="badge badge-accent" style="display:none; font-size:0.75rem">Group / Buyout Mode</span>
              </div>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
                <label style="display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:8px; border:1px solid var(--clr-border); cursor:pointer; background:var(--clr-surface); font-size:0.84rem; font-weight:600">
                  <input type="radio" name="bk-mode" id="bk-mode-single" value="single" checked style="accent-color:var(--clr-primary); width:16px; height:16px" />
                  <span>🛏️ Single Room</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:8px; border:1px solid var(--clr-border); cursor:pointer; background:var(--clr-surface); font-size:0.84rem; font-weight:600">
                  <input type="radio" name="bk-mode" id="bk-mode-multi" value="multi" style="accent-color:var(--clr-primary); width:16px; height:16px" />
                  <span>🏨 Multi-Room / Event Buyout</span>
                </label>
              </div>
            </div>
            ` : ''}

            <!-- === STAY DETAILS === -->
            <div class="section-title">🏠 Room & Stay Details</div>
            
            <!-- Single room select (default) -->
            <div id="bk-single-room-group" class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-room">Room Number *</label>
                <select id="bk-room" class="form-control" required>
                  ${[100, 101, 102, 103, 104, 105, 106].map(n => `<option value="${n}" ${(b.roomNumber||defaultRoom)==n?'selected':''}>${n}</option>`).join('')}
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

            <!-- Multi-room selection card (visible when multi-mode chosen) -->
            <div id="bk-multi-rooms-section" style="display:none; margin-bottom:16px; padding:14px; background:linear-gradient(135deg, rgba(108,138,255,0.06), rgba(167,139,250,0.06)); border:1.5px solid rgba(108,138,255,0.3); border-radius:10px">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px">
                <div>
                  <div style="font-weight:700; font-size:0.9rem; color:var(--clr-text)">Select Rooms for Group / Event</div>
                  <div style="font-size:0.75rem; color:var(--clr-text-muted)" id="bk-multi-count-summary">0 rooms selected</div>
                </div>
                <div style="display:flex; gap:6px">
                  <button type="button" class="btn btn-sm btn-primary" id="btn-select-all-rooms" style="font-size:0.75rem; padding:5px 12px; font-weight:600">
                    ⚡ Select All 7 Rooms (Whole Hotel Buyout)
                  </button>
                  <button type="button" class="btn btn-sm btn-outline" id="btn-clear-all-rooms" style="font-size:0.75rem; padding:5px 10px">
                    Clear
                  </button>
                </div>
              </div>
              <div id="bk-multi-rooms-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px"></div>
              <div id="bk-multi-calc-hint" style="margin-top:10px; font-size:0.8rem; color:var(--clr-primary); font-weight:600; display:none"></div>
            </div>

            <!-- AC selection for Multi-Room mode -->
            <div id="bk-multi-ac-row" class="form-row" style="margin-bottom:14px; display:none">
              <div class="form-group">
                <label class="form-label" for="bk-ac-multi">Air Conditioning (All Selected Rooms)</label>
                <select id="bk-ac-multi" class="form-control">
                  <option value="AC" ${(b.acType||'AC')==='AC'?'selected':''}>AC Rooms</option>
                  <option value="NonAC" ${b.acType==='NonAC'?'selected':''}>Non-AC Rooms</option>
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

            <!-- Number of Guests -->
            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-persons">Number of Guests</label>
                <select id="bk-persons" class="form-control">
                  ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${(b.guestCount || ((b.additionalGuests?.length||0)+1))===n?'selected':''}>${n} Guest${n>1?'s':''}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="display:flex; align-items:flex-end">
                <div style="width:100%; padding:10px 14px; background:var(--clr-primary-dim); border:1px solid rgba(108,138,255,0.2); border-radius:6px; font-size:0.8rem; color:var(--clr-primary); line-height:1.5">
                  💡 <strong>Tip:</strong> Guest count is used to auto-calculate meal plan costs.
                </div>
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

            <!-- Availability warning -->
            <div id="bk-avail-warning" style="
              display:none; padding:12px 16px;
              background:rgba(239,68,68,0.12);
              border:1px solid rgba(239,68,68,0.4); border-radius:8px;
              font-size:0.84rem; color:#ef4444; font-weight:600;
              margin-bottom:14px; align-items:flex-start; gap:10px;
            ">
              <span style="font-size:1.2rem;line-height:1">🚫</span>
              <span id="bk-avail-msg"></span>
            </div>

            <div class="divider"></div>

            ${isGroupEdit ? `
            <!-- === GROUP STAY DETECTED (EDIT MODE) === -->
            <div style="background:linear-gradient(135deg, rgba(108,138,255,0.08), rgba(167,139,250,0.08)); border:1.5px solid rgba(108,138,255,0.35); border-radius:10px; padding:12px 16px; margin-bottom:16px">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
                <div style="display:flex; align-items:center; gap:8px">
                  <span style="font-size:1.15rem">🏨</span>
                  <span style="font-weight:700; font-size:0.9rem; color:var(--clr-text)">Group Stay Detected (${_relatedGroupBookings.length} Rooms)</span>
                </div>
                <span class="badge badge-accent">Rooms: ${_relatedGroupBookings.map(r => r.roomNumber).sort((a,b)=>Number(a)-Number(b)).join(', ')}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--clr-text-muted); line-height:1.4; margin-bottom:10px">
                Total Group Bill: <strong>${formatCurrency(groupTotalFullPrice - groupTotalDiscount)}</strong> · Current Total Advance: <strong>${formatCurrency(groupTotalAdvance)}</strong>
              </div>
              <label style="display:flex; align-items:center; gap:10px; cursor:pointer; background:var(--clr-surface); padding:8px 12px; border-radius:6px; border:1px solid var(--clr-border); user-select:none">
                <input type="checkbox" id="bk-sync-group-advance" checked style="accent-color:var(--clr-primary); width:18px; height:18px; cursor:pointer" />
                <span style="font-size:0.82rem; font-weight:600; color:var(--clr-text)">
                  💰 Update Advance for ALL ${_relatedGroupBookings.length} Rooms (distributed proportionally)
                </span>
              </label>
            </div>
            ` : ''}

            <!-- === PRICING === -->
            <div class="section-title" style="margin-bottom:10px">💰 Pricing</div>
            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-priceperday" id="bk-priceperday-label">Price Per Day (LKR) *</label>
                <input type="number" id="bk-priceperday" class="form-control" placeholder="0.00" min="0" step="0.01" value="${b.pricePerDay||''}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-fullprice" id="bk-fullprice-label">Full Price (LKR) *</label>
                <input type="number" id="bk-fullprice" class="form-control" placeholder="0.00" min="0" step="0.01" value="${b.fullPrice||''}" required />
              </div>
            </div>
            <div class="form-row" style="margin-bottom:8px">
              <div class="form-group">
                <label class="form-label" for="bk-advance" id="bk-advance-label">
                  ${isGroupEdit ? `Total Group Advance (${_relatedGroupBookings.length} Rooms) (LKR)` : 'Advance Paid (LKR)'}
                </label>
                <input type="number" id="bk-advance" class="form-control" placeholder="0.00" min="0" step="0.01" value="${isGroupEdit ? (groupTotalAdvance || 0) : (b.advancePaid||0)}" />
              </div>
              <div class="form-group">
                <label class="form-label">Remaining (LKR)</label>
                <div class="form-control" id="bk-remaining" style="color:var(--clr-accent); font-weight:700; cursor:default;">
                  ${b.fullPrice ? formatCurrency((b.fullPrice||0) - (b.discountAmount||0) - (b.advancePaid||0)) : '—'}
                </div>
              </div>
            </div>

            <!-- Dynamic Advance Division Helper Banner -->
            <div id="bk-advance-split-banner" style="display:none; padding:10px 14px; margin-bottom:14px; background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08)); border:1.5px solid rgba(16,185,129,0.3); border-radius:8px">
              <div id="bk-advance-split-text" style="font-size:0.82rem; color:var(--clr-text)"></div>
            </div>
            <div class="form-row" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label" for="bk-discount-desc">Discount Description</label>
                <input type="text" id="bk-discount-desc" class="form-control" placeholder="e.g. Special Offer" value="${b.discountDesc||''}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="bk-discount">Discount Amount (LKR)</label>
                <input type="number" id="bk-discount" class="form-control" placeholder="0.00" min="0" step="0.01" value="${b.discountAmount||0}" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom:14px">
              <label class="form-label" for="bk-notes">Special Notes / Requests</label>
              <textarea id="bk-notes" class="form-control" rows="2" placeholder="Any special requirements or notes...">${b.notes||''}</textarea>
            </div>

            <div class="divider"></div>

            <!-- === EXTRA CHARGES === -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px">
              <div>
                <div class="section-title" style="margin-bottom:2px">✨ Extra Charges</div>
                <div style="font-size:0.78rem; color:var(--clr-text-muted)">Airport transfer, laundry, extra bed, scooter rental, etc.</div>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" id="add-extra-charge-btn">+ Add Extra Charge</button>
            </div>

            <div id="extra-charges-container">
              ${extraCharges.map((ec, i) => renderExtraChargeRow(i, ec)).join('')}
            </div>

            <div id="extra-charges-total-bar" style="padding:10px 14px; background:var(--clr-surface-alt, rgba(255,255,255,0.03)); border:1px dashed var(--clr-border); border-radius:8px; margin-bottom:14px; font-size:0.85rem">
              <div style="display:flex; justify-content:space-between; align-items:center">
                <span style="color:var(--clr-text-muted); font-weight:600">Extra Charges Subtotal:</span>
                <span id="extra-charges-base-val" style="font-weight:600">LKR 0.00</span>
              </div>
              <div id="extra-charges-sc-row" style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:0.82rem; color:var(--clr-accent)">
                <span>🍽️ Service Charge (10% on Meals):</span>
                <span id="extra-charges-sc-val" style="font-weight:700">+ LKR 0.00</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding-top:6px; border-top:1px dashed var(--clr-border)">
                <span style="font-weight:700; color:var(--clr-text)">Total Extra + Service Charge:</span>
                <span id="extra-charges-total-val" style="font-weight:800; color:var(--clr-primary)">LKR 0.00</span>
              </div>
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
          ${booking ? `
            <button type="button" class="btn btn-secondary" id="booking-direct-print-btn" style="display:flex;align-items:center;gap:6px">
              🖨️ Print Bill
            </button>
          ` : ''}
          <button type="button" class="btn btn-accent" id="booking-save-btn">
            ${booking ? '💾 Update Booking' : '✅ Confirm Booking'}
          </button>
          <button type="button" class="btn btn-primary" id="booking-save-print-btn" style="display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#6c8aff,#a78bfa);border:none">
            🖨️ ${booking ? 'Update &amp; Print Bill' : 'Confirm &amp; Print Bill'}
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
  updateAvailabilityWarning();
  calcAndFill(); // auto-calculate on open if dates & type are set
  updateExtraChargesSummary();
}

function renderExtraChargeRow(index, data = {}) {
  const isMeal = Boolean(data.isMeal);
  return `
    <div class="extra-charge-row" data-index="${index}" style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:10px; padding:10px 12px; background:var(--clr-surface-alt, rgba(255,255,255,0.02)); border:1px solid var(--clr-border); border-radius:8px">
      <div class="form-group" style="flex:2; min-width:180px; margin-bottom:0">
        <label class="form-label" style="font-size:0.78rem">Charge Details / Service</label>
        <input type="text" class="form-control extra-charge-details" placeholder="e.g. Dinner, Laundry, Airport Transfer..." value="${escapeHtml(data.details || '')}" />
      </div>
      <div class="form-group" style="flex:1; min-width:110px; margin-bottom:0">
        <label class="form-label" style="font-size:0.78rem">Amount (LKR)</label>
        <input type="number" class="form-control extra-charge-amount" placeholder="0.00" min="0" step="0.01" value="${data.amount !== undefined ? data.amount : ''}" />
      </div>
      <div class="form-group" style="display:flex; align-items:center; gap:8px; height:42px; margin-bottom:0; padding:0 4px">
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.83rem; font-weight:600; cursor:pointer; color:var(--clr-text); white-space:nowrap; user-select:none" title="Tick for meals to automatically add a 10% service charge">
          <input type="checkbox" class="extra-charge-is-meal" ${isMeal ? 'checked' : ''} style="width:17px; height:17px; accent-color:var(--clr-primary); cursor:pointer" />
          <span>🍽️ Meal (+10% SC)</span>
        </label>
      </div>
      <button type="button" class="btn btn-danger btn-sm remove-extra-charge" data-index="${index}" style="flex-shrink:0; height:42px; width:42px; padding:0; display:flex; align-items:center; justify-content:center" title="Remove Charge">✕</button>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

  // Nights update + keep occasion date pickers in sync with stay range
  document.getElementById('bk-checkin')?.addEventListener('change', () => {
    updateNights();
    syncOccasionDateLimits();
    updateAvailabilityWarning();
    renderMultiRoomsGrid();
    calcAndFill();
  });
  document.getElementById('bk-checkout')?.addEventListener('change', () => {
    updateNights();
    syncOccasionDateLimits();
    updateAvailabilityWarning();
    renderMultiRoomsGrid();
    calcAndFill();
  });

  // Room change for availability warning
  document.getElementById('bk-room')?.addEventListener('change', () => {
    updateAvailabilityWarning();
    const subTitle = document.getElementById('modal-subtitle-bk');
    if (subTitle && !currentBooking) {
      subTitle.textContent = `Room ${document.getElementById('bk-room')?.value} · Fill in guest details`;
    }
  });

  // Reservation mode change (Single Room vs Multi-Room / Event Buyout)
  document.querySelectorAll('input[name="bk-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isMulti = e.target.value === 'multi';
      const singleWrap = document.getElementById('bk-single-room-group');
      const multiSec = document.getElementById('bk-multi-rooms-section');
      const multiAcRow = document.getElementById('bk-multi-ac-row');
      const multiBadge = document.getElementById('bk-multi-badge');
      const warningEl = document.getElementById('bk-avail-warning');
      const subTitle = document.getElementById('modal-subtitle-bk');
      const priceLabel = document.getElementById('bk-priceperday-label');
      const fullPriceLabel = document.getElementById('bk-fullprice-label');
      const saveBtn = document.getElementById('booking-save-btn');
      const savePrintBtn = document.getElementById('booking-save-print-btn');

      if (singleWrap) singleWrap.style.display = isMulti ? 'none' : 'flex';
      if (multiSec) multiSec.style.display = isMulti ? 'block' : 'none';
      if (multiAcRow) multiAcRow.style.display = isMulti ? 'flex' : 'none';
      if (multiBadge) multiBadge.style.display = isMulti ? 'inline-block' : 'none';

      if (priceLabel) priceLabel.textContent = isMulti ? 'Price Per Room / Day (LKR) *' : 'Price Per Day (LKR) *';
      if (fullPriceLabel) fullPriceLabel.textContent = isMulti ? 'Total Group Price (All Rooms) *' : 'Full Price (LKR) *';
      const advLabel = document.getElementById('bk-advance-label');
      if (advLabel && !currentBooking) {
        advLabel.textContent = isMulti ? 'Total Advance Paid by Buyer (All Selected Rooms) (LKR)' : 'Advance Paid (LKR)';
      }
      if (saveBtn) saveBtn.textContent = isMulti ? '💾 Confirm Group Booking' : (currentBooking ? '💾 Update Booking' : '✅ Confirm Booking');
      if (savePrintBtn) savePrintBtn.innerHTML = isMulti ? '🖨️ Confirm &amp; Print Combined Bill' : (currentBooking ? '🖨️ Update &amp; Print Bill' : '🖨️ Confirm &amp; Print Bill');

      if (subTitle) {
        subTitle.textContent = isMulti ? 'Multi-Room / Buyout Event · Fill in guest & group details' : `Room ${document.getElementById('bk-room')?.value || 100} · Fill in guest details`;
      }

      if (isMulti) {
        renderMultiRoomsGrid();
        if (warningEl) warningEl.style.display = 'none';
      } else {
        updateAvailabilityWarning();
      }
      calcAndFill();
    });
  });

  // Sync group advance checkbox for existing group bookings
  document.getElementById('bk-sync-group-advance')?.addEventListener('change', (e) => {
    const isSync = e.target.checked;
    const advInput = document.getElementById('bk-advance');
    const advLabel = document.getElementById('bk-advance-label');
    const groupCount = _relatedGroupBookings.length;
    const groupTotalAdv = _relatedGroupBookings.reduce((sum, item) => sum + (Number(item.advancePaid) || 0), 0);

    if (advLabel) {
      advLabel.textContent = isSync ? `Total Group Advance (${groupCount} Rooms) (LKR)` : 'Advance Paid (This Room Only) (LKR)';
    }
    if (advInput) {
      advInput.value = isSync ? (groupTotalAdv || '') : (currentBooking?.advancePaid || '');
    }
    updateRemaining();
  });

  document.getElementById('btn-select-all-rooms')?.addEventListener('click', () => {
    document.querySelectorAll('.bk-multi-room-cb:not(:disabled)').forEach(cb => {
      cb.checked = true;
      const card = cb.closest('.multi-room-card');
      if (card) {
        card.style.borderColor = 'var(--clr-primary)';
        card.style.background = 'var(--clr-primary-dim)';
      }
    });
    updateMultiCountSummary();
    calcAndFill();
  });

  document.getElementById('btn-clear-all-rooms')?.addEventListener('click', () => {
    document.querySelectorAll('.bk-multi-room-cb').forEach(cb => {
      cb.checked = false;
      const card = cb.closest('.multi-room-card');
      if (card) {
        card.style.borderColor = 'var(--clr-border)';
        card.style.background = 'var(--clr-surface)';
      }
    });
    updateMultiCountSummary();
    calcAndFill();
  });

  // Recalc full price when price per day changes
  document.getElementById('bk-priceperday')?.addEventListener('input', calcAndFill);

  // Remaining update
  document.getElementById('bk-fullprice')?.addEventListener('input', updateRemaining);
  document.getElementById('bk-advance')?.addEventListener('input', updateRemaining);
  document.getElementById('bk-discount')?.addEventListener('input', updateRemaining);

  // Add guest — sync persons selector
  document.getElementById('add-guest-btn')?.addEventListener('click', () => {
    const container = document.getElementById('additional-guests');
    const count = container.querySelectorAll('.guest-row').length;
    container.insertAdjacentHTML('beforeend', renderGuestRow(count));
    bindRemoveGuest();
    syncPersonsFromGuests();
  });

  bindRemoveGuest();

  // Toggle birthday date picker
  document.getElementById('bk-birthday')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('bk-birthday-date-wrap');
    if (wrap) wrap.style.display = e.target.checked ? 'flex' : 'none';
  });

  // Toggle anniversary date picker
  document.getElementById('bk-anniversary')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('bk-anniversary-date-wrap');
    if (wrap) wrap.style.display = e.target.checked ? 'flex' : 'none';
  });

  // Save
  document.getElementById('booking-save-btn')?.addEventListener('click', () => saveBooking(false));

  // Save + Print
  document.getElementById('booking-save-print-btn')?.addEventListener('click', () => saveBooking(true));

  // Direct Print
  document.getElementById('booking-direct-print-btn')?.addEventListener('click', () => {
    if (currentBooking) openPrintBill(currentBooking);
  });

  // Add Extra Charge
  document.getElementById('add-extra-charge-btn')?.addEventListener('click', () => {
    const container = document.getElementById('extra-charges-container');
    const count = container.querySelectorAll('.extra-charge-row').length;
    container.insertAdjacentHTML('beforeend', renderExtraChargeRow(count));
    bindExtraChargeEvents();
    container.querySelector('.extra-charge-row:last-child .extra-charge-details')?.focus();
  });

  bindExtraChargeEvents();

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
      syncPersonsFromGuests();
    };
  });
}

/** Keep the persons dropdown in sync when guests are added/removed */
function syncPersonsFromGuests() {
  const guestCount = document.querySelectorAll('#additional-guests .guest-row').length;
  const total = guestCount + 1; // main guest + additional
  const sel = document.getElementById('bk-persons');
  if (sel) {
    const currentVal = parseInt(sel.value) || 0;
    // Expand options if needed (up to 10)
    const max = Math.max(total, 6, currentVal);
    if (sel.options.length < max) {
      for (let i = sel.options.length + 1; i <= max; i++) {
        sel.add(new Option(`${i} Guests`, i));
      }
    }
    if (currentVal < total) {
      sel.value = String(total);
    }
  }
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

// ---------------------------------------------------------------------------
// Availability / conflict helpers
// ---------------------------------------------------------------------------

/**
 * Returns the booked date ranges for a given room, excluding the booking
 * currently being edited (so edits don't self-conflict).
 */
function getBookedRangesForRoom(roomNumber) {
  return _allBookings
    .filter(b => b.roomNumber === roomNumber && b.id !== currentBooking?.id)
    .map(b => ({
      checkIn:  toDateStr(b.checkIn?.toDate  ? b.checkIn.toDate()  : new Date(b.checkIn)),
      checkOut: toDateStr(b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut)),
      guestName: b.guestName
    }));
}

/**
 * Returns the conflicting booking if the proposed [newCheckIn, newCheckOut)
 * overlaps any existing range, or null if available.
 */
function checkDateConflict(roomNumber, newCheckIn, newCheckOut) {
  if (!newCheckIn || !newCheckOut) return null;
  const ranges = getBookedRangesForRoom(roomNumber);
  for (const r of ranges) {
    // Overlap condition: newCheckIn < existingCheckOut AND newCheckOut > existingCheckIn
    if (newCheckIn < r.checkOut && newCheckOut > r.checkIn) {
      return r;
    }
  }
  return null;
}

/**
 * Shows or hides the availability warning banner inside the modal.
 */
function updateAvailabilityWarning() {
  const isMulti = !currentBooking && !!document.getElementById('bk-mode-multi')?.checked;
  const warningEl = document.getElementById('bk-avail-warning');
  if (isMulti) {
    if (warningEl) warningEl.style.display = 'none';
    updateMultiCountSummary();
    return;
  }

  const roomEl    = document.getElementById('bk-room');
  const checkIn   = document.getElementById('bk-checkin')?.value;
  const checkOut  = document.getElementById('bk-checkout')?.value;
  const saveBtn   = document.getElementById('booking-save-btn');
  const savePrintBtn = document.getElementById('booking-save-print-btn');
  if (!warningEl || !saveBtn) return;

  const room = parseInt(roomEl?.value || '0');
  const conflict = checkDateConflict(room, checkIn, checkOut);

  if (conflict) {
    warningEl.style.display = 'flex';
    warningEl.querySelector('#bk-avail-msg').textContent =
      `Room ${room} is already booked by "${conflict.guestName}" from ${conflict.checkIn} to ${conflict.checkOut}. Please choose different dates or a different room.`;
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.5';
    saveBtn.style.cursor = 'not-allowed';
    if (savePrintBtn) {
      savePrintBtn.disabled = true;
      savePrintBtn.style.opacity = '0.5';
      savePrintBtn.style.cursor = 'not-allowed';
    }
  } else {
    warningEl.style.display = 'none';
    saveBtn.disabled = false;
    saveBtn.style.opacity = '';
    saveBtn.style.cursor = '';
    if (savePrintBtn) {
      savePrintBtn.disabled = false;
      savePrintBtn.style.opacity = '';
      savePrintBtn.style.cursor = '';
    }
  }
}

/**
 * Renders the multi-room selection grid with live date-conflict indicators
 */
function renderMultiRoomsGrid() {
  const grid = document.getElementById('bk-multi-rooms-grid');
  if (!grid) return;
  const ci = document.getElementById('bk-checkin')?.value;
  const co = document.getElementById('bk-checkout')?.value;
  const allRooms = [100, 101, 102, 103, 104, 105, 106];

  // Preserve existing user checks if any
  const previouslyChecked = new Set(
    Array.from(grid.querySelectorAll('.bk-multi-room-cb:checked')).map(cb => parseInt(cb.value))
  );

  grid.innerHTML = allRooms.map(room => {
    const conflict = checkDateConflict(room, ci, co);
    const isBooked = !!conflict;
    // Default to checked if user hasn't unchecked, or if newly opened
    const isChecked = !isBooked && (previouslyChecked.size > 0 ? previouslyChecked.has(room) : true);

    return `
      <label class="multi-room-card" data-room="${room}" style="
        display:flex; flex-direction:column; justify-content:space-between;
        padding:9px 11px; border-radius:8px;
        border:1.5px solid ${isBooked ? 'rgba(239,68,68,0.45)' : isChecked ? 'var(--clr-primary)' : 'var(--clr-border)'};
        background:${isBooked ? 'rgba(239,68,68,0.06)' : isChecked ? 'var(--clr-primary-dim)' : 'var(--clr-surface)'};
        cursor:${isBooked ? 'not-allowed' : 'pointer'};
        opacity:${isBooked ? '0.6' : '1'};
        transition:all 0.15s ease;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
          <span style="font-weight:700; font-size:0.95rem; color:${isBooked ? '#ef4444' : 'var(--clr-text)'}">
            Room ${room}
          </span>
          <input type="checkbox" value="${room}" class="bk-multi-room-cb"
            ${isChecked ? 'checked' : ''} ${isBooked ? 'disabled' : ''}
            style="accent-color:var(--clr-primary); width:18px; height:18px; cursor:${isBooked ? 'not-allowed' : 'pointer'}" />
        </div>
        <div style="font-size:0.72rem; color:${isBooked ? '#ef4444' : 'var(--clr-text-muted)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="${isBooked ? `Booked by ${conflict.guestName} (${conflict.checkIn} to ${conflict.checkOut})` : 'Available for booking'}">
          ${isBooked ? `⚠️ Booked (${conflict.guestName})` : '✅ Available'}
        </div>
      </label>
    `;
  }).join('');

  grid.querySelectorAll('.bk-multi-room-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const card = cb.closest('.multi-room-card');
      if (card) {
        card.style.borderColor = cb.checked ? 'var(--clr-primary)' : 'var(--clr-border)';
        card.style.background = cb.checked ? 'var(--clr-primary-dim)' : 'var(--clr-surface)';
      }
      updateMultiCountSummary();
      calcAndFill();
    });
  });

  updateMultiCountSummary();
}

/**
 * Updates selected rooms count summary and enables/disables save buttons in multi-room mode
 */
function updateMultiCountSummary() {
  const isMulti = !currentBooking && !!document.getElementById('bk-mode-multi')?.checked;
  const checked = document.querySelectorAll('.bk-multi-room-cb:checked');
  const countEl = document.getElementById('bk-multi-count-summary');
  const saveBtn = document.getElementById('booking-save-btn');
  const savePrintBtn = document.getElementById('booking-save-print-btn');
  const count = checked.length;

  if (countEl) {
    const list = Array.from(checked).map(c => c.value).join(', ');
    countEl.textContent = count === 0
      ? '0 rooms selected (Please select at least 1 room)'
      : `${count} of 7 rooms selected [${list}]`;
  }

  if (isMulti) {
    const disabled = count === 0;
    if (saveBtn) {
      saveBtn.disabled = disabled;
      saveBtn.style.opacity = disabled ? '0.5' : '';
      saveBtn.style.cursor = disabled ? 'not-allowed' : '';
    }
    if (savePrintBtn) {
      savePrintBtn.disabled = disabled;
      savePrintBtn.style.opacity = disabled ? '0.5' : '';
      savePrintBtn.style.cursor = disabled ? 'not-allowed' : '';
    }
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

/** Keep birthday/anniversary date pickers constrained to the stay range */
function syncOccasionDateLimits() {
  const ci = document.getElementById('bk-checkin')?.value;
  const co = document.getElementById('bk-checkout')?.value;
  if (!ci || !co) return;

  const bdayInput = document.getElementById('bk-birthday-date');
  const annivInput = document.getElementById('bk-anniversary-date');

  [bdayInput, annivInput].forEach(input => {
    if (!input) return;
    input.min = ci;
    input.max = co;
    // If the currently selected date is now outside the range, clear it
    if (input.value && (input.value < ci || input.value > co)) {
      input.value = '';
    }
  });
}


function updateRemaining() {
  const full = parseFloat(document.getElementById('bk-fullprice')?.value) || 0;
  const adv  = parseFloat(document.getElementById('bk-advance')?.value) || 0;
  const disc = parseFloat(document.getElementById('bk-discount')?.value) || 0;

  // Update Advance Division helper banner
  const isMulti = !currentBooking && !!document.getElementById('bk-mode-multi')?.checked;
  const isGroupEdit = Boolean(currentBooking && _relatedGroupBookings?.length > 1 && document.getElementById('bk-sync-group-advance')?.checked);
  const banner = document.getElementById('bk-advance-split-banner');
  const textEl = document.getElementById('bk-advance-split-text');

  let roomCount = 1;
  let roomNumbers = [];
  if (isMulti) {
    const checked = Array.from(document.querySelectorAll('.bk-multi-room-cb:checked')).map(cb => parseInt(cb.value));
    roomCount = checked.length || 1;
    roomNumbers = checked;
  } else if (isGroupEdit) {
    roomCount = _relatedGroupBookings.length;
    roomNumbers = _relatedGroupBookings.map(r => r.roomNumber).sort((a,b)=>Number(a)-Number(b));
  }

  let thisRoomAdv = adv;
  let thisRoomRem = Math.max(0, full - disc - adv);
  let totalGroupRem = thisRoomRem;

  if (isGroupEdit && roomCount > 1) {
    const groupForDist = _relatedGroupBookings.map(rb => {
      const isCur = (rb.id === currentBooking?.id);
      return {
        ...rb,
        fullPrice: isCur ? full : Number(rb.fullPrice || 0),
        discountAmount: isCur ? disc : Number(rb.discountAmount || 0),
      };
    });
    const dist = calculateGroupAdvanceDistribution(groupForDist, adv, 'proportional');
    const curDist = dist.find(d => d.booking.id === currentBooking?.id);
    if (curDist) {
      thisRoomAdv = curDist.advance;
      thisRoomRem = curDist.remaining;
    }
    totalGroupRem = dist.reduce((s, d) => s + d.remaining, 0);
  } else if (isMulti && roomCount > 1) {
    thisRoomAdv = Math.floor((adv / roomCount) * 100) / 100;
    thisRoomRem = Math.max(0, full - disc - thisRoomAdv);
    totalGroupRem = thisRoomRem * roomCount;
  }

  const el = document.getElementById('bk-remaining');
  if (el) {
    el.textContent = formatCurrency(thisRoomRem);
    el.style.color = thisRoomRem <= 0 ? 'var(--clr-success)' : 'var(--clr-accent)';
  }

  if (banner && textEl) {
    if ((isMulti || isGroupEdit) && roomCount > 1) {
      banner.style.display = 'block';
      textEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px">
          <span>⚡ <strong>Total Advance:</strong> ${formatCurrency(adv)} across ${roomCount} rooms · This room: <span style="color:var(--clr-success); font-weight:700">${formatCurrency(thisRoomAdv)}</span></span>
          <span style="font-size:0.75rem; color:var(--clr-text-muted)">Rooms: [${roomNumbers.join(', ')}]</span>
        </div>
        <div style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:3px">
          This room remaining: <strong>${formatCurrency(thisRoomRem)}</strong> (Total group balance due: <strong>${formatCurrency(totalGroupRem)}</strong>)
        </div>
      `;
    } else {
      banner.style.display = 'none';
    }
  }
}

function getExtraChargesData() {
  let extraChargesTotal = 0;
  let serviceChargeTotal = 0;

  document.querySelectorAll('.extra-charge-row').forEach(row => {
    const amt = parseFloat(row.querySelector('.extra-charge-amount')?.value) || 0;
    const isMeal = !!row.querySelector('.extra-charge-is-meal')?.checked;
    const itemAmt = Math.max(0, amt);
    const sc = isMeal ? Math.round(itemAmt * 0.10 * 100) / 100 : 0;

    extraChargesTotal += itemAmt;
    serviceChargeTotal += sc;
  });

  return {
    extraChargesTotal,
    serviceChargeTotal,
    combinedTotal: extraChargesTotal + serviceChargeTotal
  };
}

function getExtraChargesTotal() {
  return getExtraChargesData().combinedTotal;
}

function updateExtraChargesSummary() {
  const { extraChargesTotal, serviceChargeTotal, combinedTotal } = getExtraChargesData();
  const baseEl = document.getElementById('extra-charges-base-val');
  const scEl = document.getElementById('extra-charges-sc-val');
  const totalEl = document.getElementById('extra-charges-total-val');
  const scRow = document.getElementById('extra-charges-sc-row');

  if (baseEl) baseEl.textContent = formatCurrency(extraChargesTotal);
  if (scEl) scEl.textContent = `+ ${formatCurrency(serviceChargeTotal)}`;
  if (totalEl) totalEl.textContent = formatCurrency(combinedTotal);
  if (scRow) scRow.style.display = serviceChargeTotal > 0 ? 'flex' : 'none';
}

function bindExtraChargeEvents() {
  document.querySelectorAll('.remove-extra-charge').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.extra-charge-row')?.remove();
      calcAndFill();
    };
  });

  document.querySelectorAll('.extra-charge-amount').forEach(input => {
    input.oninput = () => {
      calcAndFill();
    };
  });

  document.querySelectorAll('.extra-charge-is-meal').forEach(cb => {
    cb.onchange = () => {
      calcAndFill();
    };
  });
}

/**
 * Auto-calculate the total price based on price per day plus extra charges and meal service charge.
 */
function calcAndFill() {
  const ci      = document.getElementById('bk-checkin')?.value;
  const co      = document.getElementById('bk-checkout')?.value;
  const pricePerDay = parseFloat(document.getElementById('bk-priceperday')?.value) || 0;
  const { combinedTotal } = getExtraChargesData();
  updateExtraChargesSummary();

  const priceInput = document.getElementById('bk-fullprice');
  if (!priceInput) return;

  const isMulti = !currentBooking && !!document.getElementById('bk-mode-multi')?.checked;
  const selectedRooms = isMulti
    ? Array.from(document.querySelectorAll('.bk-multi-room-cb:checked')).map(cb => parseInt(cb.value))
    : [1];
  const roomMultiplier = isMulti ? Math.max(1, selectedRooms.length) : 1;

  if (ci && co) {
    const nights = Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000));
    if (nights > 0 && pricePerDay > 0) {
      const roomTotal = pricePerDay * nights * roomMultiplier;
      const grandTotal = roomTotal + combinedTotal;
      priceInput.value = grandTotal.toFixed(2);

      const hint = document.getElementById('bk-multi-calc-hint');
      if (hint) {
        if (isMulti) {
          hint.style.display = 'block';
          hint.innerHTML = `💡 Group Breakdown: <strong>${roomMultiplier} room${roomMultiplier > 1 ? 's' : ''}</strong> × ${nights} night${nights > 1 ? 's' : ''} @ ${formatCurrency(pricePerDay)} = <strong>${formatCurrency(roomTotal)}</strong>${combinedTotal > 0 ? ` (+ Extras ${formatCurrency(combinedTotal)})` : ''}`;
        } else {
          hint.style.display = 'none';
        }
      }

      updateRemaining();
      return;
    }
  }

  // If pricePerDay is not set or 0, but extra charges exist and price is empty
  if (combinedTotal > 0 && (!priceInput.value || parseFloat(priceInput.value) === 0)) {
    priceInput.value = combinedTotal.toFixed(2);
  }
  updateRemaining();
}

async function saveBooking(andPrint = false) {
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

  const isMulti = !currentBooking && !!document.getElementById('bk-mode-multi')?.checked;

  const advancePaid = parseFloat(document.getElementById('bk-advance')?.value) || 0;
  const discountAmount = parseFloat(document.getElementById('bk-discount')?.value) || 0;
  const discountDesc = document.getElementById('bk-discount-desc')?.value?.trim() || '';

  // Collect additional guests
  const additionalGuests = [];
  document.querySelectorAll('.guest-row').forEach(row => {
    const gName = row.querySelector('.guest-name')?.value?.trim();
    const gPass = row.querySelector('.guest-passport')?.value?.trim();
    if (gName) additionalGuests.push({ name: gName, passport: gPass || '' });
  });

  // Collect extra charges
  const extraCharges = [];
  document.querySelectorAll('.extra-charge-row').forEach(row => {
    const details = row.querySelector('.extra-charge-details')?.value?.trim();
    const amount = parseFloat(row.querySelector('.extra-charge-amount')?.value) || 0;
    const isMeal = !!row.querySelector('.extra-charge-is-meal')?.checked;
    const serviceCharge = isMeal ? Math.round(amount * 0.10 * 100) / 100 : 0;
    if (details || amount > 0) {
      extraCharges.push({
        details: details || (isMeal ? 'Meal Charge' : 'Extra Service'),
        amount,
        isMeal,
        serviceCharge
      });
    }
  });
  const extraChargesTotal = extraCharges.reduce((sum, item) => sum + item.amount, 0);
  const serviceChargeTotal = extraCharges.reduce((sum, item) => sum + (item.serviceCharge || 0), 0);

  // === MULTI-ROOM / EVENT BUYOUT CREATION ===
  if (isMulti) {
    const selectedRooms = Array.from(document.querySelectorAll('.bk-multi-room-cb:checked')).map(cb => parseInt(cb.value));
    if (selectedRooms.length === 0) {
      showToast('Please select at least 1 room for the group reservation', 'error');
      return;
    }

    // Check conflicts for all selected rooms
    for (const rm of selectedRooms) {
      const conf = checkDateConflict(rm, checkIn, checkOut);
      if (conf) {
        showToast(`Room ${rm} is already booked by "${conf.guestName}" (${conf.checkIn} → ${conf.checkOut}). Please uncheck it or choose different dates.`, 'error');
        return;
      }
    }

    if (selectedRooms.length > 1) {
      showSpinner();
      try {
        const count = selectedRooms.length;
        const nights = Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
        const pricePerDay = parseFloat(document.getElementById('bk-priceperday')?.value) || 0;

        const perRoomDiscount = Math.floor((discountAmount / count) * 100) / 100;
        const remDiscount = Math.round((discountAmount - (perRoomDiscount * count)) * 100) / 100;

        const baseNextNo = parseInt(await getNextBookingNumber(), 10);
        const groupBookingId = `GRP-${Date.now()}`;
        const acVal = document.getElementById('bk-ac-multi')?.value || document.getElementById('bk-ac')?.value || 'AC';

        // Pre-compute room bills to distribute advance proportionally
        const roomsToPrep = [];
        for (let i = 0; i < count; i++) {
          const isFirst = (i === 0);
          const rmDiscount = perRoomDiscount + (isFirst ? remDiscount : 0);
          const rmExtras = isFirst ? extraCharges : [];
          const rmExtrasTotal = isFirst ? extraChargesTotal : 0;
          const rmServiceTotal = isFirst ? serviceChargeTotal : 0;
          const rmFullPrice = (pricePerDay * nights) + rmExtrasTotal + rmServiceTotal;
          roomsToPrep.push({
            fullPrice: rmFullPrice,
            discountAmount: rmDiscount
          });
        }
        const dist = calculateGroupAdvanceDistribution(roomsToPrep, advancePaid, 'proportional');

        const createdBookings = [];
        for (let i = 0; i < count; i++) {
          const rm = selectedRooms[i];
          const isFirst = (i === 0);
          const rmAdvance = dist[i].advance;
          const rmDiscount = perRoomDiscount + (isFirst ? remDiscount : 0);
          const rmExtras = isFirst ? extraCharges : [];
          const rmExtrasTotal = isFirst ? extraChargesTotal : 0;
          const rmServiceTotal = isFirst ? serviceChargeTotal : 0;
          const rmFullPrice = roomsToPrep[i].fullPrice;
          const rmRemaining = dist[i].remaining;
          const rmBookingNumber = formatBookingNumber(baseNextNo + i);

          const roomData = {
            bookingNumber: rmBookingNumber,
            guestName: name,
            phone,
            roomNumber: rm,
            acType: acVal,
            bedType: document.getElementById('bk-bed')?.value,
            meals: document.getElementById('bk-meals')?.value,
            checkIn,
            checkOut,
            pricePerDay,
            fullPrice: rmFullPrice,
            advancePaid: rmAdvance,
            discountAmount: rmDiscount,
            discountDesc: isFirst ? discountDesc : (discountDesc ? `${discountDesc} (Split)` : ''),
            remaining: rmRemaining,
            passportNumber: document.getElementById('bk-passport')?.value?.trim() || '',
            companyName: document.getElementById('bk-company')?.value?.trim() || '',
            source: document.getElementById('bk-source')?.value,
            specialBirthday: document.getElementById('bk-birthday')?.checked || false,
            birthdayDate: document.getElementById('bk-birthday')?.checked ? (document.getElementById('bk-birthday-date')?.value || '') : '',
            specialAnniversary: document.getElementById('bk-anniversary')?.checked || false,
            anniversaryDate: document.getElementById('bk-anniversary')?.checked ? (document.getElementById('bk-anniversary-date')?.value || '') : '',
            notes: (document.getElementById('bk-notes')?.value?.trim() ? document.getElementById('bk-notes')?.value?.trim() + ' | ' : '') + `Group buyout: ${count} rooms [${selectedRooms.join(', ')}]`,
            additionalGuests: isFirst ? additionalGuests : [],
            guestCount: parseInt(document.getElementById('bk-persons')?.value) || 1,
            extraCharges: rmExtras,
            extraChargesTotal: rmExtrasTotal,
            serviceChargeTotal: rmServiceTotal,
            groupBookingId,
            groupRooms: selectedRooms,
            isGroupBooking: true
          };

          const docRef = await createBooking(roomData);
          createdBookings.push({
            ...roomData,
            id: docRef?.id || null
          });
        }

        hideSpinner();
        closeModal();
        showToast(`🎉 Group booking confirmed! ${count} rooms booked (${selectedRooms.join(', ')}).`, 'success');
        if (onSavedCallback) onSavedCallback(createdBookings[0]);
        if (andPrint) {
          openConsolidatedPrintBill(createdBookings, { allBookings: _allBookings });
        }
        return;
      } catch (err) {
        hideSpinner();
        console.error(err);
        showToast('Failed to save group booking: ' + err.message, 'error');
        return;
      }
    } else {
      // Exactly 1 room was selected in multi mode
      const singleEl = document.getElementById('bk-room');
      if (singleEl) singleEl.value = String(selectedRooms[0]);
    }
  }

  // Final conflict guard (in case UI warning was somehow bypassed)
  const roomNum = parseInt(document.getElementById('bk-room')?.value);
  const conflict = checkDateConflict(roomNum, checkIn, checkOut);
  if (conflict) {
    showToast(`Room ${roomNum} is already booked by "${conflict.guestName}" (${conflict.checkIn} → ${conflict.checkOut}). Choose different dates or room.`, 'error');
    updateAvailabilityWarning();
    return;
  }

  const bookingNumber = document.getElementById('bk-number')?.value || currentBooking?.bookingNumber || '';

  const data = {
    bookingNumber,
    guestName: name,
    phone,
    roomNumber: parseInt(document.getElementById('bk-room')?.value),
    acType: document.getElementById('bk-ac')?.value,
    bedType: document.getElementById('bk-bed')?.value,
    meals: document.getElementById('bk-meals')?.value,
    checkIn,
    checkOut,
    pricePerDay: parseFloat(document.getElementById('bk-priceperday')?.value) || 0,
    fullPrice,
    advancePaid,
    discountAmount,
    discountDesc,
    remaining: Math.max(0, fullPrice - discountAmount - advancePaid),
    passportNumber: document.getElementById('bk-passport')?.value?.trim() || '',
    companyName: document.getElementById('bk-company')?.value?.trim() || '',
    source: document.getElementById('bk-source')?.value,
    specialBirthday: document.getElementById('bk-birthday')?.checked || false,
    birthdayDate: document.getElementById('bk-birthday')?.checked
      ? (document.getElementById('bk-birthday-date')?.value || '')
      : '',
    specialAnniversary: document.getElementById('bk-anniversary')?.checked || false,
    anniversaryDate: document.getElementById('bk-anniversary')?.checked
      ? (document.getElementById('bk-anniversary-date')?.value || '')
      : '',
    notes: document.getElementById('bk-notes')?.value?.trim() || '',
    additionalGuests,
    guestCount: parseInt(document.getElementById('bk-persons')?.value) || 1,
    extraCharges,
    extraChargesTotal,
    serviceChargeTotal,
  };

  showSpinner();
  try {
    let savedId = currentBooking?.id;
    if (currentBooking) {
      const isGroupEdit = Boolean(_relatedGroupBookings?.length > 1 && document.getElementById('bk-sync-group-advance')?.checked);
      if (isGroupEdit) {
        const groupForDist = _relatedGroupBookings.map(rb => {
          const isCurrent = (rb.id === currentBooking.id);
          return {
            ...rb,
            fullPrice: isCurrent ? fullPrice : Number(rb.fullPrice || 0),
            discountAmount: isCurrent ? discountAmount : Number(rb.discountAmount || 0),
          };
        });

        const dist = calculateGroupAdvanceDistribution(groupForDist, advancePaid, 'proportional');
        for (let i = 0; i < dist.length; i++) {
          const d = dist[i];
          const rb = _relatedGroupBookings[i];
          const isCurrent = (rb.id === currentBooking.id);
          if (isCurrent) {
            data.advancePaid = d.advance;
            data.remaining = d.remaining;
            rb.fullPrice = fullPrice;
            rb.discountAmount = discountAmount;
            rb.advancePaid = d.advance;
            rb.remaining = d.remaining;
          } else {
            await updateBooking(rb.id, {
              advancePaid: d.advance,
              remaining: d.remaining
            });
            rb.advancePaid = d.advance;
            rb.remaining = d.remaining;
          }
        }
      }

      await updateBooking(currentBooking.id, data);
      showToast(isGroupEdit
        ? `Booking updated! Total advance of ${formatCurrency(advancePaid)} distributed proportionally across all ${_relatedGroupBookings.length} rooms! 🎉`
        : 'Booking updated successfully! 🎉', 'success');
    } else {
      const ref = await createBooking(data);
      savedId = ref?.id || null;
      showToast('Booking confirmed! 🎉', 'success');
    }
    hideSpinner();
    closeModal();
    if (onSavedCallback) onSavedCallback(data);
    if (andPrint) {
      openPrintBill({ ...data, id: savedId }, { allBookings: _allBookings });
    }
  } catch (err) {
    hideSpinner();
    console.error(err);
    showToast('Failed to save booking: ' + err.message, 'error');
  }
}

async function handleDelete() {
  if (!currentBooking) return;

  // Determine if the booking is in the past
  const checkOut = currentBooking.checkOut?.toDate
    ? currentBooking.checkOut.toDate()
    : new Date(currentBooking.checkOut);
  const isPast = checkOut < new Date();

  if (isPast) {
    // Block deletion of past bookings entirely
    showDeleteBlockedDialog(currentBooking.guestName, checkOut);
    return;
  }

  // Future booking → show delete-request dialog (sends to admin for approval)
  showDeleteRequestDialog(currentBooking);
}

function showDeleteBlockedDialog(guestName, checkOutDate) {
  document.querySelector('#dr-blocked-dialog')?.remove();
  const formatted = checkOutDate.toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `
    <div class="modal-overlay" id="dr-blocked-dialog" style="z-index:1100">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h2 class="modal-title">🚫 Cannot Delete Past Booking</h2>
          <button class="modal-close" id="dr-blocked-close">✕</button>
        </div>
        <div class="modal-body" style="text-align:center; padding:28px 24px">
          <div style="font-size:3rem; margin-bottom:16px">🔒</div>
          <div style="font-weight:700; font-size:1rem; margin-bottom:10px; color:var(--clr-text)">${guestName}</div>
          <div style="font-size:0.87rem; color:var(--clr-text-muted); line-height:1.6">
            This booking checked out on <strong>${formatted}</strong> and is now in the past.<br/>
            Past bookings cannot be deleted to maintain records integrity.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="dr-blocked-ok">Understood</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  const close = () => document.getElementById('dr-blocked-dialog')?.remove();
  document.getElementById('dr-blocked-close')?.addEventListener('click', close);
  document.getElementById('dr-blocked-ok')?.addEventListener('click', close);
  document.getElementById('dr-blocked-dialog')?.addEventListener('click', (e) => {
    if (e.target.id === 'dr-blocked-dialog') close();
  });
}

function showDeleteRequestDialog(booking) {
  document.querySelector('#dr-request-dialog')?.remove();
  const checkIn = booking.checkIn?.toDate ? booking.checkIn.toDate() : new Date(booking.checkIn);
  const checkOut = booking.checkOut?.toDate ? booking.checkOut.toDate() : new Date(booking.checkOut);
  const fmt = (d) => d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' });

  const html = `
    <div class="modal-overlay" id="dr-request-dialog" style="z-index:1100">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <h2 class="modal-title">🗑️ Request Booking Deletion</h2>
          <button class="modal-close" id="dr-req-close">✕</button>
        </div>
        <div class="modal-body">
          <div style="background:var(--clr-surface); border:1px solid var(--clr-border); border-radius:8px; padding:14px; margin-bottom:16px">
            <div style="font-weight:700; font-size:0.95rem; margin-bottom:6px">${booking.guestName}</div>
            <div style="font-size:0.82rem; color:var(--clr-text-muted)">Room ${booking.roomNumber} · ${fmt(checkIn)} → ${fmt(checkOut)}</div>
          </div>
          <div style="font-size:0.85rem; color:var(--clr-text-muted); margin-bottom:14px; line-height:1.6">
            ⚠️ This will send a <strong>deletion request to the admin</strong>. The booking will only be deleted after admin approval. You cannot undo this request.
          </div>
          <div class="form-group">
            <label class="form-label" for="dr-reason">Reason for deletion <span style="color:var(--clr-text-muted)">(optional)</span></label>
            <textarea id="dr-reason" class="form-control" rows="2" placeholder="e.g. Guest cancelled, booking error…"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="dr-req-cancel">Cancel</button>
          <button class="btn btn-danger" id="dr-req-submit">📨 Send Delete Request</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const closeDialog = () => document.getElementById('dr-request-dialog')?.remove();
  document.getElementById('dr-req-close')?.addEventListener('click', closeDialog);
  document.getElementById('dr-req-cancel')?.addEventListener('click', closeDialog);
  document.getElementById('dr-request-dialog')?.addEventListener('click', (e) => {
    if (e.target.id === 'dr-request-dialog') closeDialog();
  });

  document.getElementById('dr-req-submit')?.addEventListener('click', async () => {
    const reason = document.getElementById('dr-reason')?.value?.trim() || '';
    const submitBtn = document.getElementById('dr-req-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

    try {
      const { submitDeleteRequest } = await import('../services/deleteRequestService.js');
      await submitDeleteRequest(booking, reason);
      closeDialog();
      closeModal();
      showToast('Delete request sent to admin for approval 📨', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to send request: ' + err.message, 'error');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📨 Send Delete Request'; }
    }
  });
}

