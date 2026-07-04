// src/main.js — Application entry point
import './style.css';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import { getUserRole, setUserProfile } from './services/userService.js';
import { renderLogin } from './pages/login.js';
import { renderReceptionistDashboard } from './pages/receptionist/dashboard.js';
import { renderAdminDashboard } from './pages/admin/dashboard.js';
import { showSpinner, hideSpinner, showToast } from './utils/toast.js';

let currentUser = null;
let currentRole = null;

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is logged in — get role
    showSpinner();
    try {
      let role = await getUserRole(user.uid);

      // If no role in Firestore yet, create a default profile
      if (!role) {
        // Default new users to receptionist (admin must be set manually)
        role = 'receptionist';
        await setUserProfile(user.uid, {
          email: user.email,
          name: user.email?.split('@')[0] || 'User',
          role,
          createdAt: new Date().toISOString()
        });
      }

      currentUser = user;
      currentRole = role;
      hideSpinner();
      renderDashboard(user, role);
    } catch (err) {
      hideSpinner();
      console.error('Failed to get user role:', err);
      showToast('Error loading profile. Check Firestore connection.', 'error');
      renderLogin(handleLoginSuccess);
    }
  } else {
    // Not logged in
    currentUser = null;
    currentRole = null;
    renderLogin(handleLoginSuccess);
  }
});

async function handleLoginSuccess(user, role) {
  if (!role) {
    // Role not set yet — set default
    role = 'receptionist';
    await setUserProfile(user.uid, {
      email: user.email,
      name: user.email?.split('@')[0] || 'User',
      role,
      createdAt: new Date().toISOString()
    });
  }
  currentUser = user;
  currentRole = role;
  renderDashboard(user, role);
}

function renderDashboard(user, role) {
  const userProfile = { name: user.email?.split('@')[0] || 'User', role };

  if (role === 'admin') {
    renderAdminDashboard(user, userProfile);
  } else {
    renderReceptionistDashboard(user, userProfile);
  }
}
