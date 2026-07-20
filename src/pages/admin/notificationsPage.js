// src/pages/admin/notificationsPage.js — Admin notifications: delete requests + price changes
import {
  subscribeDeleteRequests,
  approveDeleteRequest,
  rejectDeleteRequest,
  dismissDeleteRequest,
} from '../../services/deleteRequestService.js';
import {
  subscribeNotifications,
  markNotificationRead,
  dismissNotification,
} from '../../services/priceService.js';
import { deleteBooking } from '../../services/bookingService.js';
import { showToast, showSpinner, hideSpinner } from '../../utils/toast.js';
import { formatDate } from '../../utils/dateHelpers.js';

let unsubDeleteRequests = null;
let unsubPriceNotifs   = null;

// Combined state
let _deleteRequests = [];
let _priceNotifs   = [];

export function renderNotificationsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🔔 Notifications</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">
          Delete requests &amp; price change alerts
        </div>
      </div>
    </div>
    <div class="page-body">
      <div id="notif-list"></div>
    </div>
  `;

  // Subscribe to delete requests
  if (unsubDeleteRequests) unsubDeleteRequests();
  unsubDeleteRequests = subscribeDeleteRequests(
    (requests) => { _deleteRequests = requests; renderAll(); },
    (err) => showToast('Failed to load delete requests: ' + err.message, 'error')
  );

  // Subscribe to price-change notifications
  if (unsubPriceNotifs) unsubPriceNotifs();
  unsubPriceNotifs = subscribeNotifications(
    (notifs) => { _priceNotifs = notifs; renderAll(); },
    (err) => console.warn('Price notif error:', err)
  );
}

function renderAll() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  const pendingDel  = _deleteRequests.filter(r => r.status === 'pending');
  const resolvedDel = _deleteRequests.filter(r => r.status !== 'pending');
  const unreadPrice = _priceNotifs.filter(n => n.status === 'unread');
  const readPrice   = _priceNotifs.filter(n => n.status !== 'unread');

  const totalPending = pendingDel.length + unreadPrice.length;

  if (totalPending === 0 && resolvedDel.length === 0 && readPrice.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:var(--clr-text-muted)">
        <div style="font-size:3rem; margin-bottom:16px">✅</div>
        <div style="font-weight:700; font-size:1rem; margin-bottom:6px; color:var(--clr-text)">All Clear</div>
        <div style="font-size:0.85rem">No pending notifications</div>
      </div>`;
    return;
  }

  let html = '';

  // ── Pending / Unread section ──────────────────────────────────────
  if (totalPending > 0) {
    html += `<div class="notif-section-label notif-section-label--urgent">
      <span class="notif-pulse-dot"></span>
      Requires Attention (${totalPending})
    </div>`;

    // Price change alerts first (most actionable)
    html += unreadPrice.map(n => renderPriceCard(n, false)).join('');
    // Then delete requests
    html += pendingDel.map(r => renderDeleteCard(r)).join('');
  }

  // ── Resolved / Read section ───────────────────────────────────────
  const hasResolved = resolvedDel.length > 0 || readPrice.length > 0;
  if (hasResolved) {
    html += `<div class="notif-section-label" style="margin-top:${totalPending ? '28px' : '0'}px">
      Resolved / Read (${resolvedDel.length + readPrice.length})
    </div>`;
    html += readPrice.map(n => renderPriceCard(n, true)).join('');
    html += resolvedDel.map(r => renderDeleteCard(r)).join('');
  }

  list.innerHTML = html;
  bindCardActions();
}

// ─── Price Change Card ────────────────────────────────────────────────────────

