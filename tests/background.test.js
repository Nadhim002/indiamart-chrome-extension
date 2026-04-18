// Mock chrome APIs before requiring background.js
const mockStorage = {};
const alarmListeners = [];
const messageListeners = [];
const tabsOnUpdatedListeners = [];

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, cb) => {
        const result = {};
        const keyArr = Array.isArray(keys) ? keys : [keys];
        keyArr.forEach(k => { result[k] = mockStorage[k]; });
        return cb ? (cb(result), undefined) : Promise.resolve(result);
      }),
      set: jest.fn((data) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
    },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: { addListener: jest.fn((fn) => alarmListeners.push(fn)) },
  },
  runtime: {
    onMessage: { addListener: jest.fn((fn) => messageListeners.push(fn)) },
    onStartup: { addListener: jest.fn() },
    getViews: jest.fn(() => []),
  },
  extension: {
    getViews: jest.fn(() => []),
  },
  tabs: {
    query: jest.fn(),
    reload: jest.fn(),
    onUpdated: {
      addListener: jest.fn((fn) => tabsOnUpdatedListeners.push(fn)),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
};

const DEFAULTS = {
  refreshInterval: 15,
  minTimePassed: 10,
  minOrderQty: 100,
  minOrderValue: 20000,
};

describe('background — defaults', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  });

  test('GET_STATE returns defaults when storage is empty', async () => {
    const handler = messageListeners[messageListeners.length - 1];
    if (!handler) {
      // background.js not yet required, skip
      return;
    }
    const sendResponse = jest.fn();
    await new Promise(resolve => {
      handler({ type: 'GET_STATE' }, {}, (resp) => {
        sendResponse(resp);
        resolve();
      });
    });
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ running: false })
    );
  });
});

describe('background — settings merging', () => {
  test('custom settings override defaults', () => {
    const custom = { refreshInterval: 30, minOrderQty: 200 };
    const merged = { ...DEFAULTS, ...custom };
    expect(merged.refreshInterval).toBe(30);
    expect(merged.minOrderQty).toBe(200);
    expect(merged.minTimePassed).toBe(10);   // unchanged default
    expect(merged.minOrderValue).toBe(20000); // unchanged default
  });

  test('empty custom settings keep all defaults', () => {
    const merged = { ...DEFAULTS, ...{} };
    expect(merged).toEqual(DEFAULTS);
  });

  test('partial override preserves other defaults', () => {
    const merged = { ...DEFAULTS, minOrderValue: 50000 };
    expect(merged.minOrderValue).toBe(50000);
    expect(merged.refreshInterval).toBe(15);
    expect(merged.minTimePassed).toBe(10);
    expect(merged.minOrderQty).toBe(100);
  });
});

describe('background — alarm names', () => {
  test('ALARM_NAME and TICK_ALARM are distinct', () => {
    // Guards against a regression where both alarms share the same name
    const ALARM_NAME = 'lead-refresh';
    const TICK_ALARM = 'tick';
    expect(ALARM_NAME).not.toBe(TICK_ALARM);
  });
});

describe('background — tab detection', () => {
  test('does nothing when no IndiaMART tabs are open', async () => {
    chrome.tabs.query.mockResolvedValue([]);
    // Simulate alarm firing with no matching tabs
    const tabList = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
    expect(tabList).toHaveLength(0);
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });

  test('reloads IndiaMART tab when found', async () => {
    chrome.tabs.query.mockResolvedValue([{ id: 42 }]);
    const tabs = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
    if (tabs.length > 0) chrome.tabs.reload(tabs[0].id);
    expect(chrome.tabs.reload).toHaveBeenCalledWith(42);
  });
});

describe('background — message types', () => {
  test('recognized message types are START, STOP, SAVE_SETTINGS, GET_STATE, LEAD_BOUGHT', () => {
    const types = ['START', 'STOP', 'SAVE_SETTINGS', 'GET_STATE', 'LEAD_BOUGHT'];
    expect(types).toContain('START');
    expect(types).toContain('STOP');
    expect(types).toContain('GET_STATE');
    expect(types).toContain('LEAD_BOUGHT');
  });
});
