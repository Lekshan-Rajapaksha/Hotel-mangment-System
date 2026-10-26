// src/utils/billingHelpers.js — Billing & Advance Payment distribution helpers

/**
 * Calculate per-room advance and remaining distribution for a group of bookings.
 * Ensures total allocated advance exactly equals totalAdvance,
 * and prevents overpaying rooms when others have unpaid balances.
 *
 * @param {Array<Object>} bookings - Array of booking objects
 * @param {number} totalAdvance - Total payment/advance amount to distribute
 * @param {'proportional' | 'sequential' | 'equal_capped'} [mode='proportional']
 * @returns {Array<{booking: Object, advance: number, remaining: number, netBill: number, full: number, disc: number}>}
 */
export function calculateGroupAdvanceDistribution(bookings, totalAdvance, mode = 'proportional') {
  if (!bookings || !bookings.length) return [];
  const val = Math.max(0, Math.round((Number(totalAdvance) || 0) * 100) / 100);

  const items = bookings.map(b => {
    const full = Math.round((Number(b.fullPrice) || 0) * 100) / 100;
    const disc = Math.round((Number(b.discountAmount) || 0) * 100) / 100;
    const netBill = Math.max(0, Math.round((full - disc) * 100) / 100);
    return {
      booking: b,
      full,
      disc,
      netBill,
      advance: 0,
      remaining: 0
    };
  });

  const totalNetBill = Math.round(items.reduce((sum, item) => sum + item.netBill, 0) * 100) / 100;

  // Case 1: Advance paid is 0
  if (val <= 0) {
    items.forEach(item => {
      item.advance = 0;
      item.remaining = item.netBill;
    });
    return items;
  }

  // Case 2: Total net bill is 0 (all rooms complimentary/100% discounted)
  if (totalNetBill <= 0) {
    const count = items.length;
    const perRoom = Math.floor((val / count) * 100) / 100;
    const rem = Math.round((val - (perRoom * count)) * 100) / 100;
    items.forEach((item, idx) => {
      item.advance = perRoom + (idx === 0 ? rem : 0);
      item.remaining = 0;
    });
    return items;
  }

  // Case 3: Advance covers or exceeds total net bill (Paid in full or overpaid)
  if (val >= totalNetBill) {
    const excess = Math.round((val - totalNetBill) * 100) / 100;
    items.forEach((item, idx) => {
      item.advance = item.netBill + (idx === 0 ? excess : 0);
      item.remaining = 0;
    });
    return items;
  }

  // Case 4: Partial payment (val < totalNetBill)
  if (mode === 'proportional') {
    // Distribute proportionally to each room's net bill
    let allocatedSum = 0;
    items.forEach(item => {
      const share = Math.floor((val * (item.netBill / totalNetBill)) * 100) / 100;
      item.advance = share;
      allocatedSum = Math.round((allocatedSum + share) * 100) / 100;
    });
    // Add rounding remainder (usually a few cents) to the first room with remaining balance
    let remainder = Math.round((val - allocatedSum) * 100) / 100;
    if (remainder > 0) {
      for (let i = 0; i < items.length; i++) {
        const canTake = Math.max(0, items[i].netBill - items[i].advance);
        if (canTake >= remainder) {
          items[i].advance = Math.round((items[i].advance + remainder) * 100) / 100;
          remainder = 0;
          break;
        } else if (canTake > 0) {
          items[i].advance = Math.round((items[i].advance + canTake) * 100) / 100;
          remainder = Math.round((remainder - canTake) * 100) / 100;
        }
      }
      if (remainder > 0) {
        items[0].advance = Math.round((items[0].advance + remainder) * 100) / 100;
      }
    }
  } else if (mode === 'sequential') {
    // Waterfall: Pay off Room 1 first, then Room 2, and keep remaining balance on later rooms
    let remainingVal = val;
    items.forEach((item, idx) => {
      if (idx === items.length - 1) {
        item.advance = Math.round(remainingVal * 100) / 100;
        remainingVal = 0;
      } else {
        const canPay = Math.min(item.netBill, remainingVal);
        item.advance = Math.round(canPay * 100) / 100;
        remainingVal = Math.round((remainingVal - canPay) * 100) / 100;
      }
    });
  } else if (mode === 'equal_capped') {
    // Divide equally, but cap each room at its bill so no room is overpaid.
    // Any excess automatically rolls over to rooms that still have positive balance.
    let remainingPool = val;
    let activeIndices = items.map((_, i) => i);
    items.forEach(item => { item.advance = 0; });

    while (activeIndices.length > 0 && remainingPool > 0.001) {
      const perRoom = Math.floor((remainingPool / activeIndices.length) * 100) / 100;
      if (perRoom <= 0) {
        // Less than 1 cent per room left: give cents to active rooms
        for (let i = 0; i < activeIndices.length && remainingPool > 0.001; i++) {
          const idx = activeIndices[i];
          const roomNeeded = Math.max(0, items[idx].netBill - items[idx].advance);
          const add = Math.min(0.01, roomNeeded, remainingPool);
          items[idx].advance = Math.round((items[idx].advance + add) * 100) / 100;
          remainingPool = Math.round((remainingPool - add) * 100) / 100;
        }
        if (remainingPool > 0.001) {
          items[activeIndices[0]].advance = Math.round((items[activeIndices[0]].advance + remainingPool) * 100) / 100;
          remainingPool = 0;
        }
        break;
      }

      let poolSpent = 0;
      const nextActive = [];
      activeIndices.forEach(idx => {
        const item = items[idx];
        const roomNeeded = Math.max(0, item.netBill - item.advance);
        const addAdv = Math.min(perRoom, roomNeeded);
        item.advance = Math.round((item.advance + addAdv) * 100) / 100;
        poolSpent = Math.round((poolSpent + addAdv) * 100) / 100;
        if (item.advance < item.netBill) {
          nextActive.push(idx);
        }
      });

      remainingPool = Math.round((remainingPool - poolSpent) * 100) / 100;
      if (nextActive.length === 0 || poolSpent === 0) {
        if (remainingPool > 0) {
          items[0].advance = Math.round((items[0].advance + remainingPool) * 100) / 100;
          remainingPool = 0;
        }
        break;
      }
      activeIndices = nextActive;
    }
  }

  // Calculate remaining balances
  items.forEach(item => {
    item.remaining = Math.max(0, Math.round((item.netBill - item.advance) * 100) / 100);
  });

  return items;
}
