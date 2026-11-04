// src/components/icons.js — Unfilled outline SVG icons (Lucide / Feather style)
export function icon(name, { size = 20, strokeWidth = 1.85, className = '' } = {}) {
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ${className}"`;

  switch (name) {
    case 'calendar':
      return `<svg ${common}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;

    case 'bed':
    case 'room':
      return `<svg ${common}><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"></svg>`;

    case 'concierge-bell':
    case 'bell-ring':
      return `<svg ${common}><path d="M2 18a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2H2v-2Z"></path><path d="M20 16a8 8 0 1 0-16 0"></path><path d="M12 4v4"></path><path d="M10 4h4"></path></svg>`;

    case 'analytics':
    case 'trending-up':
      return `<svg ${common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;

    case 'trending-down':
      return `<svg ${common}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`;

    case 'bills':
    case 'receipt':
      return `<svg ${common}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path><line x1="8" y1="7" x2="16" y2="7"></line><line x1="8" y1="11" x2="16" y2="11"></line><line x1="8" y1="15" x2="12" y2="15"></line></svg>`;

    case 'utility':
    case 'zap':
      return `<svg ${common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;

    case 'employees':
    case 'users':
      return `<svg ${common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

    case 'user':
      return `<svg ${common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

    case 'commission':
    case 'award':
    case 'badge-percent':
      return `<svg ${common}><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="M9 9h.01"></path><path d="M15 15h.01"></path></svg>`;

    case 'notifications':
    case 'bell':
      return `<svg ${common}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;

    case 'bookings':
    case 'ticket':
      return `<svg ${common}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v2"></path><path d="M13 17v2"></path><path d="M13 11v2"></path></svg>`;

    case 'pricing':
    case 'tag':
      return `<svg ${common}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path><path d="M7 7h.01"></path></svg>`;

    case 'logout':
    case 'log-out':
      return `<svg ${common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;

    case 'crown':
    case 'shield':
      return `<svg ${common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;

    case 'dollar-sign':
    case 'money':
      return `<svg ${common}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;

    case 'credit-card':
      return `<svg ${common}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;

    case 'droplet':
    case 'water':
      return `<svg ${common}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`;

    case 'clock':
      return `<svg ${common}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

    case 'check-circle':
      return `<svg ${common}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;

    case 'alert-circle':
      return `<svg ${common}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    case 'info':
      return `<svg ${common}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

    case 'download':
      return `<svg ${common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    case 'plus':
      return `<svg ${common}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    case 'chevron-left':
      return `<svg ${common}><polyline points="15 18 9 12 15 6"></polyline></svg>`;

    case 'chevron-right':
      return `<svg ${common}><polyline points="9 18 15 12 9 6"></polyline></svg>`;

    case 'search':
      return `<svg ${common}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

    case 'sparkles':
      return `<svg ${common}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>`;

    case 'utensils':
    case 'chef':
      return `<svg ${common}><path d="M18 2v20M6 2v7a6 6 0 0 0 6 6v7M6 2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2M6 2v7"></path></svg>`;

    case 'wrench':
    case 'tool':
      return `<svg ${common}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;

    case 'car':
    case 'transport':
      return `<svg ${common}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>`;

    default:
      return `<svg ${common}><circle cx="12" cy="12" r="10"></circle></svg>`;
  }
}

// Maps job role/designation to an unfilled icon name
export function getJobRoleIcon(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('clean') || r.includes('housekeep') || r.includes('room service')) return 'sparkles';
  if (r.includes('cook') || r.includes('chef') || r.includes('kitchen')) return 'utensils';
  if (r.includes('reception') || r.includes('front desk') || r.includes('desk')) return 'concierge-bell';
  if (r.includes('manager') || r.includes('admin') || r.includes('supervisor') || r.includes('lead')) return 'shield';
  if (r.includes('driver') || r.includes('transport') || r.includes('tour')) return 'car';
  if (r.includes('maintain') || r.includes('technician') || r.includes('repair') || r.includes('electric')) return 'wrench';
  if (r.includes('security') || r.includes('guard')) return 'shield';
  if (r.includes('waiter') || r.includes('steward') || r.includes('bar')) return 'utensils';
  return 'user';
}

// Renders an employee avatar with an unfilled icon badge matching their job
export function renderAvatarWithRoleBadge(initials, role, { isProfile = false } = {}) {
  const iconName = getJobRoleIcon(role);
  const size = isProfile ? 72 : 44;
  const badgeSize = isProfile ? 26 : 18;
  const iconSvgSize = isProfile ? 14 : 11;
  const fontSize = isProfile ? '1.5rem' : '0.9rem';

  return `
    <div class="role-avatar-wrapper" style="position:relative; width:${size}px; height:${size}px; flex-shrink:0; display:inline-flex;">
      <div class="${isProfile ? 'profile-avatar' : 'emp-avatar'}" style="width:${size}px; height:${size}px; font-size:${fontSize};">
        ${initials}
      </div>
      <div class="role-avatar-badge" title="${role || 'Employee'}" style="
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: ${badgeSize}px;
        height: ${badgeSize}px;
        border-radius: 50%;
        background: #ffffff;
        color: var(--clr-primary);
        border: 1.5px solid #ffffff;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
      ">
        ${icon(iconName, { size: iconSvgSize, strokeWidth: 2 })}
      </div>
    </div>
  `;
}

