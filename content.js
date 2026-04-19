const LOCATION_KEYWORDS = ['Tamil Nadu', 'Karnataka', 'Andhra', 'Kerala'];

function log(...args) {
  console.log('[LB:cs]', new Date().toLocaleTimeString(), ...args);
}
function warn(...args) {
  console.warn('[LB:cs]', new Date().toLocaleTimeString(), ...args);
}

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

  let durationText = '';
  const locDivs = cardEl.querySelectorAll('.lstNwLftLoc');
  for (const div of locDivs) {
    const strong = div.querySelector('strong');
    if (strong && /sec|min|hr|day|yesterday/i.test(strong.textContent)) {
      durationText = strong.textContent.trim();
      break;
    }
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

  if (durationMinutes >= settings.minTimePassed) {
    log(`  SKIP ${data.cardId} — too old: ${data.durationText} (${durationMinutes}min >= ${settings.minTimePassed}min)`);
    return false;
  }

  const valueOk = data.quantity >= settings.minOrderQty || data.orderValue >= settings.minOrderValue;
  if (!valueOk) {
    log(`  SKIP ${data.cardId} — value too low: qty=${data.quantity} value=₹${data.orderValue}`);
    return false;
  }

  const locationOk = LOCATION_KEYWORDS.some(kw =>
    data.state.toLowerCase().includes(kw.toLowerCase())
  );
  if (!locationOk) {
    log(`  SKIP ${data.cardId} — location not matched: "${data.state}"`);
    return false;
  }

  return true;
}

function onLeadBought(leadPayload) {
  log('Lead bought:', leadPayload);
}

function processCards(settings) {
  const listing = document.getElementById('bl_listing');
  if (!listing) {
    warn('processCards called but #bl_listing not found in DOM');
    return;
  }

  const cards = listing.querySelectorAll('[id^="list"]');
  log(`Processing ${cards.length} card(s) — settings: minTimePassed=${settings.minTimePassed}min, minOrderQty=${settings.minOrderQty}, minOrderValue=₹${settings.minOrderValue}`);

  let bought = 0;
  let skipped = 0;

  cards.forEach(card => {
    const match = card.id.match(/^list(\d+)$/);
    if (!match) return;
    const n = match[1];
    const data = extractCardData(card, n);

    log(`  Card ${data.cardId}: state="${data.state}" duration="${data.durationText}" qty=${data.quantity} value=₹${data.orderValue} btnFound=${!!data.ctaBtn}`);

    if (matchesCriteria(data, settings)) {
      if (data.ctaBtn) {
        log(`  BUY ${data.cardId} — clicking CTA button`);
        data.ctaBtn.click();
        bought++;
      } else {
        warn(`  MATCH ${data.cardId} — criteria met but CTA button not found in DOM`);
      }
      onLeadBought({
        cardId: data.cardId,
        state: data.state,
        quantity: data.quantity,
        orderValue: data.orderValue,
        durationMinutes: parseDurationToMinutes(data.durationText),
        timestamp: Date.now(),
      });
    } else {
      skipped++;
    }
  });

  log(`Cycle complete — bought: ${bought}, skipped: ${skipped}, total: ${cards.length}`);
}

function waitForListing(settings, timeout = 10000) {
  return new Promise((resolve) => {
    if (document.getElementById('bl_listing')) {
      log('Listing (#bl_listing) already in DOM');
      resolve();
      return;
    }
    log('Waiting for #bl_listing to appear in DOM...');
    const interval = setInterval(() => {
      if (document.getElementById('bl_listing')) {
        clearInterval(interval);
        log('#bl_listing found');
        resolve();
      }
    }, 500);
    setTimeout(() => {
      clearInterval(interval);
      warn('#bl_listing not found within timeout — proceeding anyway');
      resolve();
    }, timeout);
  });
}

if (typeof module !== 'undefined') {
  module.exports = { parseDurationToMinutes, parseOrderValue, parseQuantity, extractCardData, matchesCriteria };
}

let originalTitle = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK') {
    log('CHECK received — tab visibility:', document.visibilityState);
    waitForListing(message.settings).then(() => {
      processCards(message.settings);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'UPDATE_TITLE') {
    if (originalTitle === null) originalTitle = document.title;
    if (message.remaining === null) {
      document.title = originalTitle;
      originalTitle = null;
    } else {
      document.title = `[${message.remaining}s] ${originalTitle}`;
    }
    sendResponse({ ok: true });
  }
});