function renderPriceCard(n, isRead) {
  const changedAt  = n.changedAt?.toDate ? n.changedAt.toDate() : new Date(n.changedAt || 0);
  const timeAgo    = formatTimeAgo(changedAt);
  const changes    = n.changes || [];
  const changedBy  = n.changedBy || 'Unknown';

  const statusBadge = isRead
    ? `<span class="notif-badge notif-badge--read">✔ Read</span>`
    : `<span class="notif-badge notif-badge--new">💵 Price Changed</span>`;

  const changesHtml = changes.map(c => {
    const dir = c.newVal > c.oldVal ? '▲' : '▼';
    const col = c.newVal > c.oldVal ? 'var(--clr-danger)' : 'var(--clr-success)';
    return `
      <div class="price-change-row">
        <span class="price-change-label">${c.label}</span>
        <span class="price-change-old">LKR ${c.oldVal.toLocaleString()}</span>
        <span class="price-change-arrow" style="color:${col}">${dir}</span>
        <span class="price-change-new" style="color:${col}; font-weight:700">LKR ${c.newVal.toLocaleString()}</span>
      </div>`;
  }).join('');

  return `
    <details class="expandable-widget notif-card notif-card--price ${isRead ? 'notif-card--resolved' : ''}"
      data-notif-id="${n.id}" data-notif-type="price">
      <summary class="notif-card-summary">
        <div class="notif-card-left">
          <div class="notif-card-icon-wrap notif-card-icon-wrap--price">💵</div>
          <div>
            ${statusBadge}
            <div class="notif-card-title">Price Log Updated — ${changes.length} rate${changes.length !== 1 ? 's' : ''} changed</div>
            <div class="notif-card-meta">by <strong>${changedBy}</strong> · ${timeAgo}</div>
          </div>
        </div>
        <span class="notif-expand-hint">▾</span>
      </summary>

      <div class="expandable-widget-content">
        <div class="price-changes-table">
          <div class="price-change-header">
            <span>Rate Name</span>
            <span>Old Price</span>
            <span></span>
            <span>New Price</span>
          </div>
          ${changesHtml}
        </div>

        <div class="notif-card-actions">
          ${!isRead ? `
            <button class="btn btn-primary btn-sm notif-price-read" data-id="${n.id}">
              ✔ Mark as Read
            </button>` : ''}
          <button class="btn btn-ghost btn-sm notif-price-dismiss" data-id="${n.id}">
            🗑 Dismiss
          </button>
        </div>
      </div>
    </details>
  `;
}

// ─── Delete Request Card ──────────────────────────────────────────────────────

function renderDeleteCard(r) {
  const b          = r.bookingSnapshot || {};
  const requestedAt = r.requestedAt?.toDate ? r.requestedAt.toDate() : new Date(r.requestedAt || 0);
  const timeAgo    = formatTimeAgo(requestedAt);
  const isPending  = r.status === 'pending';
  const isApproved = r.status === 'approved';

  const statusBadge = isPending
    ? `<span class="notif-badge notif-badge--pending">⏳ Pending</span>`
    : isApproved
    ? `<span class="notif-badge notif-badge--approved">✅ Approved</span>`
    : `<span class="notif-badge notif-badge--rejected">❌ Rejected</span>`;

  const checkIn  = b.checkIn?.toDate  ? b.checkIn.toDate()  : (b.checkIn  ? new Date(b.checkIn)  : null);
  const checkOut = b.checkOut?.toDate ? b.checkOut.toDate() : (b.checkOut ? new Date(b.checkOut) : null);
  const fmtDate  = (d) => d ? d.toLocaleDateString('en-LK', { day:'numeric', month:'short', year:'numeric' }) : '—';

  const borderColor = isPending ? 'var(--clr-danger,#ef4444)' : isApproved ? 'var(--clr-success,#22c55e)' : 'var(--clr-border)';

  return `
    <details class="expandable-widget notif-card ${!isPending ? 'notif-card--resolved' : ''}"
      data-request-id="${r.id}" style="border-left-color:${borderColor}; opacity:${isPending ? '1' : '0.75'}">
      <summary class="notif-card-summary">
        <div class="notif-card-left">
          <div class="notif-card-icon-wrap">🗑️</div>
          <div>
            ${statusBadge}
            <div class="notif-card-title">Delete Request — ${b.guestName || 'Unknown'}</div>
            <div class="notif-card-meta">Room ${b.roomNumber || '?'} · ${timeAgo}</div>
          </div>
        </div>
        <span class="notif-expand-hint">▾</span>
      </summary>

      <div class="expandable-widget-content">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; margin-bottom:${r.reason ? '10px' : '16px'}">
          ${infoItem('Room',         b.roomNumber ? `Room ${b.roomNumber}` : '—')}
          ${infoItem('Price',        b.fullPrice  ? `LKR ${Number(b.fullPrice).toLocaleString()}` : '—')}
          ${infoItem('Check-In',     fmtDate(checkIn))}
          ${infoItem('Check-Out',    fmtDate(checkOut))}
          ${infoItem('Source',       b.source || 'Direct')}
          ${infoItem('Requested By', r.requestedBy || 'Unknown')}
        </div>

        ${r.reason ? `
          <div style="background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:6px;padding:8px 12px;font-size:0.82rem;color:var(--clr-text-muted);margin-bottom:16px">
            📝 <em>${r.reason}</em>
          </div>` : ''}

        <div class="notif-card-actions">
          ${isPending ? `
            <button class="btn btn-ghost btn-sm notif-reject" data-id="${r.id}">❌ Reject</button>
            <button class="btn btn-danger btn-sm notif-approve" data-id="${r.id}" data-booking-id="${r.bookingId}">✅ Approve &amp; Delete</button>
          ` : `
            <button class="btn btn-ghost btn-sm notif-dismiss" data-id="${r.id}" style="font-size:0.75rem">🗑 Dismiss</button>
          `}
        </div>
      </div>
    </details>
  `;
}

