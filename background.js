const ALARM_NAME = 'lead-refresh';
const TICK_ALARM = 'tick';

const DEFAULTS = {
  refreshInterval: 15,
  minTimePassed: 10,
  minOrderQty: 100,
  minOrderValue: 20000,
};

let tickInterval = null;
let secondsRemaining = 0;

async function getState() {
  const data = await chrome.storage.local.get(['running', 'settings', 'secondsRemaining']);
  return {
    running: data.running || false,
    settings: { ...DEFAULTS, ...(data.settings || {}) },
    secondsRemaining: data.secondsRemaining || 0,
  };
}

async function broadcastTick(seconds) {
  await chrome.storage.local.set({ secondsRemaining: seconds });
  const views = chrome.extension.getViews({ type: 'popup' });
  views.forEach(view => {
    if (view.onTick) view.onTick(seconds);
  });
}

async function startCycle(settings) {
  secondsRemaining = settings.refreshInterval;
  await chrome.storage.local.set({ running: true, settings, secondsRemaining });
  await broadcastTick(secondsRemaining);

  chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 / 60 }); // fires every ~1 sec
}

async function stopCycle() {
  await chrome.storage.local.set({ running: false, secondsRemaining: 0 });
  chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.clear(TICK_ALARM);
  await broadcastTick(0);
}

async function refreshAndCheck(settings) {
  const tabs = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
  if (tabs.length === 0) return;

  const tab = tabs[0];

  // Reload tab and wait for complete, then send CHECK
  chrome.tabs.reload(tab.id);

  const onUpdated = (tabId, changeInfo) => {
    if (tabId === tab.id && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      // Small delay to let page JS render the listing
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'CHECK', settings });
      }, 1500);
    }
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const { running, settings } = await getState();
  if (!running) return;

  if (alarm.name === TICK_ALARM) {
    secondsRemaining = Math.max(0, secondsRemaining - 1);
    await broadcastTick(secondsRemaining);
    return;
  }

  if (alarm.name === ALARM_NAME) {
    await refreshAndCheck(settings);
    // Restart cycle
    secondsRemaining = settings.refreshInterval;
    await broadcastTick(secondsRemaining);
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
  }
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
      // No-op for now; payload available in message.payload
      sendResponse({ ok: true });
    }
  })();
  return true; // keep message channel open for async response
});

// On service worker start, resume tick if was running
chrome.runtime.onStartup.addListener(async () => {
  const { running, settings } = await getState();
  if (running) {
    await startCycle(settings);
  }
});
