// src/pages/receptionist/pricingPage.js — Price Log page for managing hotel room & meal prices
import { subscribePrices, savePrices, DEFAULT_PRICES } from '../../services/priceService.js';
import { showToast, showSpinner, hideSpinner } from '../../utils/toast.js';
import { formatCurrency } from '../../utils/dateHelpers.js';

let unsubscribe = null;
let currentPrices = null;

export function renderPricingPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💰 Price Log</h1>
        <div style="font-size:0.82rem; color:var(--clr-text-muted); margin-top:2px">Manage room rates, meal plan prices & extra charges</div>
      </div>
      <button class="btn btn-accent" id="save-prices-btn">💾 Save Changes</button>
    </div>

    <div class="page-body" id="pricing-body">
      <div style="display:flex; align-items:center; justify-content:center; padding:60px; color:var(--clr-text-muted)">
        <div style="text-align:center">
          <div style="font-size:2rem; margin-bottom:8px">⏳</div>
          <div>Loading prices…</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('save-prices-btn')?.addEventListener('click', handleSave);

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribePrices(
    (prices) => {
      currentPrices = prices;
      renderPriceForm(prices);
    },
    (err) => {
      // Permission denied or no network — still show the form with defaults
      if (err.code === 'permission-denied') {
        showToast('⚠️ Prices loaded with defaults (Firestore rules not yet deployed)', 'info');
      }
    }
  );
}