function infoItem(label, value) {
  return `
    <div>
      <div style="font-size:0.68rem;color:var(--clr-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">${label}</div>
      <div style="font-size:0.87rem;font-weight:600;color:var(--clr-text)">${value}</div>
    </div>
  `;
}

// ─── Event binding ────────────────────────────────────────────────────────────

function bindCardActions() {
  // Delete request: Approve
  document.querySelectorAll('.notif-approve').forEach(btn => {
    btn.addEventListener('click', () => handleApprove(btn.dataset.id, btn.dataset.bookingId));
  });
  // Delete request: Reject
  document.querySelectorAll('.notif-reject').forEach(btn => {
    btn.addEventListener('click', () => handleReject(btn.dataset.id));
  });
  // Delete request: Dismiss
  document.querySelectorAll('.notif-dismiss').forEach(btn => {
    btn.addEventListener('click', () => handleDismiss(btn.dataset.id));
  });
  // Price change: Mark as read
  document.querySelectorAll('.notif-price-read').forEach(btn => {
    btn.addEventListener('click', () => handleMarkRead(btn.dataset.id));
  });
  // Price change: Dismiss
  document.querySelectorAll('.notif-price-dismiss').forEach(btn => {
    btn.addEventListener('click', () => handlePriceDismiss(btn.dataset.id));
  });
}

async function handleApprove(requestId, bookingId) {
  if (!confirm('Approve this deletion request? The booking will be permanently deleted.')) return;
  showSpinner();
  try {
    if (bookingId) await deleteBooking(bookingId);
    await approveDeleteRequest(requestId);
    showToast('Booking deleted & request approved ✅', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally { hideSpinner(); }
}

async function handleReject(requestId) {
  showSpinner();
  try {
    await rejectDeleteRequest(requestId);
    showToast('Deletion request rejected ❌', 'info');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally { hideSpinner(); }
}

async function handleDismiss(requestId) {
  try {
    await dismissDeleteRequest(requestId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function handleMarkRead(notifId) {
  try {
    await markNotificationRead(notifId);
    showToast('Marked as read ✔', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function handlePriceDismiss(notifId) {
  try {
    await dismissNotification(notifId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(date) {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function destroyNotificationsPage() {
  if (unsubDeleteRequests) { unsubDeleteRequests(); unsubDeleteRequests = null; }
  if (unsubPriceNotifs)    { unsubPriceNotifs();    unsubPriceNotifs    = null; }
  _deleteRequests = [];
  _priceNotifs    = [];
}
