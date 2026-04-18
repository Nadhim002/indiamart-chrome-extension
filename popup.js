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
  document.getElementById('statusDot').className = 'status-dot ' + (running ? 'running' : '');
  document.getElementById('statusText').textContent = running ? 'Running' : 'Stopped';
  document.getElementById('btnStart').disabled = running;
  document.getElementById('btnStop').disabled = !running;
  document.getElementById('timerBox').className = 'timer-box ' + (running ? 'active' : '');
}

function updateTimer(seconds) {
  document.getElementById('timerValue').textContent = seconds > 0 ? seconds : '--';
}

async function sendToBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

async function init() {
  const settings = loadSettings();
  populateForm(settings);

  // Sync initial state from background
  const state = await sendToBackground({ type: 'GET_STATE' });
  if (state) {
    setRunningUI(state.running);
    if (state.settings) populateForm({ ...settings, ...state.settings });
  }

  document.getElementById('btnStart').addEventListener('click', async () => {
    const s = readFormSettings();
    saveSettings(s);
    await sendToBackground({ type: 'START', settings: s });
    setRunningUI(true);
  });

  document.getElementById('btnStop').addEventListener('click', async () => {
    await sendToBackground({ type: 'STOP' });
    setRunningUI(false);
    updateTimer(0);
  });

  document.getElementById('btnReset').addEventListener('click', async () => {
    populateForm(DEFAULTS);
    saveSettings(DEFAULTS);
    await sendToBackground({ type: 'SAVE_SETTINGS', settings: DEFAULTS });
  });

  ['refreshInterval', 'minTimePassed', 'minOrderQty', 'minOrderValue'].forEach(id => {
    document.getElementById(id).addEventListener('change', async () => {
      const s = readFormSettings();
      saveSettings(s);
      await sendToBackground({ type: 'SAVE_SETTINGS', settings: s });
    });
  });

  // Compute countdown locally every second from cycleStartTime stored in background
  setInterval(async () => {
    const state = await sendToBackground({ type: 'GET_STATE' });
    if (!state) return;

    setRunningUI(state.running);

    if (state.running && state.cycleStartTime && state.settings) {
      const elapsed = Math.floor((Date.now() - state.cycleStartTime) / 1000);
      const remaining = Math.max(0, state.settings.refreshInterval - elapsed);
      updateTimer(remaining);
    } else if (!state.running) {
      updateTimer(0);
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
