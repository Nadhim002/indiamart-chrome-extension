const ALARM_NAME = 'lead-refresh';

const DEFAULTS = {
  refreshInterval: 15,
  minTimePassed: 10,
  minOrderQty: 100,
  minOrderValue: 20000,
};

async function getState() {
  const data = await chrome.storage.local.get(['running', 'settings', 'cycleStartTime']);
  return {
    running: data.running || false,
    settings: { ...DEFAULTS, ...(data.settings || {}) },
    cycleStartTime: data.cycleStartTime || null,
  };
}

function setBadge(text, color = '#2e7d32') {
  chrome.action.setBadgeText({ text: text ? String(text) : '' });
  if (text) chrome.action.setBadgeBackgroundColor({ color });
}

async function updateTabTitle(remaining) {
  const tabs = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
  if (tabs.length === 0) return;
  chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_TITLE', remaining });
}

async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Keep timer alive for badge and tab title updates',
  });
}

async function closeOffscreen() {
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

async function startCycle(settings) {
  const cycleStartTime = Date.now();
  await chrome.storage.local.set({ running: true, settings, cycleStartTime });
  chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
  setBadge(settings.refreshInterval);
  await createOffscreen();
}

async function stopCycle() {
  await chrome.storage.local.set({ running: false, cycleStartTime: null });
  chrome.alarms.clear(ALARM_NAME);
  setBadge('');
  await updateTabTitle(null);
  await closeOffscreen();
}

async function refreshAndCheck(settings) {
  const tabs = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
  if (tabs.length === 0) {
    await stopCycle();
    return;
  }

  const tab = tabs[0];
  chrome.tabs.reload(tab.id);

  const onUpdated = (tabId, changeInfo) => {
    if (tabId === tab.id && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'CHECK', settings });
      }, 1500);
    }
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { running, settings } = await getState();
  if (!running) return;

  await refreshAndCheck(settings);
  await chrome.storage.local.set({ cycleStartTime: Date.now() });
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
  setBadge(settings.refreshInterval);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const { running, settings } = await getState();

    if (message.type === 'START') {
      const newSettings = { ...settings, ...(message.settings || {}) };
      await startCycle(newSettings);
      sendResponse({ ok: true });
    } else if (message.type === 'STOP') {
      await stopCycle();
      sendResponse({ ok: true });
    } else if (message.type === 'SAVE_SETTINGS') {
      const newSettings = { ...settings, ...message.settings };
      await chrome.storage.local.set({ settings: newSettings });
      if (running) {
        await stopCycle();
        await startCycle(newSettings);
      }
      sendResponse({ ok: true });
    } else if (message.type === 'GET_STATE') {
      const state = await getState();
      sendResponse(state);
    } else if (message.type === 'LEAD_BOUGHT') {
      sendResponse({ ok: true });
    } else if (message.type === 'TICK') {
      const state = await getState();
      if (!state.running || !state.cycleStartTime) return;
      const elapsed = Math.floor((Date.now() - state.cycleStartTime) / 1000);
      const remaining = Math.max(0, state.settings.refreshInterval - elapsed);
      setBadge(remaining);
      await updateTabTitle(remaining);
      sendResponse({ ok: true });
    }
  })();
  return true;
});

chrome.tabs.onRemoved.addListener(async () => {
  const { running } = await getState();
  if (!running) return;
  const remaining = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
  if (remaining.length === 0) await stopCycle();
});

chrome.runtime.onStartup.addListener(async () => {
  const { running, settings } = await getState();
  if (running) await startCycle(settings);
});