function renderPriceForm(prices) {
  const body = document.getElementById('pricing-body');
  if (!body) return;

  const ac  = prices.ac  || DEFAULT_PRICES.ac;
  const nac = prices.nonAc || DEFAULT_PRICES.nonAc;
  const ml  = prices.meals || DEFAULT_PRICES.meals;
  const ep  = prices.extraPerson ?? DEFAULT_PRICES.extraPerson;

  const lastUpdated = prices.updatedAt
    ? (prices.updatedAt.toDate
        ? prices.updatedAt.toDate().toLocaleString('en-LK', { dateStyle:'medium', timeStyle:'short' })
        : new Date(prices.updatedAt).toLocaleString('en-LK', { dateStyle:'medium', timeStyle:'short' }))
    : null;

  body.innerHTML = `
    ${lastUpdated ? `
    <div class="pricing-update-banner">
      🕐 Last updated: <strong>${lastUpdated}</strong>
    </div>` : ''}

    <!-- Info Banner -->
    <div class="pricing-info-banner">
      <span style="font-size:1.1rem">ℹ️</span>
      <span>All prices are in <strong>LKR (Sri Lankan Rupees)</strong> per night. Changes are saved to the system and used as reference when creating new bookings.</span>
    </div>

    <div class="pricing-grid">

      <!-- AC Rooms -->
      <div class="pricing-card">
        <div class="pricing-card-header pricing-card-header--ac">
          <div class="pricing-card-icon">❄️</div>
          <div>
            <div class="pricing-card-title">AC Rooms</div>
            <div class="pricing-card-sub">Air-conditioned room rates per night</div>
          </div>
        </div>
        <div class="pricing-card-body">
          ${renderPriceRow('ac-single', 'Single Bed', '🛏️', ac.single)}
          ${renderPriceRow('ac-double', 'Double Bed', '🛏️🛏️', ac.double)}
          ${renderPriceRow('ac-triple', 'Triple Bed', '🛏️🛏️🛏️', ac.triple)}
        </div>
        <div class="pricing-card-preview">
          <span class="pricing-preview-label">Rate Range</span>
          <span class="pricing-preview-value">${formatCurrency(Math.min(ac.single, ac.double, ac.triple))} – ${formatCurrency(Math.max(ac.single, ac.double, ac.triple))}</span>
        </div>
      </div>

      <!-- Non-AC Rooms -->
      <div class="pricing-card">
        <div class="pricing-card-header pricing-card-header--nonac">
          <div class="pricing-card-icon">🌀</div>
          <div>
            <div class="pricing-card-title">Non-AC Rooms</div>
            <div class="pricing-card-sub">Fan-cooled room rates per night</div>
          </div>
        </div>
        <div class="pricing-card-body">
          ${renderPriceRow('nonac-single', 'Single Bed', '🛏️', nac.single)}
          ${renderPriceRow('nonac-double', 'Double Bed', '🛏️🛏️', nac.double)}
          ${renderPriceRow('nonac-triple', 'Triple Bed', '🛏️🛏️🛏️', nac.triple)}
        </div>
        <div class="pricing-card-preview">
          <span class="pricing-preview-label">Rate Range</span>
          <span class="pricing-preview-value">${formatCurrency(Math.min(nac.single, nac.double, nac.triple))} – ${formatCurrency(Math.max(nac.single, nac.double, nac.triple))}</span>
        </div>
      </div>

      <!-- Meal Plans -->
      <div class="pricing-card">
        <div class="pricing-card-header pricing-card-header--meals">
          <div class="pricing-card-icon">🍽️</div>
          <div>
            <div class="pricing-card-title">Meal Plans</div>
            <div class="pricing-card-sub">Per person per night add-on</div>
          </div>
        </div>
        <div class="pricing-card-body">
          ${renderPriceRow('meal-bb', 'BB — Bed & Breakfast', '☕', ml.bb)}
          ${renderPriceRow('meal-hb', 'HB — Half Board', '🥗', ml.hb)}
          ${renderPriceRow('meal-fb', 'FB — Full Board', '🍱', ml.fb)}
        </div>
        <div class="pricing-card-preview">
          <span class="pricing-preview-label">Full Board Rate</span>
          <span class="pricing-preview-value">${formatCurrency(ml.fb)} / pax / night</span>
        </div>
      </div>

      <!-- Extra Person -->
      <div class="pricing-card pricing-card--extra">
        <div class="pricing-card-header pricing-card-header--extra">
          <div class="pricing-card-icon">👤</div>
          <div>
            <div class="pricing-card-title">Extra Person Charge</div>
            <div class="pricing-card-sub">Additional guest surcharge per night</div>
          </div>
        </div>
        <div class="pricing-card-body">
          <div class="price-row price-row--featured">
            <div class="price-row-left">
              <span class="price-row-icon">💵</span>
              <div>
                <div class="price-row-label">Per Extra Person</div>
                <div class="price-row-sub">Added on top of base room rate</div>
              </div>
            </div>
            <div class="price-row-input-wrap">
              <span class="price-currency">LKR</span>
              <input
                type="number"
                class="price-input"
                id="price-extra-person"
                value="${ep}"
                min="0"
                step="50"
              />
            </div>
          </div>
        </div>
        <div class="pricing-card-preview">
          <span class="pricing-preview-label">Current Rate</span>
          <span class="pricing-preview-value">${formatCurrency(ep)} / extra guest / night</span>
        </div>
      </div>

    </div>

    <!-- Quick Reference Table -->
    <div class="card" style="margin-top:24px; overflow:hidden">
      <div style="padding:20px 24px 12px; border-bottom:1px solid var(--clr-border)">
        <div style="font-weight:700; font-size:0.95rem; color:var(--clr-text)">📊 Quick Reference — Current Pricing</div>
        <div style="font-size:0.78rem; color:var(--clr-text-muted); margin-top:2px">Live snapshot of all current room rates</div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table" id="price-ref-table">
          <thead>
            <tr>
              <th>Room Type</th>
              <th>Bed</th>
              <th>AC Rate / Night</th>
              <th>Non-AC Rate / Night</th>
              <th>BB Add-on</th>
              <th>HB Add-on</th>
              <th>FB Add-on</th>
            </tr>
          </thead>
          <tbody>
            ${['Single','Double','Triple'].map(bed => {
              const key = bed.toLowerCase();
              return `
                <tr>
                  <td><span class="badge badge-primary">${bed} Room</span></td>
                  <td style="font-weight:600">${bed} Bed</td>
                  <td class="ref-ac-${key}" style="font-weight:700; color:var(--clr-primary)">${formatCurrency(ac[key])}</td>
                  <td class="ref-nonac-${key}" style="font-weight:700; color:var(--clr-text)">${formatCurrency(nac[key])}</td>
                  <td class="ref-bb" style="color:var(--clr-text-muted)">${formatCurrency(ml.bb)}</td>
                  <td class="ref-hb" style="color:var(--clr-text-muted)">${formatCurrency(ml.hb)}</td>
                  <td class="ref-fb" style="color:var(--clr-text-muted)">${formatCurrency(ml.fb)}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background:var(--clr-surface-2)">
              <td colspan="2" style="font-weight:700; color:var(--clr-text-muted); font-size:0.82rem">Extra Person Surcharge</td>
              <td colspan="5" class="ref-extra" style="font-weight:700; color:var(--clr-accent)">${formatCurrency(ep)} / guest / night</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Live-update reference table as user types
  bindLivePreview();
}

