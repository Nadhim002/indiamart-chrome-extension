const LOCATION_KEYWORDS = ['Tamil Nadu', 'Karnataka', 'Andhra', 'Kerala'];

function parseDurationToMinutes(text) {
  const t = text.trim().toLowerCase();
  if (t === 'yesterday') return 1440;
  const match = t.match(/^(\d+)\s*(sec|secs|min|mins|hr|hrs|day|days)/);
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  if (unit.startsWith('sec')) return 0;
  if (unit.startsWith('min')) return n;
  if (unit.startsWith('hr')) return n * 60;
  if (unit.startsWith('day')) return n * 1440;
  return 0;
}

function parseOrderValue(text) {
  // e.g. "Rs. 40,000 - 48,000" or "Rs. 1 to 2 Lakh" (Lakh may only appear on second part)
  const clean = text.replace(/Rs\.?\s*/i, '').trim();
  const isLakh = /lakh/i.test(clean);
  const parts = clean.split(/\s*(?:-|to)\s*/i);
  const lower = parts[0].trim();
  const num = parseFloat(lower.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return 0;
  return isLakh ? num * 100000 : num;
}

function parseQuantity(text) {
  const match = text.match(/(\d[\d,]*)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ''), 10);
}

function extractCardData(cardEl, n) {
  const stateEl = cardEl.querySelector(`#card_state_${n}`);
  const state = stateEl ? stateEl.value : '';

  // Duration: clock icon is in .lstNwLftLoc, look for strong tag
  let durationText = '';
  const locDivs = cardEl.querySelectorAll('.lstNwLftLoc');
  for (const div of locDivs) {
    const strong = div.querySelector('strong');
    if (strong && /sec|min|hr|day|yesterday/i.test(strong.textContent)) {
      durationText = strong.textContent.trim();
      break;
    }
    // Also check plain <p><strong>0 sec</strong></p>
    const p = div.querySelector('p');
    if (p) {
      const s = p.querySelector('strong');
      if (s && /sec|min|hr|day|yesterday/i.test(s.textContent)) {
        durationText = s.textContent.trim();
        break;
      }
    }
  }

  let quantity = 0;
  let orderValue = 0;

  const rows = cardEl.querySelectorAll('table tr');
  for (const row of rows) {
    const tds = row.querySelectorAll('td');
    if (tds.length < 2) continue;
    const label = tds[0].textContent.trim();
    const bold = tds[1].querySelector('b');
    if (!bold) continue;
    const val = bold.textContent.trim();
    if (label === 'Quantity') quantity = parseQuantity(val);
    if (label === 'Probable Order Value') orderValue = parseOrderValue(val);
  }

  const ctaBtn = cardEl.querySelector('.Slid_CTA .btnCBN');

  return { cardId: `list${n}`, state, durationText, quantity, orderValue, ctaBtn };
}

function matchesCriteria(data, settings) {
  const durationMinutes = parseDurationToMinutes(data.durationText);

  if (durationMinutes >= settings.minTimePassed) return false;

  const valueOk = data.quantity >= settings.minOrderQty || data.orderValue >= settings.minOrderValue;
  if (!valueOk) return false;

  const locationOk = LOCATION_KEYWORDS.some(kw =>
    data.state.toLowerCase().includes(kw.toLowerCase())
  );
  if (!locationOk) return false;

  return true;
}

function onLeadBought(leadPayload) {
  // Future: send notification, log, etc.
}

function processCards(settings) {
  const listing = document.getElementById('bl_listing');
  if (!listing) return;

  const cards = listing.querySelectorAll('[id^="list"]');
  cards.forEach(card => {
    const match = card.id.match(/^list(\d+)$/);
    if (!match) return;
    const n = match[1];
    const data = extractCardData(card, n);

    if (matchesCriteria(data, settings)) {
      console.log('[LeadBuyer] Buying lead:', data.cardId, data.state, data.durationText);
      if (data.ctaBtn) data.ctaBtn.click();
      onLeadBought({
        cardId: data.cardId,
        state: data.state,
        quantity: data.quantity,
        orderValue: data.orderValue,
        durationMinutes: parseDurationToMinutes(data.durationText),
        timestamp: Date.now(),
      });
    } else {
      console.log('[LeadBuyer] Skipping lead:', data.cardId, data.state, data.durationText);
    }
  });
}

function waitForListing(settings, timeout = 10000) {
  return new Promise((resolve) => {
    if (document.getElementById('bl_listing')) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if (document.getElementById('bl_listing')) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
    setTimeout(() => {
      clearInterval(interval);
      resolve(); // proceed even if not found
    }, timeout);
  });
}

if (typeof module !== 'undefined') {
  module.exports = { parseDurationToMinutes, parseOrderValue, parseQuantity, extractCardData, matchesCriteria };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK') {
    waitForListing(message.settings).then(() => {
      processCards(message.settings);
      sendResponse({ ok: true });
    });
    return true;
  }
});
