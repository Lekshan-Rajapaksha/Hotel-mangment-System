// src/pages/login.js — Unified login page
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase.js';
import { getUserRole } from '../services/userService.js';
import { showSpinner, hideSpinner } from '../utils/toast.js';
import logoImg from '../assets/Blue cove hiriketiya (1).png';

export function renderLogin(onSuccess) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-page">
      <div class="login-bg-orb login-bg-orb-1"></div>
      <div class="login-bg-orb login-bg-orb-2"></div>
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon"><img src="${logoImg}" alt="Blue Cove Hiriketiya Logo" class="login-logo-img" /></div>
          <div>
            <div class="login-logo-name">Blue Cove Hiriketiya</div>
            <div class="login-logo-sub">Hotel Management System</div>
          </div>
        </div>

        <div class="login-error" id="login-error"></div>

        <form id="login-form">
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label" for="login-email">Email Address</label>
            <input
              type="email"
              id="login-email"
              class="form-control"
              placeholder="Enter your email"
              autocomplete="email"
              required
            />
          </div>

          <div class="form-group" style="margin-bottom:28px">
            <label class="form-label" for="login-password">Password</label>
            <div style="position:relative">
              <input
                type="password"
                id="login-password"
                class="form-control"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
                style="padding-right:44px"
              />
              <button type="button" id="toggle-password" style="
                position:absolute; right:12px; top:50%; transform:translateY(-50%);
                background:none; border:none; cursor:pointer; color:var(--clr-text-muted);
                font-size:1rem; padding:0; line-height:1;
              ">👁</button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary w-full btn-lg" id="login-btn">
            <span id="login-btn-text">Sign In</span>
          </button>
        </form>

        <div style="margin-top:28px; text-align:center; font-size:0.78rem; color:var(--clr-text-faint);">
          ⚡ Role is detected automatically from your credentials
        </div>
      </div>
    </div>
  `;

  // Toggle password visibility
  document.getElementById('toggle-password').addEventListener('click', () => {
    const inp = document.getElementById('login-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Form submit
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errEl.classList.remove('show');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner-ring" style="width:20px;height:20px;border-width:2px"></div>';
    showSpinner();

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const role = await getUserRole(cred.user.uid);
      hideSpinner();
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
      onSuccess(cred.user, role);
    } catch (err) {
      hideSpinner();
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
      const msg = getErrorMessage(err.code);
      errEl.textContent = msg;
      errEl.classList.add('show');
    }
  });
}

function getErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };
  return messages[code] || 'Login failed. Please try again.';
}
