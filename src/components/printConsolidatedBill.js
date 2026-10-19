// src/components/printConsolidatedBill.js — Consolidated Group & All-Room Event Bill Generator
import { formatCurrency, formatDate, nightCount, getBookingGuestCount } from '../utils/dateHelpers.js';
import logoImg from '../assets/Blue cove hiriketiya (1).png';
import { showToast } from '../utils/toast.js';
import { updateBooking } from '../services/bookingService.js';
import html2pdf from 'html2pdf.js';

let currentMode = 'thermal'; // 'thermal' (80mm) | 'a4'

/**
 * Open Consolidated Print Bill for multiple bookings (Group / All-Room Event)
 * @param {Array<Object>} bookings - List of booking objects
 * @param {Object} [options] - Optional configs (e.g. onBack)
 */
export function openConsolidatedPrintBill(bookings, options = {}) {
  if (!bookings || !bookings.length) {
    showToast('No bookings selected for consolidated bill', 'error');
    return;
  }

  // Sort bookings by room number ascending
  const sortedBookings = [...bookings].sort((a, b) => (Number(a.roomNumber) || 0) - (Number(b.roomNumber) || 0));
  const primary = sortedBookings[0];
  const allRooms = [100, 101, 102, 103, 104, 105, 106];
  const roomNumbers = sortedBookings.map(b => b.roomNumber);
  const isEntireHotel = allRooms.every(r => roomNumbers.includes(r));

  // Determine overall date range
  const checkIns = sortedBookings.map(b => (b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn)));
  const checkOuts = sortedBookings.map(b => (b.checkOut?.toDate ? b.checkOut.toDate() : new Date(b.checkOut)));
  const minCheckIn = new Date(Math.min(...checkIns));
  const maxCheckOut = new Date(Math.max(...checkOuts));
  const overallNights = nightCount(minCheckIn, maxCheckOut);

  // Per-room calculations
  let totalRoomCharges = 0;
  let totalExtraCharges = 0;
  let totalServiceCharge = 0;
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalAdvance = 0;
  let totalGuests = 0;

  const roomItems = sortedBookings.map(b => {
    const bNights = nightCount(b.checkIn, b.checkOut);
    const extraList = Array.isArray(b.extraCharges) ? b.extraCharges : [];
    const extraTotal = extraList.reduce((sum, ec) => sum + Number(ec.amount || 0), 0);
    const serviceCharge = b.serviceChargeTotal !== undefined
      ? Number(b.serviceChargeTotal)
      : extraList.reduce((sum, ec) => sum + (ec.isMeal ? (Number(ec.serviceCharge) || (Number(ec.amount || 0) * 0.10)) : 0), 0);
    const full = Number(b.fullPrice || 0);
    const roomCharge = b.pricePerDay ? (Number(b.pricePerDay) * bNights) : Math.max(0, full - extraTotal - serviceCharge);
    const ratePerNight = bNights > 0 ? (roomCharge / bNights) : roomCharge;
    const discount = Number(b.discountAmount || 0);
    const advance = Number(b.advancePaid || 0);
    const guests = getBookingGuestCount(b);
    const remaining = b.remaining !== undefined ? Number(b.remaining) : Math.max(0, full - discount - advance);

    totalRoomCharges += roomCharge;
    totalExtraCharges += extraTotal;
    totalServiceCharge += serviceCharge;
    totalSubtotal += full;
    totalDiscount += discount;
    totalAdvance += advance;
    totalGuests += guests;

    return {
      booking: b,
      roomNumber: b.roomNumber,
      acType: b.acType || 'N/A',
      bedType: b.bedType || 'N/A',
      meals: b.meals || 'None',
      nights: bNights,
      ratePerNight,
      roomCharge,
      extraList,
      extraTotal,
      serviceCharge,
      full,
      discount,
      discountDesc: b.discountDesc || '',
      advance,
      remaining,
      guests,
      additionalGuests: Array.isArray(b.additionalGuests) ? b.additionalGuests : []
    };
  });

  const grandTotal = Math.max(0, totalSubtotal - totalDiscount);
  const totalBalance = Math.max(0, grandTotal - totalAdvance);
  const isPaid = totalBalance <= 0;

  const now = new Date();
  const today = now.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });

  const billNo = `BCH-GRP-${minCheckIn.getFullYear()}${String(minCheckIn.getMonth()+1).padStart(2,'0')}${String(minCheckIn.getDate()).padStart(2,'0')}-${sortedBookings.length}R`;

  // Remove existing overlays
  document.querySelector('#print-bill-overlay')?.remove();

  // Set default format
  currentMode = 'thermal';
  setPrintPageStyle('thermal');

  const html = `
    <div id="print-bill-overlay" class="modal-overlay mode-thermal">
      <div class="modal print-bill-modal">
        <!-- Toolbar (hidden during print) -->
        <div class="modal-header no-print print-modal-toolbar">
          <div class="print-toolbar-left">
            <h2 class="modal-title">
              🏨 Master Bill — ${escapeHtml(primary.guestName)} 
              <span style="font-size:0.8rem; font-weight:600; opacity:0.8">(${sortedBookings.length} Rooms)</span>
            </h2>
            <!-- Format Selector -->
            <div class="print-format-toggle" role="group" aria-label="Paper Format">
              <button type="button" class="print-fmt-btn active" id="btn-fmt-thermal" title="80mm Thermal POS Receipt">
                🧾 80mm Thermal
              </button>
              <button type="button" class="print-fmt-btn" id="btn-fmt-a4" title="Standard A4 Master Invoice">
                📄 A4 Invoice
              </button>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <button class="btn btn-outline btn-sm" id="bill-edit-advance-btn" title="Edit total advance payment for these rooms (divides equally)" style="display:flex;align-items:center;gap:4px">
              💰 Edit Advance
            </button>
            <button class="btn btn-outline btn-sm" id="bill-pdf-btn" title="Download master bill as PDF file" style="display:flex;align-items:center;gap:4px">
              📥 Download PDF
            </button>
            <button class="btn btn-secondary btn-sm" id="bill-copy-btn" title="Copy combined bill details for WhatsApp/SMS">
              📋 Copy
            </button>
            <button class="btn btn-primary btn-sm" id="bill-trigger-print-btn" title="Print Master Bill">
              🖨️ Print
            </button>
            <button class="modal-close" id="bill-close-btn" title="Close">✕</button>
          </div>
        </div>

        <div class="modal-body print-modal-scroll" style="padding:0">
          <div class="print-preview-stage" id="printable-content">

            <!-- ======================================================= -->
            <!-- 80MM THERMAL RECEIPT VIEW (Default for 80mm POS Printer)-->
            <!-- ======================================================= -->
            <div class="thermal-receipt" id="thermal-receipt-view">
              <!-- Header -->
              <div class="thermal-header">
                <img src="${logoImg}" alt="Blue Cove Hiriketiya" class="thermal-logo" />
                <div class="thermal-hotel-title">BLUE COVE HIRIKETIYA</div>
                <div class="thermal-hotel-sub">Hiriketiya Beach Road, Dikwella</div>
                <div class="thermal-hotel-sub">Southern Province, Sri Lanka</div>
                <div class="thermal-hotel-contact">Tel: +94 77 440 3905 / (041) 224 7368</div>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Document Title & Meta -->
              <div class="thermal-doc-title">*** CONSOLIDATED EVENT RECEIPT ***</div>
              
              <div class="thermal-meta-list">
                <div class="thermal-row">
                  <span>Bill No:</span>
                  <span class="thermal-bold">${billNo}</span>
                </div>
                <div class="thermal-row">
                  <span>Date &amp; Time:</span>
                  <span>${today}, ${timeStr}</span>
                </div>
                <div class="thermal-row">
                  <span>Lead Guest:</span>
                  <span class="thermal-bold">${escapeHtml(primary.guestName)}</span>
                </div>
                ${primary.phone ? `
                <div class="thermal-row">
                  <span>Phone:</span>
                  <span>${escapeHtml(primary.phone)}</span>
                </div>` : ''}
                <div class="thermal-row">
                  <span>Rooms Booked:</span>
                  <span class="thermal-bold">${isEntireHotel ? 'ALL 7 ROOMS (Entire Hotel)' : `${sortedBookings.length} Rooms (${roomNumbers.join(', ')})`}</span>
                </div>
                <div class="thermal-row">
                  <span>Dates:</span>
                  <span>${formatDate(minCheckIn, true)} → ${formatDate(maxCheckOut, true)}</span>
                </div>
                <div class="thermal-row">
                  <span>Duration / Guests:</span>
                  <span>${overallNights} Night${overallNights>1?'s':''} · 👥 ${totalGuests} Guests</span>
                </div>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Room Breakdown -->
              <div class="thermal-section-title">[ ROOM BREAKDOWN ]</div>
              <div class="thermal-items">
                ${roomItems.map(item => `
                  <div class="thermal-item-block" style="margin-bottom:6px">
                    <div class="thermal-row thermal-bold">
                      <span>Room ${item.roomNumber} (${escapeHtml(item.acType)}/${escapeHtml(item.bedType)})</span>
                      <span>${formatCurrency(item.roomCharge)}</span>
                    </div>
                    <div class="thermal-row" style="font-size:0.75rem; opacity:0.85">
                      <span>${item.nights}N @ ${formatCurrency(item.ratePerNight)} · 👥${item.guests}p · ${escapeHtml(item.meals)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Extra Services across rooms (if any) -->
              ${totalExtraCharges > 0 ? `
              <div class="thermal-divider-dashed"></div>
              <div class="thermal-section-title">[ EXTRA CHARGES & SERVICES ]</div>
              <div class="thermal-items">
                ${roomItems.filter(r => r.extraList.length > 0).map(r => 
                  r.extraList.map(ec => `
                    <div class="thermal-row">
                      <span>Rm ${r.roomNumber}: ${escapeHtml(ec.details || 'Extra Service')}${ec.isMeal ? ' (Meal)' : ''}</span>
                      <span>${formatCurrency(ec.amount || 0)}</span>
                    </div>
                  `).join('')
                ).join('')}
              </div>` : ''}

              ${totalServiceCharge > 0 ? `
              <div class="thermal-row" style="margin-top:4px; font-weight:700">
                <span>🍽️ Service Charge (10% on Meals):</span>
                <span>+ ${formatCurrency(totalServiceCharge)}</span>
              </div>` : ''}

              <div class="thermal-divider-dashed"></div>

              <!-- Financial Totals -->
              <div class="thermal-totals">
                <div class="thermal-row">
                  <span>Total Room Charges:</span>
                  <span>${formatCurrency(totalRoomCharges)}</span>
                </div>
                ${totalExtraCharges > 0 ? `
                <div class="thermal-row">
                  <span>Total Extra Charges:</span>
                  <span>+ ${formatCurrency(totalExtraCharges)}</span>
                </div>` : ''}
                ${totalServiceCharge > 0 ? `
                <div class="thermal-row">
                  <span>Total Service Charge:</span>
                  <span>+ ${formatCurrency(totalServiceCharge)}</span>
                </div>` : ''}
                <div class="thermal-row thermal-bold" style="border-top:1px dashed #000; padding-top:3px; margin-top:3px">
                  <span>Combined Subtotal:</span>
                  <span>${formatCurrency(totalSubtotal)}</span>
                </div>
                ${totalDiscount > 0 ? `
                <div class="thermal-row">
                  <span>Group Discount:</span>
                  <span>- ${formatCurrency(totalDiscount)}</span>
                </div>` : ''}
                <div class="thermal-row">
                  <span>Total Advance Paid:</span>
                  <span>- ${formatCurrency(totalAdvance)}</span>
                </div>
                <div class="thermal-divider-double"></div>
                <div class="thermal-row thermal-grand-row">
                  <span class="thermal-grand-label">BALANCE DUE:</span>
                  <span class="thermal-grand-amount">${formatCurrency(totalBalance)}</span>
                </div>
                <div class="thermal-divider-double"></div>
                <div class="thermal-row" style="justify-content:center; margin-top:4px">
                  <span class="thermal-status-tag ${isPaid ? 'paid' : 'pending'}">
                    ${isPaid ? '*** PAID IN FULL ***' : '*** PAYMENT PENDING ***'}
                  </span>
                </div>
              </div>

              <!-- Footer -->
              <div class="thermal-divider-dashed"></div>
              <div class="thermal-footer">
                <div>Free Wi-Fi: BlueCove_Guest</div>
                <div style="margin-top:2px">Thank you for hosting your stay with us!</div>
                <div style="font-size:0.75rem; margin-top:2px">Blue Cove Hiriketiya · Management</div>
              </div>
            </div>


            <!-- ======================================================= -->
            <!-- STANDARD A4 INVOICE VIEW (Master Group Folio)           -->
            <!-- ======================================================= -->
            <div class="print-bill a4-invoice" id="a4-invoice-view" style="display:none">
              <!-- Header -->
              <div class="print-header">
                <div class="print-hotel-left">
                  <img src="${logoImg}" alt="Blue Cove Hiriketiya" class="print-hotel-logo" />
                  <div class="print-hotel-name">BLUE COVE HIRIKETIYA</div>
                  <div class="print-hotel-sub">Hiriketiya Beach Road, Dikwella, Southern Province, Sri Lanka</div>
                </div>
                <div class="print-bill-no">
                  <strong>${billNo}</strong>
                  Invoice Date: ${today}<br/>
                  Issue Time: ${timeStr}
                  <div class="print-bill-phone">📞 +94 77 440 3905 &nbsp;|&nbsp; ☎️ (041) 224 7368</div>
                </div>
              </div>

              <!-- Document Title & Event Tag -->
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:8px; border-bottom:2px solid var(--clr-primary)">
                <div>
                  <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--clr-text)">
                    ${isEntireHotel ? '🏨 ENTIRE HOTEL BUYOUT — MASTER INVOICE' : '🏨 CONSOLIDATED GROUP & EVENT INVOICE'}
                  </h3>
                  <div style="font-size:0.8rem; color:var(--clr-text-muted); margin-top:2px">
                    Combined folio for ${sortedBookings.length} rooms · ${overallNights} night${overallNights > 1 ? 's' : ''}
                  </div>
                </div>
                <span class="badge ${isPaid ? 'badge-success' : 'badge-primary'}" style="font-size:0.85rem; padding:4px 12px; font-weight:700">
                  ${isPaid ? '✅ PAID IN FULL' : '⏳ BALANCE DUE'}
                </span>
              </div>

              <!-- Guest & Event Info -->
              <div class="print-section-title">CUSTOMER & EVENT INFORMATION</div>
              <div class="print-info-grid" style="margin-bottom:20px">
                <div class="print-info-item">
                  <div class="print-info-label">Primary Guest / Organizer</div>
                  <div class="print-info-value" style="font-weight:700; font-size:0.95rem">${escapeHtml(primary.guestName)}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Contact Phone</div>
                  <div class="print-info-value">${escapeHtml(primary.phone || '—')}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Passport / ID</div>
                  <div class="print-info-value">${escapeHtml(primary.passportNumber || '—')}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Company / Reference</div>
                  <div class="print-info-value">${escapeHtml(primary.companyName || 'Private Event / Group')}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Check-In Date</div>
                  <div class="print-info-value">${formatDate(minCheckIn, true)}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Check-Out Date</div>
                  <div class="print-info-value">${formatDate(maxCheckOut, true)}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Total Duration</div>
                  <div class="print-info-value">${overallNights} Night${overallNights > 1 ? 's' : ''}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Total Accommodation</div>
                  <div class="print-info-value" style="color:var(--clr-primary); font-weight:700">
                    ${sortedBookings.length} Rooms (👥 ${totalGuests} Guests)
                  </div>
                </div>
              </div>

              <!-- Rooms Table -->
              <div class="print-section-title">ROOMS & ACCOMMODATION BREAKDOWN</div>
              <table class="print-table" style="margin-bottom:20px">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Specifications</th>
                    <th>Meal Plan</th>
                    <th>Guests</th>
                    <th>Nights</th>
                    <th>Rate / Night</th>
                    <th style="text-align:right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${roomItems.map(item => `
                    <tr>
                      <td style="font-weight:700; color:var(--clr-primary)">Room ${item.roomNumber}</td>
                      <td>${escapeHtml(item.acType)} · ${escapeHtml(item.bedType)} Bed</td>
                      <td><span class="badge badge-primary" style="font-size:0.75rem">${getMealLabel(item.meals)}</span></td>
                      <td style="font-weight:600">👥 ${item.guests}</td>
                      <td>${item.nights}</td>
                      <td>${formatCurrency(item.ratePerNight)}</td>
                      <td style="text-align:right; font-weight:700">${formatCurrency(item.roomCharge)}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:#f8fafc; font-weight:700">
                    <td colspan="6" style="text-align:right">Total Room Charges:</td>
                    <td style="text-align:right; color:var(--clr-primary)">${formatCurrency(totalRoomCharges)}</td>
                  </tr>
                </tfoot>
              </table>

              <!-- Additional Guests across all rooms (if any) -->
              ${roomItems.some(r => r.additionalGuests.length > 0) ? `
              <div class="print-section-title">OCCUPANT LIST (ADDITIONAL GUESTS)</div>
              <table class="print-table" style="margin-bottom:20px">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Occupant Name</th>
                    <th>Passport / ID</th>
                  </tr>
                </thead>
                <tbody>
                  ${roomItems.filter(r => r.additionalGuests.length > 0).map(r => 
                    r.additionalGuests.map(g => `
                      <tr>
                        <td style="font-weight:600">Room ${r.roomNumber}</td>
                        <td>${escapeHtml(g.name)}</td>
                        <td>${escapeHtml(g.passport || '—')}</td>
                      </tr>
                    `).join('')
                  ).join('')}
                </tbody>
              </table>` : ''}

              <!-- Extra Charges across rooms (if any) -->
              ${totalExtraCharges > 0 ? `
              <div class="print-section-title">EXTRA CHARGES & SERVICES</div>
              <table class="print-table" style="margin-bottom:20px">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th style="text-align:right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${roomItems.filter(r => r.extraList.length > 0).map(r => 
                    r.extraList.map(ec => `
                      <tr>
                        <td style="font-weight:600">Room ${r.roomNumber}</td>
                        <td>${escapeHtml(ec.details || 'Extra Service')}</td>
                        <td>${ec.isMeal ? '<span style="font-size:0.75rem; background:#eff6ff; color:#2563eb; padding:2px 6px; border-radius:4px; font-weight:600">🍽️ Meal</span>' : 'Service'}</td>
                        <td style="text-align:right">${formatCurrency(ec.amount || 0)}</td>
                      </tr>
                    `).join('')
                  ).join('')}
                  ${totalServiceCharge > 0 ? `
                  <tr style="background:#f8fafc; font-weight:600">
                    <td colspan="3">🍽️ Service Charge (10% on Meals across all rooms)</td>
                    <td style="text-align:right; color:#2563eb">+ ${formatCurrency(totalServiceCharge)}</td>
                  </tr>` : ''}
                </tbody>
              </table>` : ''}

              <!-- Consolidated Financial Totals -->
              <div class="print-section-title">CONSOLIDATED FINANCIAL SUMMARY</div>
              <div class="print-totals" style="max-width:440px; margin-left:auto; margin-bottom:24px">
                <div class="print-total-row">
                  <span class="print-total-label">Total Room Accommodation (${sortedBookings.length} Rooms):</span>
                  <span class="print-total-value">${formatCurrency(totalRoomCharges)}</span>
                </div>
                ${totalExtraCharges > 0 ? `
                <div class="print-total-row">
                  <span class="print-total-label">Total Extra Charges &amp; Meals:</span>
                  <span class="print-total-value">+ ${formatCurrency(totalExtraCharges)}</span>
                </div>` : ''}
                ${totalServiceCharge > 0 ? `
                <div class="print-total-row">
                  <span class="print-total-label">Service Charge (10% on Meals):</span>
                  <span class="print-total-value" style="color:#2563eb; font-weight:700">+ ${formatCurrency(totalServiceCharge)}</span>
                </div>` : ''}
                <div class="print-total-row" style="border-top:1px solid #e2e8f0; padding-top:6px; margin-top:4px">
                  <span class="print-total-label">Gross Subtotal:</span>
                  <span class="print-total-value" style="font-weight:700">${formatCurrency(totalSubtotal)}</span>
                </div>
                ${totalDiscount > 0 ? `
                <div class="print-total-row">
                  <span class="print-total-label">Group / Event Discount:</span>
                  <span class="print-total-value" style="color:#16a34a">- ${formatCurrency(totalDiscount)}</span>
                </div>` : ''}
                <div class="print-total-row">
                  <span class="print-total-label">Total Advance Paid:</span>
                  <span class="print-total-value" style="color:#16a34a">- ${formatCurrency(totalAdvance)}</span>
                </div>
                <div style="width:100%; height:2px; background:#4f72f5; margin:8px 0"></div>
                <div class="print-total-row print-grand-total">
                  <span style="font-weight:800; font-size:1.1rem">NET BALANCE DUE:</span>
                  <span class="print-total-value" style="font-size:1.4rem; color:#4f72f5; font-weight:900">${formatCurrency(totalBalance)}</span>
                </div>
              </div>

              <!-- Footer note -->
              <div style="margin-top:24px; text-align:center; font-size:0.75rem; color:var(--clr-text-muted); border-top:1px dashed #e2e8f0; padding-top:10px">
                Thank you for choosing Blue Cove Hiriketiya. We look forward to hosting your group again!
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // Setup Event Listeners
  const closeBill = () => {
    document.getElementById('print-bill-overlay')?.remove();
    document.getElementById('dynamic-page-print-style')?.remove();
  };

  document.getElementById('bill-close-btn')?.addEventListener('click', closeBill);
  document.getElementById('print-bill-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'print-bill-overlay') closeBill();
  });

  // Toggle Print Formats
  const btnThermal = document.getElementById('btn-fmt-thermal');
  const btnA4 = document.getElementById('btn-fmt-a4');
  const overlay = document.getElementById('print-bill-overlay');
  const thermalView = document.getElementById('thermal-receipt-view');
  const a4View = document.getElementById('a4-invoice-view');

  const setFormat = (fmt) => {
    currentMode = fmt;
    setPrintPageStyle(fmt);
    if (fmt === 'thermal') {
      btnThermal?.classList.add('active');
      btnA4?.classList.remove('active');
      overlay?.classList.add('mode-thermal');
      overlay?.classList.remove('mode-a4');
      if (thermalView) thermalView.style.display = 'block';
      if (a4View) a4View.style.display = 'none';
    } else {
      btnA4?.classList.add('active');
      btnThermal?.classList.remove('active');
      overlay?.classList.add('mode-a4');
      overlay?.classList.remove('mode-thermal');
      if (thermalView) thermalView.style.display = 'none';
      if (a4View) a4View.style.display = 'block';
    }
  };

  btnThermal?.addEventListener('click', () => setFormat('thermal'));
  btnA4?.addEventListener('click', () => setFormat('a4'));

  // Trigger Print
  document.getElementById('bill-trigger-print-btn')?.addEventListener('click', () => {
    window.print();
  });

  // Edit Advance (Divide equally)
  document.getElementById('bill-edit-advance-btn')?.addEventListener('click', () => {
    openEditGroupAdvanceModal(sortedBookings, (updatedBookings) => {
      openConsolidatedPrintBill(updatedBookings, options);
    });
  });

  // Download as PDF
  document.getElementById('bill-pdf-btn')?.addEventListener('click', async () => {
    const pdfBtn = document.getElementById('bill-pdf-btn');
    const originalText = pdfBtn ? pdfBtn.innerHTML : '📥 Download PDF';
    if (pdfBtn) {
      pdfBtn.disabled = true;
      pdfBtn.innerHTML = '⏳ Generating PDF...';
    }

    try {
      const isThermal = currentMode === 'thermal';
      const element = isThermal
        ? document.getElementById('thermal-receipt-view')
        : document.getElementById('a4-invoice-view');

      if (!element) throw new Error('Invoice view element not found');

      const filename = `${billNo}-${isThermal ? 'Receipt' : 'Invoice'}.pdf`;

      const opt = {
        margin: isThermal ? [4, 4, 4, 4] : [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        },
        jsPDF: isThermal
          ? { unit: 'mm', format: [80, Math.max(160, Math.ceil(element.offsetHeight * 0.264583) + 12)], orientation: 'portrait' }
          : { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      showToast(`Master bill PDF downloaded: ${filename} 📄`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
    } finally {
      if (pdfBtn) {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalText;
      }
    }
  });

  // Copy Plaintext for WhatsApp / SMS
  document.getElementById('bill-copy-btn')?.addEventListener('click', async () => {
    const text = generateConsolidatedTextReceipt({
      billNo,
      today,
      timeStr,
      guestName: primary.guestName,
      phone: primary.phone,
      company: primary.companyName,
      isEntireHotel,
      roomCount: sortedBookings.length,
      roomNumbers,
      minCheckIn,
      maxCheckOut,
      overallNights,
      totalGuests,
      roomItems,
      totalRoomCharges,
      totalExtraCharges,
      totalServiceCharge,
      totalSubtotal,
      totalDiscount,
      totalAdvance,
      totalBalance,
      isPaid
    });

    try {
      await navigator.clipboard.writeText(text);
      showToast('Master receipt copied to clipboard! Ready to send on WhatsApp 📋', 'success');
    } catch {
      showToast('Could not copy automatically. You can view & print the receipt.', 'info');
    }
  });
}

/**
 * Quick Modal to update or edit total advance payment for multiple selected rooms,
 * dividing it equally among them in Firestore.
 */
export function openEditGroupAdvanceModal(bookings, onUpdated = () => {}) {
  if (!bookings || !bookings.length) return;

  const count = bookings.length;
  const currentTotalAdv = bookings.reduce((sum, b) => sum + (Number(b.advancePaid) || 0), 0);
  const totalFullPrice = bookings.reduce((sum, b) => sum + (Number(b.fullPrice) || 0), 0);
  const totalDiscount = bookings.reduce((sum, b) => sum + (Number(b.discountAmount) || 0), 0);
  const roomNumbers = bookings.map(b => b.roomNumber).sort((a,b)=>Number(a)-Number(b));

  document.querySelector('#edit-group-adv-overlay')?.remove();

  const modalHtml = `
    <div class="modal-overlay" id="edit-group-adv-overlay" style="z-index:1200">
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <h2 class="modal-title" style="display:flex;align-items:center;gap:8px">
            💰 Edit Group Advance Payment
          </h2>
          <button class="modal-close" id="edit-group-adv-close">✕</button>
        </div>
        <div class="modal-body" style="padding:20px">
          <div style="background:var(--clr-surface-alt, rgba(255,255,255,0.03)); border:1px solid var(--clr-border); border-radius:8px; padding:12px; margin-bottom:16px">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px">
              <span style="font-size:0.82rem; color:var(--clr-text-muted)">Selected Rooms (${count}):</span>
              <span style="font-size:0.82rem; font-weight:700; color:var(--clr-text)">[${roomNumbers.join(', ')}]</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px">
              <span style="font-size:0.82rem; color:var(--clr-text-muted)">Total Full Bill:</span>
              <span style="font-size:0.82rem; font-weight:700; color:var(--clr-primary)">${formatCurrency(totalFullPrice - totalDiscount)}</span>
            </div>
            <div style="display:flex; justify-content:space-between">
              <span style="font-size:0.82rem; color:var(--clr-text-muted)">Current Total Advance:</span>
              <span style="font-size:0.82rem; font-weight:700; color:var(--clr-text)">${formatCurrency(currentTotalAdv)}</span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px">
            <label class="form-label" for="group-adv-input" style="font-weight:700">Total Advance Paid by Buyer (LKR) *</label>
            <input type="number" id="group-adv-input" class="form-control" placeholder="0.00" min="0" step="0.01" value="${currentTotalAdv || ''}" autofocus />
          </div>

          <div id="group-adv-preview" style="padding:10px 12px; background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08)); border:1.5px solid rgba(16,185,129,0.3); border-radius:8px; font-size:0.82rem; margin-bottom:16px">
            <div style="font-weight:700; color:var(--clr-success); margin-bottom:4px" id="group-adv-split-line">
              ⚡ Divided equally: Rs. 0.00 / room across ${count} rooms
            </div>
            <div style="font-size:0.75rem; color:var(--clr-text-muted)" id="group-adv-rem-line">
              New total balance due: ${formatCurrency(Math.max(0, totalFullPrice - totalDiscount - currentTotalAdv))}
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px">
            <button type="button" class="btn btn-ghost" id="group-adv-cancel-btn">Cancel</button>
            <button type="button" class="btn btn-primary" id="group-adv-save-btn" style="background:linear-gradient(135deg,#10b981,#059669); border:none">
              💾 Save &amp; Divide Advance Equally
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('edit-group-adv-overlay');
  const input = document.getElementById('group-adv-input');
  const splitLine = document.getElementById('group-adv-split-line');
  const remLine = document.getElementById('group-adv-rem-line');
  const closeBtn = document.getElementById('edit-group-adv-close');
  const cancelBtn = document.getElementById('group-adv-cancel-btn');
  const saveBtn = document.getElementById('group-adv-save-btn');

  function closeAdvModal() {
    overlay?.remove();
  }

  function updateAdvCalc() {
    const val = parseFloat(input?.value) || 0;
    const perRoom = Math.floor((val / count) * 100) / 100;
    const newBal = Math.max(0, totalFullPrice - totalDiscount - val);
    const perRoomBal = Math.round((newBal / count) * 100) / 100;

    if (splitLine) splitLine.textContent = `⚡ Divided equally: ${formatCurrency(perRoom)} / room across ${count} rooms`;
    if (remLine) remLine.textContent = `New total balance due: ${formatCurrency(newBal)} (${formatCurrency(perRoomBal)} / room)`;
  }

  input?.addEventListener('input', updateAdvCalc);
  updateAdvCalc();

  closeBtn?.addEventListener('click', closeAdvModal);
  cancelBtn?.addEventListener('click', closeAdvModal);
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeAdvModal(); });

  saveBtn?.addEventListener('click', async () => {
    const val = parseFloat(input?.value) || 0;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const perRoom = Math.floor((val / count) * 100) / 100;
      const remAdv = Math.round((val - (perRoom * count)) * 100) / 100;

      for (let i = 0; i < count; i++) {
        const b = bookings[i];
        const rmAdv = perRoom + (i === 0 ? remAdv : 0);
        const rmFull = Number(b.fullPrice || 0);
        const rmDisc = Number(b.discountAmount || 0);
        const rmBal = Math.max(0, rmFull - rmDisc - rmAdv);

        await updateBooking(b.id, {
          advancePaid: rmAdv,
          remaining: rmBal
        });
        b.advancePaid = rmAdv;
        b.remaining = rmBal;
      }

      showToast(`Advance updated! ${formatCurrency(val)} divided equally across ${count} rooms. 🎉`, 'success');
      closeAdvModal();
      onUpdated(bookings);
    } catch (err) {
      console.error(err);
      showToast('Failed to update advance: ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save & Divide Advance Equally';
    }
  });
}

/** Injects @page stylesheet tailored to 80mm thermal or standard A4 */
function setPrintPageStyle(mode) {
  let styleEl = document.getElementById('dynamic-page-print-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-page-print-style';
    document.head.appendChild(styleEl);
  }

  if (mode === 'thermal') {
    styleEl.textContent = `
      @page {
        size: 80mm auto;
        margin: 0;
      }
    `;
  } else {
    styleEl.textContent = `
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
    `;
  }
}

/** Generate plaintext summary for WhatsApp / SMS */
function generateConsolidatedTextReceipt(data) {
  const roomsList = data.roomItems.map(item => 
    `• Rm ${item.roomNumber} (${item.acType}/${item.bedType}) - ${item.nights}N: ${formatCurrency(item.roomCharge)} (👥 ${item.guests}p, ${item.meals})`
  ).join('\n');

  return [
    '========================================',
    '       BLUE COVE HIRIKETIYA',
    '   Hiriketiya Beach Road, Dikwella',
    '  Tel: +94 77 440 3905 / (041) 224 7368',
    '========================================',
    `🏨 MASTER FOLIO: ${data.billNo}`,
    `Date & Time   : ${data.today} ${data.timeStr}`,
    '----------------------------------------',
    `Lead Guest    : ${data.guestName}`,
    data.phone ? `Phone         : ${data.phone}` : null,
    data.company ? `Company/Event : ${data.company}` : null,
    `Rooms Booked  : ${data.isEntireHotel ? 'ALL 7 ROOMS (Entire Hotel Buyout)' : `${data.roomCount} Rooms (${data.roomNumbers.join(', ')})`}`,
    `Dates         : ${formatDate(data.minCheckIn, true)} → ${formatDate(data.maxCheckOut, true)} (${data.overallNights} Nights)`,
    `Total Guests  : 👥 ${data.totalGuests} Guests`,
    '----------------------------------------',
    '[ ROOM BREAKDOWN ]',
    roomsList,
    '----------------------------------------',
    `Room Charges  : ${formatCurrency(data.totalRoomCharges)}`,
    data.totalExtraCharges > 0 ? `Extras & Meals: + ${formatCurrency(data.totalExtraCharges)}` : null,
    data.totalServiceCharge > 0 ? `Service Charge: + ${formatCurrency(data.totalServiceCharge)} (10% Meals)` : null,
    `Subtotal      : ${formatCurrency(data.totalSubtotal)}`,
    data.totalDiscount > 0 ? `Discount      : - ${formatCurrency(data.totalDiscount)}` : null,
    `Advance Paid  : - ${formatCurrency(data.totalAdvance)}`,
    '========================================',
    `BALANCE DUE   : ${formatCurrency(data.totalBalance)}`,
    `Status        : ${data.isPaid ? 'PAID IN FULL' : 'PAYMENT PENDING'}`,
    '========================================',
    'Thank you for hosting your event with us!',
    'Blue Cove Hiriketiya Management'
  ].filter(Boolean).join('\n');
}

function getMealLabel(meals) {
  const labels = {
    'BB': 'Bed & Breakfast (BB)',
    'HB': 'Half Board (HB)',
    'FB': 'Full Board (FB)',
    'None': 'Room Only',
  };
  return labels[meals] || meals || 'Room Only';
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