function renderPriceRow(id, label, icon, value) {
  return `
    <div class="price-row">
      <div class="price-row-left">
        <span class="price-row-icon">${icon}</span>
        <span class="price-row-label">${label}</span>
      </div>
      <div class="price-row-input-wrap">
        <span class="price-currency">LKR</span>
        <input
          type="number"
          class="price-input"
          id="price-${id}"
          value="${value}"
          min="0"
          step="50"
          data-field="${id}"
        />
      </div>
    </div>
  `;
}

function bindLivePreview() {
  const inputs = document.querySelectorAll('.price-input');
  inputs.forEach(input => {
    input.addEventListener('input', updateReferenceTable);
  });
}

function getVal(id) {
  return parseFloat(document.getElementById(id)?.value) || 0;
}

function updateReferenceTable() {
  const ac  = { single: getVal('price-ac-single'), double: getVal('price-ac-double'), triple: getVal('price-ac-triple') };
  const nac = { single: getVal('price-nonac-single'), double: getVal('price-nonac-double'), triple: getVal('price-nonac-triple') };
  const ml  = { bb: getVal('price-meal-bb'), hb: getVal('price-meal-hb'), fb: getVal('price-meal-fb') };
  const ep  = getVal('price-extra-person');

  const setCells = (cls, val) => {
    document.querySelectorAll('.' + cls).forEach(el => { el.textContent = formatCurrency(val); });
  };

  ['single','double','triple'].forEach(bed => {
    setCells(`ref-ac-${bed}`,    ac[bed]);
    setCells(`ref-nonac-${bed}`, nac[bed]);
  });
  setCells('ref-bb',    ml.bb);
  setCells('ref-hb',    ml.hb);
  setCells('ref-fb',    ml.fb);
  setCells('ref-extra', ep);
}

async function handleSave() {
  const ac  = {
    single: getVal('price-ac-single'),
    double: getVal('price-ac-double'),
    triple: getVal('price-ac-triple'),
  };
  const nonAc = {
    single: getVal('price-nonac-single'),
    double: getVal('price-nonac-double'),
    triple: getVal('price-nonac-triple'),
  };
  const meals = {
    bb: getVal('price-meal-bb'),
    hb: getVal('price-meal-hb'),
    fb: getVal('price-meal-fb'),
  };
  const extraPerson = getVal('price-extra-person');

  // Validation
  const allValues = [...Object.values(ac), ...Object.values(nonAc), ...Object.values(meals), extraPerson];
  if (allValues.some(v => isNaN(v) || v < 0)) {
    showToast('All prices must be valid non-negative numbers', 'error');
    return;
  }

  showSpinner();
  try {
    await savePrices({ ac, nonAc, meals, extraPerson });
    showToast('✅ Prices updated successfully!', 'success');
  } catch (err) {
    console.error('Failed to save prices:', err);
    showToast('Failed to save prices: ' + err.message, 'error');
  } finally {
    hideSpinner();
  }
}

export function destroyPricingPage() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
