// src/components/sidebar.js — Reusable sidebar component with collapse
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { showToast } from '../utils/toast.js';
import { subscribePendingCount } from '../services/deleteRequestService.js';
import { subscribeUnreadPriceNotifCount } from '../services/priceService.js';
import { subscribePendingCommissionEditCount } from '../services/commissionEditRequestService.js';
import { icon } from './icons.js';
import logoImg from '../assets/Blue cove hiriketiya (1).png';

const COLLAPSED_KEY = 'sidebar_collapsed';

export function renderSidebar(role, currentPage, onNavigate, userName) {
  const isAdmin = role === 'admin';
  const initials = (userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  const isCollapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';

  const adminLinks = [
    { id: 'calendar',      icon: icon('calendar'),      label: 'Room Calendar' },
    { id: 'roomsummary',  icon: icon('bed'),           label: 'Room Summary' },
    { id: 'analytics',    icon: icon('analytics'),     label: 'Analytics' },
    { id: 'bills',        icon: icon('receipt'),       label: 'All Bills' },
    { id: 'utility',      icon: icon('zap'),           label: 'Utility' },
    { id: 'employees',    icon: icon('users'),         label: 'Employees' },
    { id: 'commission',   icon: icon('award'),         label: 'Commission' },
    { id: 'notifications', icon: icon('bell'),         label: 'Notifications', badge: true },
  ];

  const receptionLinks = [
    { id: 'calendar',     icon: icon('calendar'),      label: 'Room Calendar' },
    { id: 'bookings',     icon: icon('ticket'),        label: 'My Bookings' },
    { id: 'pricing',      icon: icon('tag'),           label: 'Price Log' },
    { id: 'utilitybills', icon: icon('zap'),           label: 'Bills' },
    { id: 'employees',    icon: icon('users'),         label: 'Employees' },
    { id: 'commission',   icon: icon('award'),         label: 'Commission' },
  ];

  const links = isAdmin ? adminLinks : receptionLinks;

  const linksHTML = links.map(l => `
    <a class="sidebar-link ${currentPage === l.id ? 'active' : ''}" data-page="${l.id}" id="nav-${l.id}" title="${l.label}" style="position:relative">
      <span class="sidebar-link-icon">${l.icon}</span>
      <span class="sidebar-link-text">${l.label}</span>
      ${l.badge ? `<span class="notif-badge" id="notif-badge" style="display:none">0</span>` : ''}
    </a>
  `).join('');

  const html = `
    <aside class="sidebar ${isCollapsed ? 'collapsed' : ''}" id="main-sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-icon"><img src="${logoImg}" alt="Blue Cove Logo" class="sidebar-brand-img" /></div>
        <div class="sidebar-brand-text">
          <div class="sidebar-brand-name">Blue Cove</div>
          <div class="sidebar-brand-sub">${isAdmin ? 'Admin Panel' : 'Reception'}</div>
        </div>
        <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" title="Toggle sidebar">
          <span class="collapse-arrow">${isCollapsed ? '▶' : '◀'}</span>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="sidebar-nav-group">
          <div class="sidebar-section-label">${isAdmin ? 'Admin workspace' : 'Reception workspace'}</div>
          ${linksHTML}
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-section-label sidebar-footer-label">Account</div>
        <div class="sidebar-user">
          <div class="sidebar-user-avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${userName || 'User'}</div>
            <div class="sidebar-user-role" style="display:inline-flex; align-items:center; gap:4px">
              ${isAdmin ? `${icon('shield', { size: 14 })} Admin` : `${icon('user', { size: 14 })} Receptionist`}
            </div>
          </div>
        </div>
        <button class="btn btn-ghost w-full" id="logout-btn" title="Sign Out">
          <span style="flex-shrink:0; display:inline-flex; align-items:center">${icon('logout', { size: 17 })}</span>
          <span class="sidebar-link-text">Sign Out</span>
        </button>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
  `;

  return { html, bindEvents: () => {
    // Navigation links
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
      link.addEventListener('click', () => {
        const page = link.dataset.page;
        closeMobileSidebar();
        onNavigate(page);
      });
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await signOut(auth);
      showToast('Signed out successfully', 'info');
    });

    // Collapse toggle
    document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
      toggleSidebar();
    });

    // Backdrop
    document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

    // Apply initial state
    applySidebarState();

    // Live pending-count badge for admin notifications
    if (isAdmin) {
      let deleteCount = 0;
      let priceCount  = 0;
      let commissionCount = 0;

      const updateBadge = () => {
        const total = deleteCount + priceCount + commissionCount;
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (total > 0) {
          badge.textContent = total > 99 ? '99+' : String(total);
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      };

      subscribePendingCount((count) => {
        deleteCount = count;
        updateBadge();
      });

      subscribeUnreadPriceNotifCount((count) => {
        priceCount = count;
        updateBadge();
      });

      subscribePendingCommissionEditCount((count) => {
        commissionCount = count;
        updateBadge();
      });
    }
  }};
}

function toggleSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const isCollapsed = sidebar?.classList.toggle('collapsed');

  // Update arrow
  const arrow = document.querySelector('.collapse-arrow');
  if (arrow) arrow.textContent = isCollapsed ? '▶' : '◀';

  // Persist
  localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
}

function applySidebarState() {
  // CSS handles the margin based on .sidebar.collapsed
}

export function renderMobileHeader(title) {
  return `
    <header class="mobile-header" id="mobile-header">
      <button class="hamburger" id="hamburger-btn" aria-label="Toggle navigation" style="display:inline-flex; align-items:center; justify-content:center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <span style="font-family:var(--font-display); font-weight:800; font-size:1rem; color:var(--clr-text)">${title}</span>
    </header>
  `;
}

export function bindMobileHeader() {
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('main-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar?.classList.toggle('open');
    backdrop?.classList.toggle('open');
  });
}

export function closeMobileSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar?.classList.remove('open');
  backdrop?.classList.remove('open');
}

export function setActiveNav(page) {
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}
