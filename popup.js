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

function populateForm(settings) {
  document.getElementById('refreshInterval').value = settings.refreshInterval;
  document.getElementById('minTimePassed').value = settings.minTimePassed;
  document.getElementById('minOrderQty').value = settings.minOrderQty;
  document.getElementById('minOrderValue').value = settings.minOrderValue;
}

function setRunningUI(running) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const timerBox = document.getElementById('timerBox');

  dot.className = 'status-dot ' + (running ? 'running' : '');
  text.textContent = running ? 'Running' : 'Stopped';
  btnStart.disabled = running;
  btnStop.disabled = !running;
  timerBox.className = 'timer-box ' + (running ? 'active' : '');
}

function updateTimer(seconds) {
  const el = document.getElementById('timerValue');
  el.textContent = seconds > 0 ? seconds : '--';
}

// Called by background service worker via direct reference
window.onTick = function(seconds) {
  updateTimer(seconds);
};

async function sendToBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

async function init() {
  const settings = loadSettings();
  populateForm(settings);

  // Sync state from background
  const state = await sendToBackground({ type: 'GET_STATE' });
  if (state) {
    setRunningUI(state.running);
    updateTimer(state.secondsRemaining || 0);
    if (state.settings) populateForm({ ...settings, ...state.settings });
  }

  document.getElementById('btnStart').addEventListener('click', async () => {
    const settings = readFormSettings();
    saveSettings(settings);
    await sendToBackground({ type: 'START', settings });
    setRunningUI(true);
    updateTimer(settings.refreshInterval);
  });

  document.getElementById('btnStop').addEventListener('click', async () => {
    await sendToBackground({ type: 'STOP' });
    setRunningUI(false);
    updateTimer(0);
  });

  // Auto-save settings on change
  ['refreshInterval', 'minTimePassed', 'minOrderQty', 'minOrderValue'].forEach(id => {
    document.getElementById(id).addEventListener('change', async () => {
      const settings = readFormSettings();
      saveSettings(settings);
      await sendToBackground({ type: 'SAVE_SETTINGS', settings });
    });
  });

  // Poll for tick updates (fallback since getViews may not always work)
  setInterval(async () => {
    const state = await sendToBackground({ type: 'GET_STATE' });
    if (state) {
      setRunningUI(state.running);
      updateTimer(state.secondsRemaining || 0);
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
