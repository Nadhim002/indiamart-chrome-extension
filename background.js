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

async function startCycle(settings) {
  const cycleStartTime = Date.now();
  await chrome.storage.local.set({ running: true, settings, cycleStartTime });
  chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
}

async function stopCycle() {
  await chrome.storage.local.set({ running: false, cycleStartTime: null });
  chrome.alarms.clear(ALARM_NAME);
}

async function refreshAndCheck(settings) {
  const tabs = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
  if (tabs.length === 0) return;

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
  // Reset cycle start time and schedule next alarm
  await chrome.storage.local.set({ cycleStartTime: Date.now() });
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
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
    }
  })();
  return true;
});

chrome.runtime.onStartup.addListener(async () => {
  const { running, settings } = await getState();
  if (running) await startCycle(settings);
});
