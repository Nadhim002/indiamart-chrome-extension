# IndiaMART Lead Buyer Chrome Extension — Implementation Plan

## Context
Building a Chrome extension from scratch (repo was wiped clean in "fresh start" commit). Only `specs.md` and `sample.html` exist. The extension automates buying leads on seller.indiamart.com by scraping card data, evaluating it against user-defined criteria, and clicking the CTA button for matching leads on a timed refresh cycle.

---

## Files to Create

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 extension config |
| `background.js` | Timer via `chrome.alarms`, refresh orchestration |
| `content.js` | DOM scraping, criteria matching, CTA click |
| `popup.html` | Settings form + start/stop + countdown UI |
| `popup.js` | Popup logic, settings persistence, timer display |
| `popup.css` | Minimal styling |

---

## DOM Selectors (from sample.html)

Card container: `#bl_listing` → children with id `list{n}` (n = 1, 2, 3…)

Per card `list{n}`:
- **State/Location**: `#card_state_{n}` → `.value` (e.g., `"Tamil Nadu"`)
- **Time posted**: first `.lstNwLftLoc p strong` text node inside card (e.g., `"0 sec"`, `"7 mins"`)
- **Quantity**: `<table>` row where first `<td>` text = `"Quantity"` → `<b>` text (e.g., `"100 Piece"`)
- **Order Value**: `<table>` row where first `<td>` text = `"Probable Order Value"` → `<b>` text (e.g., `"Rs. 40,000 - 48,000"`)
- **CTA button**: `.Slid_CTA .btnCBN` inside card → `.click()`

---

## Data Normalization Rules

### Duration → minutes
| Input | Minutes |
|-------|---------|
| "X sec" / "X secs" | 0 |
| "X min" / "X mins" | X |
| "X hr" / "X hrs" | X × 60 |
| "X Day Old" / "X Days Old" | X × 1440 |
| "Yesterday" | 1440 |

### Order Value → Rs (lower bound)
- Strip "Rs.", commas, whitespace
- Split on " - " or " to "
- Take the **first (lower) value**
- If value contains "Lakh" → multiply by 100,000

### Quantity → integer
- Strip non-numeric suffix (e.g., "100 Piece" → 100)

---

## Lead Buying Criteria (all three must be true)
1. `duration_minutes < user.minTimePassed`
2. `quantity >= user.minOrderQty` **OR** `orderValue >= user.minOrderValue`
3. `state` contains one of: `["Tamil Nadu", "Karnataka", "Andhra", "Kerala"]` (case-insensitive)

Buy **all** matching leads per cycle.

---

## Architecture

### background.js
- Uses `chrome.alarms` API (reliable in MV3 service workers)
- State stored in `chrome.storage.local`: `{ running, settings }`
- On alarm fire: reload the active IndiaMART tab → send "check" message to content script after tab load
- Listen for popup messages: `START`, `STOP`, `SAVE_SETTINGS`
- Send `TICK` messages to popup with seconds remaining

### content.js
- Injected on `https://seller.indiamart.com/*`
- On message `"CHECK"` from background:
  - Poll for `#bl_listing` (up to 10s, 500ms interval)
  - Once found, enumerate all `list{n}` cards
  - Extract + normalize data for each card
  - Evaluate criteria, click CTA on matches
  - Call `onLeadBought(payload)` stub for each purchase

### popup.js
- On load: read settings from `localStorage`, populate form
- On settings change: save to `localStorage`, send to background
- Start/Stop buttons: send `START`/`STOP` to background
- Listen for `TICK` messages from background → update countdown display

---

## User Settings (localStorage keys + defaults)
| Key | Default | Unit |
|-----|---------|------|
| `refreshInterval` | 15 | seconds |
| `minTimePassed` | 10 | minutes |
| `minOrderQty` | 100 | pieces |
| `minOrderValue` | 20000 | Rs |

---

## Popup UI Layout
```
┌─────────────────────────────┐
│  IndiaMART Lead Buyer        │
│  ⏱ Next refresh in: 12s     │  ← countdown
├─────────────────────────────┤
│  Refresh Interval (sec): [15]│
│  Min Time Passed (min): [10] │
│  Min Order Qty (pcs): [100]  │
│  Min Order Value (Rs): [20000│
├─────────────────────────────┤
│      [START]   [STOP]        │
│  Status: Running             │
└─────────────────────────────┘
```

---

## `onLeadBought` Stub
```js
function onLeadBought(leadPayload) {
  // Future: send notification, log, etc.
}
```
Called with payload: `{ cardId, state, quantity, orderValue, durationMinutes, timestamp }`

---

## Verification
1. Load extension via `chrome://extensions` → "Load unpacked" on this directory
2. Navigate to `https://seller.indiamart.com/bltxn/buyleads/`
3. Open popup → enter settings → click Start
4. Verify countdown timer ticks down
5. On refresh, open DevTools console → confirm content script logs card data
6. Confirm `.btnCBN.click()` is called only on matching cards
7. Click Stop → confirm cycle halts
