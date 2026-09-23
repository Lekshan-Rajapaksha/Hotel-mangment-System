// src/components/printBill.js — 80mm Thermal Printer & A4 Bill Generator
import { formatCurrency, formatDate, nightCount } from '../utils/dateHelpers.js';
import logoImg from '../assets/Blue cove hiriketiya (1).png';
import { showToast } from '../utils/toast.js';

let currentMode = 'thermal'; // 'thermal' (80mm) | 'a4'

export function openPrintBill(booking) {
  const b = booking;
  const nights = nightCount(b.checkIn, b.checkOut);
  const extraChargesList = Array.isArray(b.extraCharges) ? b.extraCharges : [];
  const extraTotal = extraChargesList.reduce((sum, ec) => sum + Number(ec.amount || 0), 0);
  const serviceChargeTotal = b.serviceChargeTotal !== undefined
    ? Number(b.serviceChargeTotal)
    : extraChargesList.reduce((sum, ec) => sum + (ec.isMeal ? (Number(ec.serviceCharge) || (Number(ec.amount || 0) * 0.10)) : 0), 0);
  const totalPrice = Number(b.fullPrice || 0);
  const roomPriceTotal = b.pricePerDay ? (Number(b.pricePerDay) * nights) : Math.max(0, totalPrice - extraTotal - serviceChargeTotal);
  const pricePerNight = nights > 0 ? (roomPriceTotal / nights) : roomPriceTotal;
  const billNo = b.bookingNumber ? `BCH-#${b.bookingNumber}` : `BCH-${String(b.id || Date.now()).slice(-6).toUpperCase()}`;
  const now = new Date();
  const today = now.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });

  const discount = Number(b.discountAmount || 0);
  const advance = Number(b.advancePaid || 0);
  const balance = b.remaining !== undefined ? Number(b.remaining) : Math.max(0, totalPrice - discount - advance);
  const isPaid = balance <= 0;

  // Remove any existing overlay
  document.querySelector('#print-bill-overlay')?.remove();

  // Ensure default print style is 80mm thermal
  currentMode = 'thermal';
  setPrintPageStyle('thermal');

  const html = `
    <div id="print-bill-overlay" class="modal-overlay mode-thermal">
      <div class="modal print-bill-modal">
        <!-- Toolbar (hidden during print) -->
        <div class="modal-header no-print print-modal-toolbar">
          <div class="print-toolbar-left">
            <h2 class="modal-title">🖨️ Print Bill — ${escapeHtml(b.guestName)}</h2>
            <!-- Format Selector -->
            <div class="print-format-toggle" role="group" aria-label="Paper Format">
              <button type="button" class="print-fmt-btn active" id="btn-fmt-thermal" title="80mm Thermal POS Receipt">
                🧾 80mm Thermal
              </button>
              <button type="button" class="print-fmt-btn" id="btn-fmt-a4" title="Standard A4 Invoice">
                📄 A4 Invoice
              </button>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <button class="btn btn-secondary btn-sm" id="bill-copy-btn" title="Copy receipt details for WhatsApp/SMS">
              📋 Copy
            </button>
            <button class="btn btn-primary btn-sm" id="bill-trigger-print-btn" title="Print Bill">
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
              <div class="thermal-doc-title">*** GUEST RECEIPT / FOLIO ***</div>
              
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
                  <span>Source:</span>
                  <span>${escapeHtml(b.source || 'Direct')}</span>
                </div>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Guest Info -->
              <div class="thermal-section-title">[ GUEST INFORMATION ]</div>
              <div class="thermal-row">
                <span>Guest:</span>
                <span class="thermal-bold">${escapeHtml(b.guestName)}</span>
              </div>
              <div class="thermal-row">
                <span>Phone:</span>
                <span>${escapeHtml(b.phone || '—')}</span>
              </div>
              ${b.passportNumber ? `
              <div class="thermal-row">
                <span>Passport/ID:</span>
                <span>${escapeHtml(b.passportNumber)}</span>
              </div>` : ''}
              ${b.companyName ? `
              <div class="thermal-row">
                <span>Company:</span>
                <span>${escapeHtml(b.companyName)}</span>
              </div>` : ''}
              ${b.additionalGuests?.length ? `
              <div class="thermal-sub-block">
                <div class="thermal-sub-label">Additional Guests:</div>
                ${b.additionalGuests.map((g, i) => `
                  <div class="thermal-row thermal-indent">
                    <span>${i + 1}. ${escapeHtml(g.name)}</span>
                    <span>${escapeHtml(g.passport || '')}</span>
                  </div>
                `).join('')}
              </div>` : ''}

              <div class="thermal-divider-dashed"></div>

              <!-- Stay Details -->
              <div class="thermal-section-title">[ STAY DETAILS ]</div>
              <div class="thermal-row">
                <span>Room:</span>
                <span class="thermal-bold">Room ${b.roomNumber}</span>
              </div>
              <div class="thermal-row">
                <span>Type:</span>
                <span>${escapeHtml(b.acType)} · ${escapeHtml(b.bedType)} Bed</span>
              </div>
              <div class="thermal-row">
                <span>Check-In:</span>
                <span>${formatDate(b.checkIn, true)}</span>
              </div>
              <div class="thermal-row">
                <span>Check-Out:</span>
                <span>${formatDate(b.checkOut, true)}</span>
              </div>
              <div class="thermal-row">
                <span>Duration:</span>
                <span class="thermal-bold">${nights} Night${nights > 1 ? 's' : ''}</span>
              </div>
              <div class="thermal-row">
                <span>Meal Plan:</span>
                <span>${getMealLabel(b.meals)}</span>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Charges Breakdown -->
              <div class="thermal-section-title">[ BILLING SUMMARY ]</div>
              
              <div class="thermal-item-block">
                <div class="thermal-item-name thermal-bold">Room ${b.roomNumber} (${escapeHtml(b.acType)} ${escapeHtml(b.bedType)})</div>
                <div class="thermal-row thermal-indent">
                  <span>${nights}N × ${formatCurrency(pricePerNight)}</span>
                  <span class="thermal-bold">${formatCurrency(roomPriceTotal)}</span>
                </div>
              </div>

              ${b.meals !== 'None' ? `
              <div class="thermal-item-block">
                <div class="thermal-row thermal-indent">
                  <span>${getMealLabel(b.meals)}</span>
                  <span>INCLUDED</span>
                </div>
              </div>` : ''}

              ${extraChargesList.length ? `
              <div class="thermal-item-block" style="margin-top:6px">
                <div class="thermal-item-name thermal-bold">Extra Charges / Services:</div>
                ${extraChargesList.map(ec => `
                  <div class="thermal-row thermal-indent">
                    <span>+ ${escapeHtml(ec.details || 'Extra Charge')}${ec.isMeal ? ' (Meal)' : ''}</span>
                    <span class="thermal-bold">${formatCurrency(ec.amount || 0)}</span>
                  </div>
                `).join('')}
              </div>` : ''}

              ${discount > 0 ? `
              <div class="thermal-item-block">
                <div class="thermal-row thermal-indent">
                  <span>Discount: ${escapeHtml(b.discountDesc || 'Special Offer')}</span>
                  <span class="thermal-bold">- ${formatCurrency(discount)}</span>
                </div>
              </div>` : ''}

              <div class="thermal-divider-dashed"></div>

              <!-- Totals -->
              <div class="thermal-totals-list">
                <div class="thermal-row">
                  <span>Room Charges:</span>
                  <span>${formatCurrency(roomPriceTotal)}</span>
                </div>
                ${extraTotal > 0 ? `
                <div class="thermal-row">
                  <span>Extra Charges:</span>
                  <span>+ ${formatCurrency(extraTotal)}</span>
                </div>` : ''}
                ${serviceChargeTotal > 0 ? `
                <div class="thermal-row">
                  <span>Service Charge (10% Meals):</span>
                  <span>+ ${formatCurrency(serviceChargeTotal)}</span>
                </div>` : ''}
                <div class="thermal-row">
                  <span>Subtotal:</span>
                  <span>${formatCurrency(totalPrice)}</span>
                </div>
                ${discount > 0 ? `
                <div class="thermal-row">
                  <span>Discount:</span>
                  <span>- ${formatCurrency(discount)}</span>
                </div>
                <div class="thermal-row">
                  <span>Net Total:</span>
                  <span>${formatCurrency(totalPrice - discount)}</span>
                </div>` : ''}
                <div class="thermal-row">
                  <span>Advance Paid:</span>
                  <span>- ${formatCurrency(advance)}</span>
                </div>
              </div>

              <div class="thermal-divider-double"></div>

              <!-- Balance Due (Prominent) -->
              <div class="thermal-grand-row">
                <span class="thermal-grand-label">BALANCE DUE:</span>
                <span class="thermal-grand-amount">${formatCurrency(balance)}</span>
              </div>

              ${serviceChargeTotal > 0 ? `
              <div class="thermal-row" style="margin-top:6px; font-size:0.8rem; justify-content:space-between">
                <span>Total Service Charge (10%):</span>
                <span class="thermal-bold">${formatCurrency(serviceChargeTotal)}</span>
              </div>` : ''}

              <div class="thermal-divider-double"></div>

              <!-- Settlement Status -->
              <div class="thermal-status-tag ${isPaid ? 'paid' : 'pending'}">
                ${isPaid ? '*** PAID IN FULL ***' : `*** PAYMENT PENDING: ${formatCurrency(balance)} ***`}
              </div>

              ${b.notes ? `
              <div class="thermal-divider-dashed"></div>
              <div class="thermal-notes">
                <span class="thermal-bold">Note:</span> ${escapeHtml(b.notes)}
              </div>` : ''}

              <div class="thermal-divider-dashed"></div>

              <!-- Footer Policies & Notes -->
              <div class="thermal-footer">
                <div>Check-in: 2:00 PM | Check-out: 11:00 AM</div>
                <div>Free Wi-Fi: BlueCove_Guest</div>
                <div class="thermal-thanks">Thank you for staying at Blue Cove!</div>
                <div class="thermal-sub-thanks">We look forward to your next visit to Hiriketiya.</div>
                
                <!-- Barcode Graphic -->
                <div class="thermal-barcode">
                  <div class="thermal-barcode-stripes"></div>
                  <div class="thermal-barcode-code">${billNo}</div>
                </div>

                <div class="thermal-timestamp">
                  ${billNo} · Printed ${today} ${timeStr}
                </div>

                <!-- Paper feed clearance for 80mm thermal auto-cutter -->
                <div class="thermal-cutter-feed"></div>
              </div>
            </div>

            <!-- ======================================================= -->
            <!-- STANDARD A4 INVOICE VIEW (Optional Toggle)              -->
            <!-- ======================================================= -->
            <div class="print-bill a4-invoice" id="a4-invoice-view" style="display:none">
              <!-- Header -->
              <div class="print-header">
                <div class="print-hotel-left">
                  <img src="${logoImg}" alt="Blue Cove Hiriketiya" class="print-hotel-logo" />
                  <div class="print-hotel-name">BLUE COVE HIRIKETIYA</div>
                  <div class="print-hotel-sub">Hiriketiya Beach Road, Dikwella, Sri Lanka</div>
                </div>
                <div class="print-bill-no">
                  <strong>${billNo}</strong>
                  Invoice Date: ${today}<br/>
                  Issue Time: ${timeStr}
                  <div class="print-bill-phone">📞 +94 77 440 3905 &nbsp;|&nbsp; ☎️ (041) 224 7368</div>
                </div>
              </div>

              <!-- Guest Info -->
              <div class="print-section-title">GUEST INFORMATION</div>
              <div class="print-info-grid" style="margin-bottom:20px">
                <div class="print-info-item">
                  <div class="print-info-label">Guest Name</div>
                  <div class="print-info-value">${escapeHtml(b.guestName)}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Phone</div>
                  <div class="print-info-value">${escapeHtml(b.phone || '—')}</div>
                </div>
                ${b.passportNumber ? `
                <div class="print-info-item">
                  <div class="print-info-label">Passport No.</div>
                  <div class="print-info-value">${escapeHtml(b.passportNumber)}</div>
                </div>` : ''}
                ${b.companyName ? `
                <div class="print-info-item">
                  <div class="print-info-label">Company</div>
                  <div class="print-info-value">${escapeHtml(b.companyName)}</div>
                </div>` : ''}
              </div>

              <!-- Stay Details -->
              <div class="print-section-title">STAY DETAILS</div>
              <div class="print-info-grid" style="margin-bottom:20px">
                <div class="print-info-item">
                  <div class="print-info-label">Room Number</div>
                  <div class="print-info-value">Room ${b.roomNumber}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Room Type</div>
                  <div class="print-info-value">${escapeHtml(b.acType)} · ${escapeHtml(b.bedType)} Bed</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Check-In</div>
                  <div class="print-info-value">${formatDate(b.checkIn, true)}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Check-Out</div>
                  <div class="print-info-value">${formatDate(b.checkOut, true)}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Duration</div>
                  <div class="print-info-value">${nights} Night${nights > 1 ? 's' : ''}</div>
                </div>
                <div class="print-info-item">
                  <div class="print-info-label">Meal Plan</div>
                  <div class="print-info-value">${getMealLabel(b.meals)}</div>
                </div>
              </div>

              ${b.additionalGuests?.length ? `
              <!-- Additional Guests -->
              <div class="print-section-title">ADDITIONAL GUESTS</div>
              <table class="print-table" style="margin-bottom:20px">
                <thead><tr><th>#</th><th>Name</th><th>Passport No.</th></tr></thead>
                <tbody>
                  <tr><td>1</td><td>${escapeHtml(b.guestName)}</td><td>${escapeHtml(b.passportNumber || '-')}</td></tr>
                  ${b.additionalGuests.map((g,i) => `
                    <tr><td>${i+2}</td><td>${escapeHtml(g.name)}</td><td>${escapeHtml(g.passport || '-')}</td></tr>
                  `).join('')}
                </tbody>
              </table>` : ''}

              <!-- Charges -->
              <div class="print-section-title">BILLING SUMMARY</div>
              <table class="print-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty / Nights</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Room ${b.roomNumber} — ${escapeHtml(b.acType)} ${escapeHtml(b.bedType)} Bed</td>
                    <td>${nights} Night${nights > 1 ? 's' : ''}</td>
                    <td>${formatCurrency(pricePerNight)}</td>
                    <td>${formatCurrency(roomPriceTotal)}</td>
                  </tr>
                  ${extraChargesList.map(ec => `
                  <tr>
                    <td>Extra: ${escapeHtml(ec.details || 'Service')}${ec.isMeal ? ' <span style="font-size:0.75rem; background:#eff6ff; color:#2563eb; padding:2px 6px; border-radius:4px; font-weight:600">🍽️ Meal</span>' : ''}</td>
                    <td>1</td>
                    <td>${formatCurrency(ec.amount || 0)}</td>
                    <td>${formatCurrency(ec.amount || 0)}</td>
                  </tr>
                  `).join('')}
                  ${serviceChargeTotal > 0 ? `
                  <tr style="background:#f8fafc; font-weight:600">
                    <td colspan="3">🍽️ Service Charge (10% on Meals)</td>
                    <td style="color:#2563eb">+ ${formatCurrency(serviceChargeTotal)}</td>
                  </tr>` : ''}
                  ${b.meals !== 'None' ? `
                  <tr>
                    <td colspan="3">${getMealLabel(b.meals)} (Included)</td>
                    <td>Included</td>
                  </tr>` : ''}
                  ${discount > 0 ? `
                  <tr>
                    <td colspan="3">Discount: ${escapeHtml(b.discountDesc || 'Special Offer')}</td>
                    <td style="color:#16a34a">- ${formatCurrency(discount)}</td>
                  </tr>` : ''}
                </tbody>
              </table>

              <!-- Totals -->
              <div class="print-totals">
                <div class="print-total-row">
                  <span class="print-total-label">Room Charges</span>
                  <span class="print-total-value">${formatCurrency(roomPriceTotal)}</span>
                </div>
                ${extraTotal > 0 ? `
                <div class="print-total-row">
                  <span class="print-total-label">Extra Charges</span>
                  <span class="print-total-value">+ ${formatCurrency(extraTotal)}</span>
                </div>` : ''}
                ${serviceChargeTotal > 0 ? `
                <div class="print-total-row">
                  <span class="print-total-label">Service Charge (10% Meals)</span>
                  <span class="print-total-value" style="color:#2563eb; font-weight:700">+ ${formatCurrency(serviceChargeTotal)}</span>
                </div>` : ''}
                <div class="print-total-row">
                  <span class="print-total-label">Subtotal</span>
                  <span class="print-total-value">${formatCurrency(totalPrice)}</span>
                </div>
                ${discount > 0 ? `
                <div class="print-total-row">
                  <span class="print-total-label">Discount</span>
                  <span class="print-total-value" style="color:#16a34a">- ${formatCurrency(discount)}</span>
                </div>` : ''}
                <div class="print-total-row">
                  <span class="print-total-label">Advance Paid</span>
                  <span class="print-total-value" style="color:#16a34a">- ${formatCurrency(advance)}</span>
                </div>
                <div style="width:100%; height:1px; background:#e2e8f0; margin:8px 0"></div>
                <div class="print-total-row print-grand-total">
                  <span style="font-weight:700">Balance Due</span>
                  <span class="print-total-value" style="font-size:1.3rem; color:#4f72f5; font-weight:800">${formatCurrency(balance)}</span>
                </div>
                ${serviceChargeTotal > 0 ? `
                <div class="print-total-row" style="margin-top:6px; font-size:0.8rem; color:#64748b">
                  <span>Total Service Charge Included</span>
                  <span style="font-weight:700; color:#1e293b">${formatCurrency(serviceChargeTotal)}</span>
                </div>` : ''}
              </div>

              <!-- Footer -->
              <div class="print-footer">
                <div style="font-weight:600">Thank you for staying with Blue Cove Hiriketiya!</div>
                <div style="margin-top:4px">We look forward to welcoming you again.</div>
                <div style="margin-top:8px">📞 +94 77 440 3905 &nbsp;|&nbsp; ☎️ (041) 224 7368</div>
                <div style="margin-top:8px; font-size:0.7rem; color:#94a3b8">Invoice ${billNo} — Generated ${today}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // Bind Format Buttons
  const overlay = document.getElementById('print-bill-overlay');
  const btnThermal = document.getElementById('btn-fmt-thermal');
  const btnA4 = document.getElementById('btn-fmt-a4');
  const thermalView = document.getElementById('thermal-receipt-view');
  const a4View = document.getElementById('a4-invoice-view');

  btnThermal?.addEventListener('click', () => {
    currentMode = 'thermal';
    overlay.className = 'modal-overlay mode-thermal';
    btnThermal.classList.add('active');
    btnA4.classList.remove('active');
    thermalView.style.display = 'block';
    a4View.style.display = 'none';
    setPrintPageStyle('thermal');
  });

  btnA4?.addEventListener('click', () => {
    currentMode = 'a4';
    overlay.className = 'modal-overlay mode-a4';
    btnA4.classList.add('active');
    btnThermal.classList.remove('active');
    thermalView.style.display = 'none';
    a4View.style.display = 'block';
    setPrintPageStyle('a4');
  });

  // Bind Print Trigger
  document.getElementById('bill-trigger-print-btn')?.addEventListener('click', () => {
    setPrintPageStyle(currentMode);
    window.print();
  });

  // Bind Copy Button (Text receipt for WhatsApp / SMS)
  document.getElementById('bill-copy-btn')?.addEventListener('click', () => {
    const text = generateTextReceipt(b, billNo, today, timeStr, nights, pricePerNight, roomPriceTotal, totalPrice, discount, advance, balance, isPaid, serviceChargeTotal);
    navigator.clipboard.writeText(text).then(() => {
      showToast('Receipt details copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  });

  // Bind Close Buttons
  const closeBill = () => {
    document.getElementById('print-bill-overlay')?.remove();
    document.getElementById('dynamic-page-print-style')?.remove();
  };

  document.getElementById('bill-close-btn')?.addEventListener('click', closeBill);
  document.getElementById('print-bill-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'print-bill-overlay') closeBill();
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

/** Plaintext receipt formatter for clipboard copy */
function generateTextReceipt(b, billNo, today, timeStr, nights, pricePerNight, roomPriceTotal, totalPrice, discount, advance, balance, isPaid, serviceChargeTotal = 0) {
  const extraList = Array.isArray(b.extraCharges) ? b.extraCharges : [];
  return [
    '========================================',
    '       BLUE COVE HIRIKETIYA',
    '  Hiriketiya Beach Road, Dikwella',
    '   Tel: +94 77 440 3905 / (041) 224 7368',
    '========================================',
    `RECEIPT / FOLIO: ${billNo}`,
    `Date & Time: ${today} ${timeStr}`,
    '----------------------------------------',
    `Guest Name  : ${b.guestName}`,
    `Phone       : ${b.phone || 'N/A'}`,
    `Room        : Room ${b.roomNumber} (${b.acType} ${b.bedType})`,
    `Check-In    : ${formatDate(b.checkIn, true)}`,
    `Check-Out   : ${formatDate(b.checkOut, true)}`,
    `Duration    : ${nights} Night${nights > 1 ? 's' : ''}`,
    `Meal Plan   : ${getMealLabel(b.meals)}`,
    '----------------------------------------',
    `Room Charge : ${formatCurrency(roomPriceTotal)}`,
    ...(extraList.map(ec => `Extra: ${ec.details || 'Service'}${ec.isMeal ? ' (Meal)' : ''}: ${formatCurrency(ec.amount || 0)}`)),
    serviceChargeTotal > 0 ? `Service Charge (10% Meals): + ${formatCurrency(serviceChargeTotal)}` : null,
    extraList.length > 0 || serviceChargeTotal > 0 ? `Subtotal    : ${formatCurrency(totalPrice)}` : null,
    discount > 0 ? `Discount    : - ${formatCurrency(discount)}` : null,
    `Advance Paid: - ${formatCurrency(advance)}`,
    '========================================',
    `BALANCE DUE : ${formatCurrency(balance)}`,
    serviceChargeTotal > 0 ? `Total Service Charge: ${formatCurrency(serviceChargeTotal)}` : null,
    `Status      : ${isPaid ? 'PAID IN FULL' : 'PAYMENT PENDING'}`,
    '========================================',
    'Thank you for choosing Blue Cove Hiriketiya!',
    'We look forward to welcoming you again.',
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
