// src/components/sidebar.js — Reusable sidebar component with collapse
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { showToast } from '../utils/toast.js';
import { subscribePendingCount } from '../services/deleteRequestService.js';
import logoImg from '../assets/Blue cove hiriketiya (1).png';

const COLLAPSED_KEY = 'sidebar_collapsed';

export function renderSidebar(role, currentPage, onNavigate, userName) {
  const isAdmin = role === 'admin';
  const initials = (userName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  const isCollapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';

  const adminLinks = [
    { id: 'calendar',      icon: '📅', label: 'Room Calendar' },
    { id: 'analytics',    icon: '📊', label: 'Analytics' },
    { id: 'bills',        icon: '🧾', label: 'All Bills' },
    { id: 'notifications', icon: '🔔', label: 'Notifications', badge: true },
  ];

  const receptionLinks = [
    { id: 'calendar', icon: '📅', label: 'Room Calendar' },
    { id: 'bookings', icon: '📋', label: 'My Bookings' },
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

      <!-- Brand + Collapse toggle -->
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
        <div class="sidebar-section-label">Navigation</div>
        ${linksHTML}
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-user-avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${userName || 'User'}</div>
            <div class="sidebar-user-role">${isAdmin ? '🔑 Admin' : '🎯 Receptionist'}</div>
          </div>
        </div>
        <button class="btn btn-ghost w-full" id="logout-btn" title="Sign Out" style="justify-content:flex-start; gap:10px">
          <span style="flex-shrink:0">🚪</span>
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
      subscribePendingCount((count) => {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : String(count);
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      });
    }
  }};
}

function toggleSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const mainContent = document.getElementById('main-content');
  const isCollapsed = sidebar?.classList.toggle('collapsed');

  // Update arrow
  const arrow = document.querySelector('.collapse-arrow');
  if (arrow) arrow.textContent = isCollapsed ? '▶' : '◀';

  // Update main content margin
  if (mainContent) {
    mainContent.style.marginLeft = isCollapsed
      ? 'var(--sidebar-w-collapsed)'
      : 'var(--sidebar-w)';
  }

  // Persist
  localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
}

function applySidebarState() {
  const isCollapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';
  const mainContent = document.getElementById('main-content');
  if (mainContent && isCollapsed) {
    mainContent.style.marginLeft = 'var(--sidebar-w-collapsed)';
  }
}

export function renderMobileHeader(title) {
  return `
    <header class="mobile-header" id="mobile-header">
      <button class="hamburger" id="hamburger-btn">☰</button>
      <span style="font-weight:700; font-size:0.95rem; color:var(--clr-text)">${title}</span>
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
