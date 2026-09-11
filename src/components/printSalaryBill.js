// src/components/printSalaryBill.js — 80mm Thermal & A4 Salary Slip / Payment Bill Generator
import logoImg from '../assets/Blue cove hiriketiya (1).png';
import { showToast } from '../utils/toast.js';

let currentMode = 'thermal'; // 'thermal' (80mm) | 'a4'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function openPrintSalaryBill(payment, employee) {
  const p = payment || {};
  const emp = employee || {};

  const voucherNo = `SAL-${String(p.id || Date.now()).slice(-6).toUpperCase()}`;
  const paymentDate = p.date ? new Date(p.date) : (p.createdAt?.toDate ? p.createdAt.toDate() : new Date());
  const dateFormatted = paymentDate.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeFormatted = paymentDate.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });

  const monthIdx = parseInt(p.month, 10) - 1;
  const periodStr = `${MONTH_NAMES[monthIdx] || p.month} ${p.year}`;

  const basicSalary = Number(p.basic || emp.basicSalary || 0);
  const dailyRate = Number(p.dailyRate) || Math.round((basicSalary / 26) * 100) / 100;
  const fullDays = Number(p.fullDays || 0);
  const halfDays = Number(p.halfDays || 0);
  const effectiveDays = Number(p.effectiveDays !== undefined ? p.effectiveDays : (fullDays + halfDays * 0.5));
  const earnedBasic = Number(p.earnedBasic !== undefined ? p.earnedBasic : Math.round(effectiveDays * dailyRate));
  const serviceCharge = Number(p.serviceCharge || 0);
  const totalGross = Number(p.totalOwed !== undefined ? p.totalOwed : (earnedBasic + serviceCharge));
  const paidNow = Number(p.totalPaid || 0);
  const previouslyPaid = Number(p.alreadyPaid || 0);
  const remaining = Number(p.remainingBalance !== undefined ? p.remainingBalance : Math.max(0, totalGross - (previouslyPaid + paidNow)));

  const isMidMonth = previouslyPaid > 0 || (paidNow < totalGross && totalGross > 0);
  const paymentTypeLabel = p.paymentType || (isMidMonth ? 'Mid-Month / Advance Payment' : 'Salary Settlement');

  // Remove existing overlay if any
  document.querySelector('#print-bill-overlay')?.remove();

  currentMode = 'thermal';
  setPrintPageStyle('thermal');

  const html = `
    <div id="print-bill-overlay" class="modal-overlay mode-thermal">
      <div class="modal print-bill-modal">
        <!-- Toolbar (hidden during print) -->
        <div class="modal-header no-print print-modal-toolbar">
          <div class="print-toolbar-left">
            <h2 class="modal-title">🖨️ Salary Receipt — ${escapeHtml(emp.name || 'Employee')}</h2>
            <!-- Format Selector -->
            <div class="print-format-toggle" role="group" aria-label="Paper Format">
              <button type="button" class="print-fmt-btn active" id="btn-fmt-thermal" title="80mm Thermal POS Receipt">
                🧾 80mm Thermal
              </button>
              <button type="button" class="print-fmt-btn" id="btn-fmt-a4" title="Standard A4 Payslip">
                📄 A4 Payslip
              </button>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <button class="btn btn-secondary btn-sm" id="salary-copy-btn" title="Copy receipt details for WhatsApp/SMS">
              📋 Copy
            </button>
            <button class="btn btn-primary btn-sm" id="salary-trigger-print-btn" title="Print Salary Bill">
              🖨️ Print
            </button>
            <button class="modal-close" id="salary-close-btn" title="Close">✕</button>
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
                <div class="thermal-hotel-contact">Tel: +94 77 440 3905 / (041) 224 7368</div>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Title & Meta -->
              <div class="thermal-doc-title">*** SALARY PAYMENT VOUCHER ***</div>

              <div class="thermal-meta-list">
                <div class="thermal-row">
                  <span>Voucher No:</span>
                  <span class="thermal-bold">${voucherNo}</span>
                </div>
                <div class="thermal-row">
                  <span>Date &amp; Time:</span>
                  <span>${dateFormatted}, ${timeFormatted}</span>
                </div>
                <div class="thermal-row">
                  <span>Employee:</span>
                  <span class="thermal-bold">${escapeHtml(emp.name || 'N/A')}</span>
                </div>
                ${(emp.idNumber || emp.nic) ? `
                <div class="thermal-row">
                  <span>ID / NIC:</span>
                  <span>${escapeHtml(emp.idNumber || emp.nic)}</span>
                </div>` : ''}
                <div class="thermal-row">
                  <span>Job Role:</span>
                  <span>${escapeHtml(emp.role || 'Staff')}</span>
                </div>
                <div class="thermal-row">
                  <span>Phone:</span>
                  <span>${escapeHtml(emp.phone || 'N/A')}</span>
                </div>
                ${emp.address ? `
                <div class="thermal-row">
                  <span>Address:</span>
                  <span>${escapeHtml(emp.address)}</span>
                </div>` : ''}
                <div class="thermal-row">
                  <span>Salary Period:</span>
                  <span class="thermal-bold">${periodStr}</span>
                </div>
                <div class="thermal-row">
                  <span>Payment Type:</span>
                  <span>${paymentTypeLabel}</span>
                </div>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Calculation Breakdown -->
              <div style="font-size: 0.75rem; text-align: left; margin-bottom: 0.35rem; color: #444;">
                <strong>Attendance &amp; Rate Details:</strong>
              </div>
              <div class="thermal-meta-list">
                <div class="thermal-row">
                  <span>Monthly Basic:</span>
                  <span>Rs ${basicSalary.toLocaleString()}</span>
                </div>
                <div class="thermal-row">
                  <span>Daily Rate (Basic ÷ 26):</span>
                  <span>Rs ${dailyRate.toFixed(2)}/day</span>
                </div>
                <div class="thermal-row">
                  <span>Full Days Worked:</span>
                  <span>${fullDays} Day${fullDays === 1 ? '' : 's'} (1.0x)</span>
                </div>
                <div class="thermal-row">
                  <span>Half Days Worked:</span>
                  <span>${halfDays} Day${halfDays === 1 ? '' : 's'} (0.5x)</span>
                </div>
                <div class="thermal-row">
                  <span>Payable Days:</span>
                  <span class="thermal-bold">${effectiveDays} Days</span>
                </div>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Amounts Breakdown -->
              <div class="thermal-meta-list">
                <div class="thermal-row">
                  <span>Earned Pay (${effectiveDays}d × Rs ${dailyRate.toFixed(2)}):</span>
                  <span>Rs ${earnedBasic.toLocaleString()}</span>
                </div>
                ${serviceCharge > 0 ? `
                <div class="thermal-row">
                  <span>Service Charge:</span>
                  <span>+ Rs ${serviceCharge.toLocaleString()}</span>
                </div>
                ` : ''}
                <div class="thermal-row thermal-bold">
                  <span>Total Payable:</span>
                  <span>Rs ${totalGross.toLocaleString()}</span>
                </div>
                ${previouslyPaid > 0 ? `
                <div class="thermal-row">
                  <span>Previously Paid:</span>
                  <span>- Rs ${previouslyPaid.toLocaleString()}</span>
                </div>
                ` : ''}
              </div>

              <div class="thermal-divider-double"></div>

              <!-- Amount Paid Now Highlight -->
              <div class="thermal-total-block" style="text-align: center; padding: 0.5rem 0;">
                <div style="font-size: 0.8rem; font-weight: bold; text-transform: uppercase; margin-bottom: 0.2rem;">Amount Paid Now</div>
                <div style="font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px;">Rs ${paidNow.toLocaleString()}</div>
              </div>

              <div class="thermal-divider-double"></div>

              <div class="thermal-meta-list">
                <div class="thermal-row">
                  <span>Remaining Balance:</span>
                  <span class="thermal-bold">Rs ${remaining.toLocaleString()}</span>
                </div>
                <div class="thermal-row">
                  <span>Status:</span>
                  <span class="thermal-bold">${remaining <= 0 ? 'CLEARED / FULLY PAID' : 'PARTIAL / BALANCE DUE'}</span>
                </div>
              </div>

              <div class="thermal-divider-dashed"></div>

              <!-- Signatures -->
              <div style="margin-top: 1.5rem; display: flex; justify-content: space-between; font-size: 0.75rem; text-align: center;">
                <div style="width: 45%; border-top: 1px solid #000; padding-top: 0.25rem;">
                  Employee Signature<br>(Received By)
                </div>
                <div style="width: 45%; border-top: 1px solid #000; padding-top: 0.25rem;">
                  Manager Signature<br>(Authorized By)
                </div>
              </div>

              <div class="thermal-footer" style="margin-top: 1.5rem; text-align: center; font-size: 0.7rem; color: #555;">
                Blue Cove Hiriketiya • Employee Payroll Slip<br>
                Thank you for your dedicated service!
              </div>
            </div>

            <!-- ======================================================= -->
            <!-- STANDARD A4 PAYSLIP VIEW                                -->
            <!-- ======================================================= -->
            <div class="a4-invoice" id="a4-invoice-view" style="display: none; background: #fff; padding: 2rem; max-width: 800px; margin: 0 auto; color: #1e293b; font-family: inherit;">
              <!-- Header -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; gap: 1rem; align-items: center;">
                  <img src="${logoImg}" alt="Blue Cove Logo" style="width: 65px; height: 65px; object-fit: contain;" />
                  <div>
                    <h1 style="margin: 0; font-size: 1.5rem; color: #0f172a; font-weight: 700;">BLUE COVE HIRIKETIYA</h1>
                    <div style="font-size: 0.85rem; color: #64748b;">Hiriketiya Beach Road, Dikwella, Sri Lanka</div>
                    <div style="font-size: 0.85rem; color: #64748b;">Tel: +94 77 440 3905 / (041) 224 7368</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 1.3rem; font-weight: 800; color: #2563eb; letter-spacing: 0.5px;">SALARY PAYSLIP</div>
                  <div style="font-size: 0.9rem; color: #475569; margin-top: 0.25rem;">Voucher: <strong>${voucherNo}</strong></div>
                  <div style="font-size: 0.85rem; color: #64748b;">Date: ${dateFormatted} ${timeFormatted}</div>
                </div>
              </div>

              <!-- Employee & Period Info Cards -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                  <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 0.5rem;">Employee Details</div>
                  <div style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">${escapeHtml(emp.name || 'N/A')}</div>
                  ${(emp.idNumber || emp.nic) ? `<div style="font-size: 0.85rem; color: #475569;">ID / NIC: <strong>${escapeHtml(emp.idNumber || emp.nic)}</strong></div>` : ''}
                  <div style="font-size: 0.85rem; color: #475569;">Role: <strong>${escapeHtml(emp.role || 'Staff')}</strong></div>
                  <div style="font-size: 0.85rem; color: #475569;">Phone: ${escapeHtml(emp.phone || 'N/A')}</div>
                  ${emp.address ? `<div style="font-size: 0.85rem; color: #475569;">Address: ${escapeHtml(emp.address)}</div>` : ''}
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                  <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 0.5rem;">Payroll Period</div>
                  <div style="font-size: 1.1rem; font-weight: 700; color: #2563eb; margin-bottom: 0.25rem;">${periodStr}</div>
                  <div style="font-size: 0.85rem; color: #475569;">Payment Type: <strong>${paymentTypeLabel}</strong></div>
                  <div style="font-size: 0.85rem; color: #475569;">Calculation Basis: <strong>Basic ÷ 26 Days</strong></div>
                </div>
              </div>

              <!-- Attendance & Daily Rate Summary Table -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.9rem;">
                <thead>
                  <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                    <th style="padding: 0.6rem 0.75rem;">Description</th>
                    <th style="padding: 0.6rem 0.75rem; text-align: center;">Rate / Count</th>
                    <th style="padding: 0.6rem 0.75rem; text-align: right;">Amount (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.6rem 0.75rem;">
                      <strong>Monthly Basic Salary</strong>
                      <div style="font-size: 0.78rem; color: #64748b;">Daily Rate = Basic ÷ 26</div>
                    </td>
                    <td style="padding: 0.6rem 0.75rem; text-align: center;">Rs ${dailyRate.toFixed(2)} / day</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: right;">Rs ${basicSalary.toLocaleString()}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.6rem 0.75rem;">
                      <strong>Days Worked (This Month)</strong>
                      <div style="font-size: 0.78rem; color: #64748b;">${fullDays} Full Days (1.0x) + ${halfDays} Half Days (0.5x)</div>
                    </td>
                    <td style="padding: 0.6rem 0.75rem; text-align: center;">${effectiveDays} Payable Days</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: right;">Rs ${earnedBasic.toLocaleString()}</td>
                  </tr>
                  ${serviceCharge > 0 ? `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.6rem 0.75rem;"><strong>Service Charge / Allowances</strong></td>
                    <td style="padding: 0.6rem 0.75rem; text-align: center;">-</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: right;">+ Rs ${serviceCharge.toLocaleString()}</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>

              <!-- Financial Totals Block -->
              <div style="display: flex; justify-content: flex-end; margin-bottom: 2rem;">
                <div style="width: 320px; font-size: 0.92rem;">
                  <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b;">Total Gross Earned:</span>
                    <strong>Rs ${totalGross.toLocaleString()}</strong>
                  </div>
                  ${previouslyPaid > 0 ? `
                  <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid #e2e8f0; color: #475569;">
                    <span>Previously Paid (This Month):</span>
                    <span>- Rs ${previouslyPaid.toLocaleString()}</span>
                  </div>
                  ` : ''}
                  <div style="display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 2px solid #0f172a; font-size: 1.15rem; color: #16a34a;">
                    <strong>Amount Paid Now:</strong>
                    <strong>Rs ${paidNow.toLocaleString()}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; color: #64748b;">
                    <span>Remaining Balance:</span>
                    <strong>Rs ${remaining.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <!-- Signatures -->
              <div style="display: flex; justify-content: space-between; margin-top: 3.5rem; padding: 0 2rem;">
                <div style="width: 200px; text-align: center; border-top: 1px solid #94a3b8; padding-top: 0.5rem; font-size: 0.85rem; color: #475569;">
                  Employee Signature<br>(Received By)
                </div>
                <div style="width: 200px; text-align: center; border-top: 1px solid #94a3b8; padding-top: 0.5rem; font-size: 0.85rem; color: #475569;">
                  Authorized Signature<br>(Blue Cove Management)
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  bindSalaryPrintEvents(p, emp, voucherNo, dateFormatted, timeFormatted, periodStr, basicSalary, dailyRate, fullDays, halfDays, effectiveDays, earnedBasic, serviceCharge, totalGross, paidNow, previouslyPaid, remaining, paymentTypeLabel);
}

