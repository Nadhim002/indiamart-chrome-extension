/**
 * @jest-environment jsdom
 */

// Mock chrome so content.js doesn't crash on require
global.chrome = {
  runtime: { onMessage: { addListener: jest.fn() } },
};

const {
  parseDurationToMinutes,
  parseOrderValue,
  parseQuantity,
  extractCardData,
  matchesCriteria,
} = require('../content');

// ─── parseDurationToMinutes ───────────────────────────────────────────────────

describe('parseDurationToMinutes', () => {
  test.each([
    ['0 sec', 0],
    ['1 sec', 0],
    ['15 secs', 0],
    ['1 min', 1],
    ['7 mins', 7],
    ['1 hr', 60],
    ['2 hrs', 120],
    ['1 Day Old', 1440],
    ['3 Days Old', 4320],
    ['Yesterday', 1440],
    ['yesterday', 1440],   // case-insensitive
  ])('"%s" → %d minutes', (input, expected) => {
    expect(parseDurationToMinutes(input)).toBe(expected);
  });
});

// ─── parseOrderValue ──────────────────────────────────────────────────────────

describe('parseOrderValue', () => {
  test.each([
    ['Rs. 40,000 - 48,000', 40000],
    ['Rs. 20,000 to 50,000', 20000],
    ['Rs. 1 to 2 Lakh', 100000],
    ['Rs. 1 Lakh to 5 Lakh', 100000],
    ['Rs. 5,000 - 10,000', 5000],
    ['Rs. 2 to 3 Lakh', 200000],
  ])('"%s" → %d Rs', (input, expected) => {
    expect(parseOrderValue(input)).toBe(expected);
  });
});

// ─── parseQuantity ────────────────────────────────────────────────────────────

describe('parseQuantity', () => {
  test.each([
    ['100 Piece', 100],
    ['30 Piece', 30],
    ['1,000 Piece', 1000],
    ['50 Units', 50],
    ['200', 200],
  ])('"%s" → %d', (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });
});

// ─── matchesCriteria ──────────────────────────────────────────────────────────

describe('matchesCriteria', () => {
  const settings = {
    minTimePassed: 10,
    minOrderQty: 100,
    minOrderValue: 20000,
  };

  test('passes when all criteria met', () => {
    const data = { durationText: '5 mins', quantity: 100, orderValue: 40000, state: 'Tamil Nadu' };
    expect(matchesCriteria(data, settings)).toBe(true);
  });

  test('fails when lead is too old', () => {
    const data = { durationText: '15 mins', quantity: 100, orderValue: 40000, state: 'Tamil Nadu' };
    expect(matchesCriteria(data, settings)).toBe(false);
  });

  test('passes when quantity low but order value high enough', () => {
    const data = { durationText: '2 mins', quantity: 10, orderValue: 25000, state: 'Karnataka' };
    expect(matchesCriteria(data, settings)).toBe(true);
  });

  test('passes when order value low but quantity high enough', () => {
    const data = { durationText: '2 mins', quantity: 200, orderValue: 1000, state: 'Kerala' };
    expect(matchesCriteria(data, settings)).toBe(true);
  });

  test('fails when both quantity and order value too low', () => {
    const data = { durationText: '2 mins', quantity: 10, orderValue: 5000, state: 'Tamil Nadu' };
    expect(matchesCriteria(data, settings)).toBe(false);
  });

  test('fails when location is not in allowed list', () => {
    const data = { durationText: '2 mins', quantity: 200, orderValue: 40000, state: 'Maharashtra' };
    expect(matchesCriteria(data, settings)).toBe(false);
  });

  test('passes with Andhra Pradesh location', () => {
    const data = { durationText: '0 sec', quantity: 100, orderValue: 20000, state: 'Andhra Pradesh' };
    expect(matchesCriteria(data, settings)).toBe(true);
  });

  test('passes with Yesterday duration (1440 min) when threshold is high enough', () => {
    const looseSettings = { ...settings, minTimePassed: 2000 };
    const data = { durationText: 'Yesterday', quantity: 100, orderValue: 40000, state: 'Tamil Nadu' };
    expect(matchesCriteria(data, looseSettings)).toBe(true);
  });

  test('fails with Yesterday duration against default 10-min threshold', () => {
    const data = { durationText: 'Yesterday', quantity: 100, orderValue: 40000, state: 'Tamil Nadu' };
    expect(matchesCriteria(data, settings)).toBe(false);
  });

  test('location match is case-insensitive', () => {
    const data = { durationText: '1 min', quantity: 100, orderValue: 20000, state: 'tamil nadu' };
    expect(matchesCriteria(data, settings)).toBe(true);
  });
});

// ─── extractCardData ──────────────────────────────────────────────────────────

describe('extractCardData', () => {
  function buildCard(n, { state = 'Tamil Nadu', duration = '5 mins', qty = '100 Piece', orderVal = 'Rs. 40,000 - 48,000' } = {}) {
    const div = document.createElement('div');
    div.id = `list${n}`;
    div.innerHTML = `
      <input type="hidden" id="card_state_${n}" value="${state}" />
      <div class="lstNwLftLoc">
        <p><strong>${duration}</strong></p>
      </div>
      <table>
        <tr><td>Quantity</td><td>: <b>${qty}</b></td></tr>
        <tr><td>Probable Order Value</td><td>: <b>${orderVal}</b></td></tr>
      </table>
      <div class="Slid_CTA">
        <div class="btnCBN btnCBN${n}">Contact Buyer Now</div>
      </div>
    `;
    return div;
  }

  test('extracts state correctly', () => {
    const card = buildCard(1, { state: 'Tamil Nadu' });
    const data = extractCardData(card, '1');
    expect(data.state).toBe('Tamil Nadu');
  });

  test('extracts duration text', () => {
    const card = buildCard(1, { duration: '7 mins' });
    const data = extractCardData(card, '1');
    expect(data.durationText).toBe('7 mins');
  });

  test('extracts quantity', () => {
    const card = buildCard(1, { qty: '100 Piece' });
    const data = extractCardData(card, '1');
    expect(data.quantity).toBe(100);
  });

  test('extracts order value (range)', () => {
    const card = buildCard(1, { orderVal: 'Rs. 40,000 - 48,000' });
    const data = extractCardData(card, '1');
    expect(data.orderValue).toBe(40000);
  });

  test('extracts order value (lakh range)', () => {
    const card = buildCard(1, { orderVal: 'Rs. 1 to 2 Lakh' });
    const data = extractCardData(card, '1');
    expect(data.orderValue).toBe(100000);
  });

  test('finds CTA button', () => {
    const card = buildCard(1);
    const data = extractCardData(card, '1');
    expect(data.ctaBtn).not.toBeNull();
    expect(data.ctaBtn.className).toContain('btnCBN');
  });

  test('returns cardId correctly', () => {
    const card = buildCard(3);
    const data = extractCardData(card, '3');
    expect(data.cardId).toBe('list3');
  });

  test('handles missing state gracefully', () => {
    const div = document.createElement('div');
    div.id = 'list1';
    div.innerHTML = '<table></table>';
    const data = extractCardData(div, '1');
    expect(data.state).toBe('');
    expect(data.quantity).toBe(0);
    expect(data.orderValue).toBe(0);
    expect(data.ctaBtn).toBeNull();
  });
});
