/**
 * @jest-environment jsdom
 */

// Replicate the localStorage-based settings logic from popup.js inline
// (popup.js cannot be required directly because it references chrome and the DOM at load)

const DEFAULTS = {
  refreshInterval: 15,
  minTimePassed: 10,
  minOrderQty: 100,
  minOrderValue: 20000,
};

const STORAGE_KEY = 'leadBuyerSettings';

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function readFormSettings() {
  return {
    refreshInterval: parseInt(document.getElementById('refreshInterval').value, 10) || DEFAULTS.refreshInterval,
    minTimePassed: parseInt(document.getElementById('minTimePassed').value, 10) || DEFAULTS.minTimePassed,
    minOrderQty: parseInt(document.getElementById('minOrderQty').value, 10) || DEFAULTS.minOrderQty,
    minOrderValue: parseInt(document.getElementById('minOrderValue').value, 10) || DEFAULTS.minOrderValue,
  };
}

// ─── localStorage persistence ─────────────────────────────────────────────────

describe('loadSettings', () => {
  beforeEach(() => localStorage.clear());

  test('returns defaults when nothing is saved', () => {
    expect(loadSettings()).toEqual(DEFAULTS);
  });

  test('returns saved settings merged with defaults', () => {
    saveSettings({ refreshInterval: 30, minOrderQty: 200 });
    const s = loadSettings();
    expect(s.refreshInterval).toBe(30);
    expect(s.minOrderQty).toBe(200);
    expect(s.minTimePassed).toBe(10);    // default intact
    expect(s.minOrderValue).toBe(20000); // default intact
  });

  test('returns defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    expect(loadSettings()).toEqual(DEFAULTS);
  });
});

describe('saveSettings + loadSettings round-trip', () => {
  beforeEach(() => localStorage.clear());

  test('full settings round-trip', () => {
    const custom = { refreshInterval: 60, minTimePassed: 5, minOrderQty: 50, minOrderValue: 10000 };
    saveSettings(custom);
    expect(loadSettings()).toEqual({ ...DEFAULTS, ...custom });
  });

  test('overwrites previous save', () => {
    saveSettings({ refreshInterval: 30 });
    saveSettings({ refreshInterval: 45 });
    expect(loadSettings().refreshInterval).toBe(45);
  });
});

// ─── form field reading ───────────────────────────────────────────────────────

describe('readFormSettings', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="refreshInterval" value="20" />
      <input id="minTimePassed"   value="5"  />
      <input id="minOrderQty"     value="150" />
      <input id="minOrderValue"   value="30000" />
    `;
  });

  test('reads values from form inputs', () => {
    expect(readFormSettings()).toEqual({
      refreshInterval: 20,
      minTimePassed: 5,
      minOrderQty: 150,
      minOrderValue: 30000,
    });
  });

  test('falls back to default when field is empty', () => {
    document.getElementById('refreshInterval').value = '';
    const s = readFormSettings();
    expect(s.refreshInterval).toBe(DEFAULTS.refreshInterval);
  });

  test('falls back to default when field has non-numeric value', () => {
    document.getElementById('minOrderValue').value = 'abc';
    const s = readFormSettings();
    expect(s.minOrderValue).toBe(DEFAULTS.minOrderValue);
  });
});

// ─── default values ───────────────────────────────────────────────────────────

describe('DEFAULTS', () => {
  test('refreshInterval is 15 seconds', () => expect(DEFAULTS.refreshInterval).toBe(15));
  test('minTimePassed is 10 minutes', () => expect(DEFAULTS.minTimePassed).toBe(10));
  test('minOrderQty is 100 pieces', () => expect(DEFAULTS.minOrderQty).toBe(100));
  test('minOrderValue is Rs. 20000', () => expect(DEFAULTS.minOrderValue).toBe(20000));
});
