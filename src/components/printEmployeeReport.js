// src/components/printEmployeeReport.js
import logoImg from '../assets/Blue cove hiriketiya (1).png';
import { showToast } from '../utils/toast.js';

export function openPrintEmployeeReport(emp, allAttendanceList, allSalaries) {
  if (!emp) return;

  const datePrinted = new Date();
  const dateFormatted = datePrinted.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeFormatted = datePrinted.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });

  const basicSalary = Number(emp.basicSalary || 0);
  const dailyRate = Math.round((basicSalary / 26) * 100) / 100;

  // Calculate all-time attendance
  const allEmpAtt = allAttendanceList.filter(a => a.employeeId === emp.id);
  const totalFullDays = allEmpAtt.filter(a => a.status === 'Full Day').length;
  const totalHalfDays = allEmpAtt.filter(a => a.status === 'Half Day').length;
  const totalEffectiveDays = totalFullDays + (totalHalfDays * 0.5);

  // Calculate all-time payments
  const allEmpPayments = allSalaries.filter(p => p.employeeId === emp.id);
  const totalPaidAllTime = allEmpPayments.reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);
  const totalServiceChargeAllTime = allEmpPayments.reduce((sum, p) => sum + Number(p.serviceCharge || 0), 0);

  // Earnings up to date
  const totalEarnedBasic = Math.round(totalEffectiveDays * dailyRate);
  const totalGrossEarned = totalEarnedBasic + totalServiceChargeAllTime;
  const overallRemaining = Math.max(0, totalGrossEarned - totalPaidAllTime);

  document.querySelector('#print-bill-overlay')?.remove();
  
  setPrintPageStyle();

  const paymentHistoryHtml = allEmpPayments.length > 0 ? [...allEmpPayments].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,10).map(p => `
    <div style="font-size: 0.75rem; text-align: left; padding: 0.35rem 0; border-bottom: 1px dashed #ccc;">
      <div style="display: flex; justify-content: space-between;">
        <span><strong>Date:</strong> ${new Date(p.date).toLocaleDateString('en-LK')}</span>
        <span><strong>Paid:</strong> Rs ${Number(p.totalPaid || 0).toLocaleString()}</span>
      </div>
      <div style="color: #444; margin-top: 0.15rem;"><strong>Period:</strong> ${p.month}/${p.year} (${p.paymentType || 'Salary'})</div>
    </div>
  `).join('') : '<div style="font-size: 0.75rem; text-align: center; padding: 0.5rem 0;">No past payments found</div>';

  const html = `
    <div id="print-bill-overlay" class="modal-overlay mode-thermal">
      <div class="modal print-bill-modal">
        <div class="modal-header no-print print-modal-toolbar">
          <div class="print-toolbar-left">
            <h2 class="modal-title">🖨️ Full Employee Report</h2>
          </div>
          <div class="flex gap-2 items-center">
            <button class="btn btn-primary btn-sm" id="salary-trigger-print-btn" title="Print Report">
              🖨️ Print
            </button>
            <button class="modal-close" id="salary-close-btn" title="Close">✕</button>
          </div>
        </div>

        <div class="modal-body print-modal-scroll" style="padding:0">
          <div class="print-preview-stage" id="printable-content">

            <!-- 80MM THERMAL RECEIPT VIEW ONLY -->
            <div class="thermal-receipt" id="thermal-receipt-view" style="display: block;">
              <div class="thermal-header">
                <img src="${logoImg}" alt="Blue Cove Hiriketiya" class="thermal-logo" />
                <div class="thermal-hotel-title">BLUE COVE HIRIKETIYA</div>
                <div class="thermal-hotel-sub">Hiriketiya Beach Road, Dikwella</div>
              </div>
              <div class="thermal-divider-dashed"></div>
              <div class="thermal-doc-title">*** EMPLOYEE REPORT ***</div>
              <div class="thermal-meta-list">
                <div class="thermal-row">
                  <span>Date:</span>
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
                <div class="thermal-row">
                  <span>Monthly Basic:</span>
                  <span>Rs ${basicSalary.toLocaleString()}</span>
                </div>
                <div class="thermal-row">
                  <span>Daily Rate:</span>
                  <span>Rs ${dailyRate.toFixed(2)}</span>
                </div>
              </div>
              
              <div class="thermal-divider-dashed"></div>
              <div style="font-size: 0.75rem; text-align: left; margin-bottom: 0.35rem; color: #444;">
                <strong>All-Time Summary:</strong>
              </div>
              <div class="thermal-meta-list">
                <div class="thermal-row">
                  <span>Total Full Days:</span>
                  <span>${totalFullDays}</span>
                </div>
                <div class="thermal-row">
                  <span>Total Half Days:</span>
                  <span>${totalHalfDays}</span>
                </div>
                <div class="thermal-row">
                  <span>Total Worked Days:</span>
                  <span class="thermal-bold">${totalEffectiveDays}</span>
                </div>
                <div class="thermal-row">
                  <span>Total Earned (Basic):</span>
                  <span>Rs ${totalEarnedBasic.toLocaleString()}</span>
                </div>
                <div class="thermal-row">
                  <span>Total SC/Allowance:</span>
                  <span>+ Rs ${totalServiceChargeAllTime.toLocaleString()}</span>
                </div>
                <div class="thermal-row thermal-bold">
                  <span>Total Gross Earned:</span>
                  <span>Rs ${totalGrossEarned.toLocaleString()}</span>
                </div>
                <div class="thermal-row" style="color: #d97706;">
                  <span>Total Paid to Date:</span>
                  <span>- Rs ${totalPaidAllTime.toLocaleString()}</span>
                </div>
              </div>

              <div class="thermal-divider-dashed"></div>
              <div style="font-size: 0.75rem; text-align: left; margin-bottom: 0.35rem; color: #444;">
                <strong>Recent Payment History:</strong>
              </div>
              ${paymentHistoryHtml}
              ${allEmpPayments.length > 10 ? `<div style="font-size: 0.7rem; text-align: center; color: #666; margin-top: 0.25rem;">Showing last 10 payments</div>` : ''}

              <div class="thermal-divider-double"></div>
              <div class="thermal-total-block" style="text-align: center; padding: 0.5rem 0;">
                <div style="font-size: 0.8rem; font-weight: bold; text-transform: uppercase; margin-bottom: 0.2rem;">Total Remaining Balance</div>
                <div style="font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px;">Rs ${overallRemaining.toLocaleString()}</div>
              </div>
              <div class="thermal-divider-double"></div>
              
              <div class="thermal-footer" style="margin-top: 1.5rem; text-align: center; font-size: 0.7rem; color: #555;">
                Generated on ${dateFormatted}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const overlay = document.getElementById('print-bill-overlay');

  document.getElementById('salary-trigger-print-btn')?.addEventListener('click', () => {
    window.print();
  });

  const closeReceipt = () => {
    document.getElementById('print-bill-overlay')?.remove();
    document.getElementById('dynamic-page-print-style')?.remove();
  };

  document.getElementById('salary-close-btn')?.addEventListener('click', closeReceipt);
  overlay?.addEventListener('click', (e) => {
    if (e.target.id === 'print-bill-overlay') closeReceipt();
  });
}

function setPrintPageStyle() {
  let styleEl = document.getElementById('dynamic-page-print-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-page-print-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = '@page { size: 80mm auto; margin: 0; }';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