function bindSalaryPrintEvents(p, emp, voucherNo, dateFormatted, timeFormatted, periodStr, basicSalary, dailyRate, fullDays, halfDays, effectiveDays, earnedBasic, serviceCharge, totalGross, paidNow, previouslyPaid, remaining, paymentTypeLabel) {
  const overlay = document.getElementById('print-bill-overlay');
  const btnThermal = document.getElementById('btn-fmt-thermal');
  const btnA4 = document.getElementById('btn-fmt-a4');
  const thermalView = document.getElementById('thermal-receipt-view');
  const a4View = document.getElementById('a4-invoice-view');

  // Toggle Thermal
  btnThermal?.addEventListener('click', () => {
    currentMode = 'thermal';
    overlay.classList.remove('mode-a4');
    overlay.classList.add('mode-thermal');
    btnThermal.classList.add('active');
    btnA4.classList.remove('active');
    if (thermalView) thermalView.style.display = 'block';
    if (a4View) a4View.style.display = 'none';
    setPrintPageStyle('thermal');
  });

  // Toggle A4
  btnA4?.addEventListener('click', () => {
    currentMode = 'a4';
    overlay.classList.remove('mode-thermal');
    overlay.classList.add('mode-a4');
    btnA4.classList.add('active');
    btnThermal.classList.remove('active');
    if (thermalView) thermalView.style.display = 'none';
    if (a4View) a4View.style.display = 'block';
    setPrintPageStyle('a4');
  });

  // Print Trigger
  document.getElementById('salary-trigger-print-btn')?.addEventListener('click', () => {
    setPrintPageStyle(currentMode);
    window.print();
  });

  // Copy plain text receipt for WhatsApp / SMS
  document.getElementById('salary-copy-btn')?.addEventListener('click', () => {
    const text = [
      '========================================',
      '       BLUE COVE HIRIKETIYA',
      '  Hiriketiya Beach Road, Dikwella',
      '   Tel: +94 77 440 3905 / (041) 224 7368',
      '========================================',
      `SALARY RECEIPT: ${voucherNo}`,
      `Date & Time   : ${dateFormatted} ${timeFormatted}`,
      '----------------------------------------',
      `Employee      : ${emp.name || 'N/A'}`,
      (emp.idNumber || emp.nic) ? `ID / NIC      : ${emp.idNumber || emp.nic}` : null,
      `Role          : ${emp.role || 'Staff'}`,
      `Phone         : ${emp.phone || 'N/A'}`,
      emp.address ? `Address       : ${emp.address}` : null,
      `Period        : ${periodStr}`,
      `Payment Type  : ${paymentTypeLabel}`,
      '----------------------------------------',
      `Monthly Basic : Rs ${basicSalary.toLocaleString()}`,
      `Daily Rate    : Rs ${dailyRate.toFixed(2)} (Basic/26)`,
      `Days Worked   : ${fullDays} Full + ${halfDays} Half = ${effectiveDays} Days`,
      `Earned Pay    : Rs ${earnedBasic.toLocaleString()}`,
      serviceCharge > 0 ? `Service Charge: + Rs ${serviceCharge.toLocaleString()}` : null,
      `Total Gross   : Rs ${totalGross.toLocaleString()}`,
      previouslyPaid > 0 ? `Already Paid  : - Rs ${previouslyPaid.toLocaleString()}` : null,
      '========================================',
      `AMOUNT PAID   : Rs ${paidNow.toLocaleString()}`,
      `REMAINING DUE : Rs ${remaining.toLocaleString()}`,
      `Status        : ${remaining <= 0 ? 'CLEARED / FULLY PAID' : 'BALANCE REMAINING'}`,
      '========================================',
      'Thank you for your hard work!',
      'Blue Cove Hiriketiya Management'
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showToast('Salary receipt details copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  });

  // Close Modal
  const closeReceipt = () => {
    document.getElementById('print-bill-overlay')?.remove();
    document.getElementById('dynamic-page-print-style')?.remove();
  };

  document.getElementById('salary-close-btn')?.addEventListener('click', closeReceipt);
  overlay?.addEventListener('click', (e) => {
    if (e.target.id === 'print-bill-overlay') closeReceipt();
  });
}

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
