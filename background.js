const ALARM_NAME = 'lead-refresh';

const DEFAULTS = {
  refreshInterval: 15,
  minTimePassed: 10,
  minOrderQty: 100,
  minOrderValue: 20000,
};

function log(...args) {
  console.log('[LB:bg]', new Date().toLocaleTimeString(), ...args);
}
function warn(...args) {
  console.warn('[LB:bg]', new Date().toLocaleTimeString(), ...args);
}
function error(...args) {
  console.error('[LB:bg]', new Date().toLocaleTimeString(), ...args);
}

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
  log('Creating offscreen document for ticker');
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Keep timer alive for badge and tab title updates',
  });
}

async function closeOffscreen() {
  if (await chrome.offscreen.hasDocument()) {
    log('Closing offscreen document');
    await chrome.offscreen.closeDocument();
  }
}

async function startCycle(settings) {
  log('Starting cycle with settings:', settings);
  const cycleStartTime = Date.now();
  await chrome.storage.local.set({ running: true, settings, cycleStartTime });
  chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
  setBadge(settings.refreshInterval);
  await createOffscreen();
  log(`Cycle started — next refresh in ${settings.refreshInterval}s`);
}

async function stopCycle(reason = 'user request') {
  log('Stopping cycle — reason:', reason);
  await chrome.storage.local.set({ running: false, cycleStartTime: null });
  chrome.alarms.clear(ALARM_NAME);
  setBadge('');
  await updateTabTitle(null);
  await closeOffscreen();
  log('Cycle stopped');
}

async function refreshAndCheck(settings) {
  log('Refresh triggered — looking for IndiaMART tab');
  const tabs = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });

  if (tabs.length === 0) {
    warn('No IndiaMART tab found — stopping cycle');
    await stopCycle('no IndiaMART tab');
    return;
  }

  const tab = tabs[0];
  log(`Found IndiaMART tab: id=${tab.id} title="${tab.title}"`);

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  log(`Current active tab: id=${activeTab?.id} title="${activeTab?.title}"`);

  log(`Reloading tab ${tab.id}`);
  chrome.tabs.reload(tab.id);

  const onUpdated = (tabId, changeInfo) => {
    if (tabId !== tab.id || changeInfo.status !== 'complete') return;
    chrome.tabs.onUpdated.removeListener(onUpdated);
    log(`Tab ${tab.id} finished loading — activating for click registration`);

    chrome.tabs.update(tab.id, { active: true }, () => {
      setTimeout(() => {
        log('Sending CHECK to content script');
        chrome.tabs.sendMessage(tab.id, { type: 'CHECK', settings }, (response) => {
          if (chrome.runtime.lastError) {
            error('Failed to send CHECK message:', chrome.runtime.lastError.message);
          } else {
            log('CHECK response from content script:', response);
          }
          if (activeTab && activeTab.id !== tab.id) {
            log(`Switching back to previous tab: id=${activeTab.id}`);
            chrome.tabs.update(activeTab.id, { active: true });
          }
        });
      }, 1500);
    });
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  log('Alarm fired:', alarm.name);

  const { running, settings } = await getState();
  if (!running) {
    warn('Alarm fired but cycle is not running — ignoring');
    return;
  }

  await refreshAndCheck(settings);
  await chrome.storage.local.set({ cycleStartTime: Date.now() });
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.refreshInterval / 60 });
  setBadge(settings.refreshInterval);
  log(`Next alarm scheduled in ${settings.refreshInterval}s`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const { running, settings } = await getState();

    if (message.type === 'START') {
      log('Received START message');
      const newSettings = { ...settings, ...(message.settings || {}) };
      await startCycle(newSettings);
      sendResponse({ ok: true });

    } else if (message.type === 'STOP') {
      log('Received STOP message');
      await stopCycle('user clicked Stop');
      sendResponse({ ok: true });

    } else if (message.type === 'SAVE_SETTINGS') {
      log('Received SAVE_SETTINGS:', message.settings);
      const newSettings = { ...settings, ...message.settings };
      await chrome.storage.local.set({ settings: newSettings });
      if (running) {
        log('Restarting cycle with new settings');
        await stopCycle('settings changed');
        await startCycle(newSettings);
      }
      sendResponse({ ok: true });

    } else if (message.type === 'GET_STATE') {
      const state = await getState();
      sendResponse(state);

    } else if (message.type === 'LEAD_BOUGHT') {
      log('Lead bought notification received');
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

chrome.tabs.onRemoved.addListener(async (tabId) => {
  log(`Tab closed: id=${tabId} — checking if IndiaMART tab remains`);
  const { running } = await getState();
  if (!running) return;
  const remaining = await chrome.tabs.query({ url: 'https://seller.indiamart.com/*' });
  if (remaining.length === 0) {
    warn('All IndiaMART tabs closed — stopping cycle');
    await stopCycle('IndiaMART tab closed');
  } else {
    log(`${remaining.length} IndiaMART tab(s) still open — cycle continues`);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  log('Browser started — checking saved state');
  const { running, settings } = await getState();
  if (running) {
    log('Resuming cycle from saved state');
    await startCycle(settings);
  } else {
    log('No active cycle to resume');
  }
});
