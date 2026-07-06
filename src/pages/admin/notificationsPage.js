// src/pages/admin/notificationsPage.js — Admin delete-request notifications
import {
  subscribeDeleteRequests,
  approveDeleteRequest,
  rejectDeleteRequest,
  dismissDeleteRequest,
} from '../../services/deleteRequestService.js';
import { deleteBooking } from '../../services/bookingService.js';
import { showToast, showSpinner, hideSpinner } from '../../utils/toast.js';
import { formatDate } from '../../utils/dateHelpers.js';

let unsubscribe = null;

export function renderNotificationsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🔔 Notifications</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">
          Booking deletion requests from receptionists
        </div>
      </div>
    </div>
    <div class="page-body">
      <div id="notif-list"></div>
    </div>
  `;

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeDeleteRequests(
    (requests) => renderList(requests),
    (err) => {
      const list = document.getElementById('notif-list');
      if (list) list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--clr-danger,#ef4444)">⚠️ Failed to load: ${err.message}</div>`;
    }
  );
}

function renderList(requests) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!requests.length) {
    list.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:var(--clr-text-muted)">
        <div style="font-size:3rem; margin-bottom:16px">✅</div>
        <div style="font-weight:700; font-size:1rem; margin-bottom:6px; color:var(--clr-text)">All Clear</div>
        <div style="font-size:0.85rem">No pending deletion requests</div>
      </div>`;
    return;
  }

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  let html = '';

  if (pending.length) {
    html += `<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--clr-danger,#ef4444);margin-bottom:12px;display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--clr-danger,#ef4444);display:inline-block;animation:pulse 1.5s infinite"></span>
      Pending Approval (${pending.length})
    </div>`;
    html += pending.map(r => renderCard(r)).join('');
  }

  if (resolved.length) {
    html += `<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--clr-text-muted);margin:${pending.length?'28px':'0'}px 0 12px">
      Resolved (${resolved.length})
    </div>`;
    html += resolved.map(r => renderCard(r)).join('');
  }

  list.innerHTML = html;
  bindCardActions(requests);
}

function renderCard(r) {
  const b = r.bookingSnapshot || {};
  const requestedAt = r.requestedAt?.toDate ? r.requestedAt.toDate() : new Date(r.requestedAt || 0);
  const timeAgo = formatTimeAgo(requestedAt);

  const isPending  = r.status === 'pending';
  const isApproved = r.status === 'approved';
  const isRejected = r.status === 'rejected';

  const statusBadge = isPending
    ? `<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700">⏳ Pending</span>`
    : isApproved
    ? `<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700">✅ Approved</span>`
    : `<span style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.3);padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700">❌ Rejected</span>`;

  const checkIn  = b.checkIn?.toDate  ? b.checkIn.toDate()  : (b.checkIn  ? new Date(b.checkIn)  : null);
  const checkOut = b.checkOut?.toDate ? b.checkOut.toDate() : (b.checkOut ? new Date(b.checkOut) : null);
  const fmtDate  = (d) => d ? d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return `
    <div class="card notif-card" data-request-id="${r.id}" style="
      margin-bottom:12px;
      border-left:4px solid ${isPending ? 'var(--clr-danger,#ef4444)' : isApproved ? 'var(--clr-success,#22c55e)' : 'var(--clr-border)'};
      opacity:${isPending ? '1' : '0.75'};
    ">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap">
            ${statusBadge}
            <span style="font-size:0.75rem; color:var(--clr-text-muted)">${timeAgo} · by ${r.requestedBy || 'Unknown'}</span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; margin-bottom:${r.reason?'10px':'0'}">
            ${infoItem('Guest', b.guestName || '—')}
            ${infoItem('Room', b.roomNumber ? `Room ${b.roomNumber}` : '—')}
            ${infoItem('Check-In', fmtDate(checkIn))}
            ${infoItem('Check-Out', fmtDate(checkOut))}
            ${infoItem('Price', b.fullPrice ? `LKR ${Number(b.fullPrice).toLocaleString()}` : '—')}
            ${infoItem('Source', b.source || 'Direct')}
          </div>

          ${r.reason ? `
            <div style="background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:6px;padding:8px 12px;font-size:0.82rem;color:var(--clr-text-muted)">
              📝 <em>${r.reason}</em>
            </div>` : ''}
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0">
          ${isPending ? `
            <button class="btn btn-danger btn-sm notif-approve" data-id="${r.id}" data-booking-id="${r.bookingId}">
              ✅ Approve & Delete
            </button>
            <button class="btn btn-ghost btn-sm notif-reject" data-id="${r.id}">
              ❌ Reject
            </button>
          ` : `
            <button class="btn btn-ghost btn-sm notif-dismiss" data-id="${r.id}" style="font-size:0.75rem">
              🗑 Dismiss
            </button>
          `}
        </div>
      </div>
    </div>
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

function bindCardActions(requests) {
  // Approve
  document.querySelectorAll('.notif-approve').forEach(btn => {
    btn.addEventListener('click', () => handleApprove(btn.dataset.id, btn.dataset.bookingId));
  });

  // Reject
  document.querySelectorAll('.notif-reject').forEach(btn => {
    btn.addEventListener('click', () => handleReject(btn.dataset.id));
  });

  // Dismiss
  document.querySelectorAll('.notif-dismiss').forEach(btn => {
    btn.addEventListener('click', () => handleDismiss(btn.dataset.id));
  });
}

async function handleApprove(requestId, bookingId) {
  if (!confirm('Approve this deletion request? The booking will be permanently deleted.')) return;
  showSpinner();
  try {
    // Delete the actual booking
    if (bookingId) await deleteBooking(bookingId);
    // Mark request as approved
    await approveDeleteRequest(requestId);
    showToast('Booking deleted & request approved ✅', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error: ' + err.message, 'error');
  } finally {
    hideSpinner();
  }
}

async function handleReject(requestId) {
  showSpinner();
  try {
    await rejectDeleteRequest(requestId);
    showToast('Deletion request rejected ❌', 'info');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    hideSpinner();
  }
}

async function handleDismiss(requestId) {
  try {
    await dismissDeleteRequest(requestId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function formatTimeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
