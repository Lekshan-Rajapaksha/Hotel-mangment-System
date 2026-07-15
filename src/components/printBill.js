// src/components/printBill.js — Printable bill generator
import { formatCurrency, formatDate, nightCount } from '../utils/dateHelpers.js';
import logoImg from '../assets/Blue cove hiriketiya (1).png';

export function openPrintBill(booking) {
  const b = booking;
  const nights = nightCount(b.checkIn, b.checkOut);
  const pricePerNight = b.fullPrice / nights;
  const billNo = `BCH-${String(b.id || Date.now()).slice(-6).toUpperCase()}`;
  const today = new Date().toLocaleDateString('en-LK', { year:'numeric', month:'long', day:'numeric' });

  // Remove existing
  document.querySelector('#print-bill-overlay')?.remove();

  const html = `
    <div id="print-bill-overlay" class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header no-print">
          <h2 class="modal-title">🖨️ Print Bill — ${b.guestName}</h2>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="window.print()">🖨️ Print</button>
            <button class="modal-close" id="bill-close-btn">✕</button>
          </div>
        </div>
        <div class="modal-body" style="padding:0">
          <div class="print-bill" id="printable-content">

            <!-- Header -->
            <div class="print-header">
              <div class="print-hotel-left">
                <img src="${logoImg}" alt="Blue Cove Hiriketiya" class="print-hotel-logo" />
              </div>
              <div class="print-bill-no">
                <strong>${billNo}</strong>
                Invoice Date<br/>${today}
                <div class="print-bill-phone">📞 +94 XX XXX XXXX</div>
              </div>
            </div>

            <!-- Guest Info -->
            <div class="print-section-title">GUEST INFORMATION</div>
            <div class="print-info-grid" style="margin-bottom:20px">
              <div class="print-info-item">
                <div class="print-info-label">Guest Name</div>
                <div class="print-info-value">${b.guestName}</div>
              </div>
              <div class="print-info-item">
                <div class="print-info-label">Phone</div>
                <div class="print-info-value">${b.phone}</div>
              </div>
              ${b.passportNumber ? `
              <div class="print-info-item">
                <div class="print-info-label">Passport No.</div>
                <div class="print-info-value">${b.passportNumber}</div>
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
                <div class="print-info-value">${b.acType} · ${b.bedType} Bed</div>
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
                <tr><td>1</td><td>${b.guestName}</td><td>${b.passportNumber || '-'}</td></tr>
                ${b.additionalGuests.map((g,i) => `
                  <tr><td>${i+2}</td><td>${g.name}</td><td>${g.passport || '-'}</td></tr>
                `).join('')}
              </tbody>
            </table>` : ''}

            <!-- Charges -->
            <div class="print-section-title">BILLING SUMMARY</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Nights</th>
                  <th>Rate/Night</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Room ${b.roomNumber} — ${b.acType} ${b.bedType} Bed</td>
                  <td>${nights}</td>
                  <td>${formatCurrency(pricePerNight)}</td>
                  <td>${formatCurrency(b.fullPrice)}</td>
                </tr>
                ${b.meals !== 'None' ? `
                <tr>
                  <td colspan="3">${getMealLabel(b.meals)} (Included)</td>
                  <td>Included</td>
                </tr>` : ''}
              </tbody>
            </table>

            <!-- Totals -->
            <div class="print-totals">
              <div class="print-total-row">
                <span class="print-total-label">Subtotal</span>
                <span class="print-total-value">${formatCurrency(b.fullPrice)}</span>
              </div>
              <div class="print-total-row">
                <span class="print-total-label">Advance Paid</span>
                <span class="print-total-value" style="color:green">- ${formatCurrency(b.advancePaid || 0)}</span>
              </div>
              <div style="width:100%; height:1px; background:#e2e8f0; margin:8px 0"></div>
              <div class="print-total-row print-grand-total">
                <span style="font-weight:700">Balance Due</span>
                <span class="print-total-value" style="font-size:1.3rem; color:#6c8aff; font-weight:800">${formatCurrency(b.remaining || (b.fullPrice - (b.advancePaid||0)))}</span>
              </div>
            </div>

            ${b.notes ? `
            <div style="padding:12px; background:#f8fafc; border-radius:6px; margin-bottom:24px; font-size:0.85rem;">
              <strong>Notes:</strong> ${b.notes}
            </div>` : ''}

            <!-- Footer -->
            <div class="print-footer">
              <div>Thank you for staying with Blue Cove Hiriketiya!</div>
              <div style="margin-top:4px">We look forward to welcoming you again.</div>
              <div style="margin-top:8px">📞 +94 XX XXX XXXX &nbsp;|&nbsp; 📧 info@bluecovehiriketiya.com &nbsp;|&nbsp; 🌐 www.bluecovehiriketiya.com</div>
              <div style="margin-top:8px; font-size:0.7rem; color:#cbd5e1">Invoice ${billNo} — Generated ${today}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('bill-close-btn')?.addEventListener('click', () => {
    document.getElementById('print-bill-overlay')?.remove();
  });

  document.getElementById('print-bill-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'print-bill-overlay') document.getElementById('print-bill-overlay')?.remove();
  });
}

function getMealLabel(meals) {
  const labels = {
    'BB': 'Bed & Breakfast (BB)',
    'HB': 'Half Board (HB)',
    'FB': 'Full Board (FB)',
    'None': 'Room Only',
  };
  return labels[meals] || meals;
}
