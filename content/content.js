(function () {
  const STORAGE_KEYS = {
    intervalSec: 'indiamart_interval_sec',
    criteriaTime: 'indiamart_criteria_time',
    criteriaQty: 'indiamart_criteria_qty',
    criteriaQtyOp: 'indiamart_criteria_qty_op',
    criteriaOrderValue: 'indiamart_criteria_order_value',
    running: 'indiamart_running',
    nextRefreshAt: 'indiamart_next_refresh_at',
  };

  let refreshTimeoutId = null;

  function parseTimeToSeconds(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();
    let total = 0;
    const minMatch = s.match(/(\d+)\s*min/);
    const secMatch = s.match(/(\d+)\s*sec/);
    if (minMatch) total += parseInt(minMatch[1], 10) * 60;
    if (secMatch) total += parseInt(secMatch[1], 10);
    if (total === 0 && !minMatch && !secMatch) {
      const num = parseInt(s.replace(/\D/g, ''), 10);
      if (!isNaN(num)) total = num;
    }
    return total;
  }

  function parseQuantity(str) {
    if (!str || typeof str !== 'string') return null;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  function parseOrderValue(str) {
    if (!str || typeof str !== 'string') return { min: null, max: null };
    const cleaned = str.replace(/Rs\.?/gi, '').replace(/,/g, '').trim();
    const parts = cleaned.split(/\s*-\s*/).map((p) => parseInt(p.trim().replace(/,/g, ''), 10)).filter((n) => !isNaN(n));
    if (parts.length >= 2) return { min: parts[0], max: parts[1] };
    if (parts.length === 1) return { min: parts[0], max: parts[0] };
    return { min: null, max: null };
  }

  function parseUserTimeInput(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();
    const asSeconds = parseTimeToSeconds(s);
    if (asSeconds !== null) return asSeconds;
    const num = parseInt(s, 10);
    return isNaN(num) ? null : num;
  }

  function getCard() {
    return document.getElementById('list_1') || document.getElementById('list1');
  }

  function extractTimePassed(card) {
    const firstLoc = card.querySelector('.lstNwLftLoc');
    if (!firstLoc) return null;
    const strong = firstLoc.querySelector('p strong');
    return strong ? strong.textContent.trim() : null;
  }

  function extractQuantity(card) {
    const rows = card.querySelectorAll('table tbody tr');
    for (const row of rows) {
      const tds = row.querySelectorAll('td');
      if (tds.length >= 2 && tds[0].textContent.trim() === 'Quantity') {
        const b = tds[1].querySelector('b');
        return b ? b.textContent.trim() : null;
      }
    }
    return null;
  }

  function extractOrderValue(card) {
    const rows = card.querySelectorAll('table tbody tr');
    for (const row of rows) {
      const tds = row.querySelectorAll('td');
      if (tds.length >= 2 && tds[0].textContent.trim() === 'Probable Order Value') {
        const b = tds[1].querySelector('b');
        return b ? b.textContent.trim() : null;
      }
    }
    return null;
  }

  function findContactBuyerButton(card) {
    const cta = card.querySelector('.Slid_CTA .btnCBN');
    if (cta) return cta;
    const spans = card.querySelectorAll('span');
    for (const span of spans) {
      if (span.textContent.trim() === 'Contact Buyer Now') {
        return span.closest('.btnCBN') || span.parentElement;
      }
    }
    return null;
  }

  function checkCriteria(extracted, criteria) {
    // Pass only when order time passed (from HTML) is less than the user's max time
    if (criteria.maxTimeSeconds != null) {
      const leadSeconds = parseTimeToSeconds(extracted.timePassedRaw);
      if (leadSeconds == null || leadSeconds >= criteria.maxTimeSeconds) return false;
    }
    if (criteria.qtyValue != null && criteria.qtyOp) {
      const qty = parseQuantity(extracted.quantityRaw);
      if (qty == null) return false;
      if (criteria.qtyOp === 'at_least' && qty < criteria.qtyValue) return false;
      if (criteria.qtyOp === 'exactly' && qty !== criteria.qtyValue) return false;
      if (criteria.qtyOp === 'at_most' && qty > criteria.qtyValue) return false;
    }
    if (criteria.minOrderValue != null) {
      const ov = parseOrderValue(extracted.orderValueRaw);
      const minVal = ov.min != null ? ov.min : ov.max;
      if (minVal == null || minVal < criteria.minOrderValue) return false;
    }
    return true;
  }

  function onCriteriaMatched(extractedData) {
    // Placeholder: implement when user specifies what to do (e.g. notification, analytics, open URL).
  }

  function runCycle(settings) {
    const card = getCard();
    if (!card) {
      scheduleRefresh(settings);
      return;
    }

    const timePassedRaw = extractTimePassed(card);
    const quantityRaw = extractQuantity(card);
    const orderValueRaw = extractOrderValue(card);

    const extracted = {
      timePassedRaw: timePassedRaw || '',
      quantityRaw: quantityRaw || '',
      orderValueRaw: orderValueRaw || '',
    };

    const criteria = {
      maxTimeSeconds: parseUserTimeInput(settings.criteriaTime) ?? null,
      qtyValue: settings.criteriaQty ? parseInt(settings.criteriaQty, 10) : null,
      qtyOp: settings.criteriaQtyOp || null,
      minOrderValue: settings.criteriaOrderValue ? parseInt(settings.criteriaOrderValue.replace(/,/g, ''), 10) : null,
    };
    if (criteria.qtyValue != null && isNaN(criteria.qtyValue)) criteria.qtyValue = null;
    if (criteria.minOrderValue != null && isNaN(criteria.minOrderValue)) criteria.minOrderValue = null;

    const passed = checkCriteria(extracted, criteria);

    if (passed) {
      const btn = findContactBuyerButton(card);
      if (btn) {
        btn.click();
        onCriteriaMatched(extracted);
      }
    }

    scheduleRefresh(settings);
  }

  function scheduleRefresh(settings) {
    if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
    const intervalMs = Math.max(1000, (settings.intervalSec || 10) * 1000);
    const nextRefreshAt = Date.now() + intervalMs;
    chrome.storage.local.set({ [STORAGE_KEYS.nextRefreshAt]: nextRefreshAt });
    refreshTimeoutId = setTimeout(() => {
      refreshTimeoutId = null;
      location.reload();
    }, intervalMs);
  }

  function stopRefresh() {
    if (refreshTimeoutId) {
      clearTimeout(refreshTimeoutId);
      refreshTimeoutId = null;
    }
    chrome.storage.local.remove(STORAGE_KEYS.nextRefreshAt);
  }

  function init() {
    chrome.storage.local.get(
      [
        STORAGE_KEYS.intervalSec,
        STORAGE_KEYS.criteriaTime,
        STORAGE_KEYS.criteriaQty,
        STORAGE_KEYS.criteriaQtyOp,
        STORAGE_KEYS.criteriaOrderValue,
        STORAGE_KEYS.running,
      ],
      (data) => {
        const running = data[STORAGE_KEYS.running];
        if (!running) return;

        const settings = {
          intervalSec: data[STORAGE_KEYS.intervalSec] ?? 10,
          criteriaTime: data[STORAGE_KEYS.criteriaTime] || '',
          criteriaQty: data[STORAGE_KEYS.criteriaQty] || '',
          criteriaQtyOp: data[STORAGE_KEYS.criteriaQtyOp] || '',
          criteriaOrderValue: data[STORAGE_KEYS.criteriaOrderValue] || '',
        };

        function runWhenReady() {
          runCycle(settings);
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', runWhenReady);
        } else {
          setTimeout(runWhenReady, 300);
        }
      }
    );
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'start') {
      stopRefresh();
      chrome.storage.local.get(
        [
          STORAGE_KEYS.intervalSec,
          STORAGE_KEYS.criteriaTime,
          STORAGE_KEYS.criteriaQty,
          STORAGE_KEYS.criteriaQtyOp,
          STORAGE_KEYS.criteriaOrderValue,
        ],
        (data) => {
          const settings = {
            intervalSec: data[STORAGE_KEYS.intervalSec] ?? 10,
            criteriaTime: data[STORAGE_KEYS.criteriaTime] || '',
            criteriaQty: data[STORAGE_KEYS.criteriaQty] || '',
            criteriaQtyOp: data[STORAGE_KEYS.criteriaQtyOp] || '',
            criteriaOrderValue: data[STORAGE_KEYS.criteriaOrderValue] || '',
          };
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => runCycle(settings));
          } else {
            runCycle(settings);
          }
          sendResponse({ ok: true });
        }
      );
      return true;
    }
    if (msg.action === 'stop') {
      stopRefresh();
      sendResponse({ ok: true });
    }
  });

  init();
})();
