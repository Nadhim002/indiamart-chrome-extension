(function () {
  const DEFAULT_INTERVAL_SEC = 10;
  const STORAGE_KEYS = {
    intervalSec: "indiamart_interval_sec",
    criteriaTime: "indiamart_criteria_time",
    criteriaQty: "indiamart_criteria_qty",
    criteriaQtyOp: "indiamart_criteria_qty_op",
    criteriaOrderValue: "indiamart_criteria_order_value",
    running: "indiamart_running",
    nextRefreshAt: "indiamart_next_refresh_at",
  };

  const DEFAULT_CRITERIA_TIME_SEC = 15 * 60; // 15 min

  const el = {
    intervalMin: document.getElementById("intervalMin"),
    intervalSec: document.getElementById("intervalSec"),
    criteriaTimeMin: document.getElementById("criteriaTimeMin"),
    criteriaTimeSec: document.getElementById("criteriaTimeSec"),
    criteriaQty: document.getElementById("criteriaQty"),
    criteriaQtyOp: document.getElementById("criteriaQtyOp"),
    criteriaOrderValue: document.getElementById("criteriaOrderValue"),
    btnStart: document.getElementById("btnStart"),
    btnStop: document.getElementById("btnStop"),
    status: document.getElementById("status"),
    statusIndicator: document.getElementById("statusIndicator"),
    countdown: document.getElementById("countdown"),
    settingsIcon: document.getElementById("settingsIcon"),
  };

  let countdownTimerId = null;

  function formatCountdown(remainingSec) {
    if (remainingSec <= 0) return "Refreshing…";
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    return `Next refresh in ${m}:${String(s).padStart(2, "0")}`;
  }

  function updateCountdown() {
    chrome.storage.local.get(
      [STORAGE_KEYS.nextRefreshAt, STORAGE_KEYS.running],
      (data) => {
        const running = !!data[STORAGE_KEYS.running];
        const nextAt = data[STORAGE_KEYS.nextRefreshAt];
        el.statusIndicator.classList.toggle("running", running);
        el.countdown.classList.toggle("running", running);
        if (!running || nextAt == null) {
          el.countdown.textContent = "";
          return;
        }
        const remainingMs = nextAt - Date.now();
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        el.countdown.textContent = formatCountdown(remainingSec);
      }
    );
  }

  function startCountdownTicker() {
    updateCountdown();
    if (countdownTimerId) clearInterval(countdownTimerId);
    countdownTimerId = setInterval(updateCountdown, 1000);
  }

  function stopCountdownTicker() {
    if (countdownTimerId) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
  }

  function getTotalIntervalSeconds() {
    const min = parseInt(el.intervalMin.value, 10) || 0;
    const sec = parseInt(el.intervalSec.value, 10) ?? DEFAULT_INTERVAL_SEC;
    return min * 60 + Math.max(0, sec);
  }

  function getTotalCriteriaTimeSeconds() {
    const min = parseInt(el.criteriaTimeMin.value, 10) || 0;
    const sec = parseInt(el.criteriaTimeSec.value, 10) || 0;
    return min * 60 + Math.max(0, sec);
  }

  function loadSaved() {
    chrome.storage.local.get(
      [
        STORAGE_KEYS.intervalSec,
        STORAGE_KEYS.criteriaTime,
        STORAGE_KEYS.criteriaQty,
        STORAGE_KEYS.criteriaQtyOp,
        STORAGE_KEYS.criteriaOrderValue,
        STORAGE_KEYS.running,
      ],
      (data) => {
        if (data[STORAGE_KEYS.intervalSec] != null) {
          const total = data[STORAGE_KEYS.intervalSec];
          el.intervalMin.value = Math.floor(total / 60);
          el.intervalSec.value = total % 60;
        }
        if (data[STORAGE_KEYS.criteriaTime] != null) {
          const total = parseInt(data[STORAGE_KEYS.criteriaTime], 10);
          if (!isNaN(total) && total >= 0) {
            el.criteriaTimeMin.value = Math.floor(total / 60);
            el.criteriaTimeSec.value = total % 60;
          }
        }
        if (data[STORAGE_KEYS.criteriaQty] != null)
          el.criteriaQty.value = data[STORAGE_KEYS.criteriaQty];
        if (data[STORAGE_KEYS.criteriaQtyOp] != null)
          el.criteriaQtyOp.value = data[STORAGE_KEYS.criteriaQtyOp];
        if (data[STORAGE_KEYS.criteriaOrderValue] != null)
          el.criteriaOrderValue.value = data[STORAGE_KEYS.criteriaOrderValue];
        const running = !!data[STORAGE_KEYS.running];
        updateStatus(running);
        el.statusIndicator.classList.toggle("running", running);
        if (running) startCountdownTicker();
        else {
          stopCountdownTicker();
          el.countdown.textContent = "";
        }
      }
    );
  }

  function updateStatus(running) {
    el.status.textContent = running ? "Running" : "Stopped";
    el.status.classList.toggle("running", running);
  }

  function saveAndStart() {
    const intervalSec = getTotalIntervalSeconds();
    if (intervalSec <= 0) {
      el.status.textContent = "Set interval to at least 1 second";
      return;
    }

    const payload = {
      [STORAGE_KEYS.intervalSec]: intervalSec,
      [STORAGE_KEYS.criteriaTime]: (() => {
        const t = getTotalCriteriaTimeSeconds();
        return t > 0 ? String(t) : "";
      })(),
      [STORAGE_KEYS.criteriaQty]: (el.criteriaQty.value || "").trim(),
      [STORAGE_KEYS.criteriaQtyOp]: el.criteriaQtyOp.value,
      [STORAGE_KEYS.criteriaOrderValue]: (
        el.criteriaOrderValue.value || ""
      ).trim(),
      [STORAGE_KEYS.running]: true,
    };

    chrome.storage.local.set(payload, () => {
      updateStatus(true);
      el.statusIndicator.classList.add("running");
      startCountdownTicker();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id != null) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "start" }).catch(() => {
            el.status.textContent =
              "Open an Indiamart seller page and click Start again";
          });
        } else {
          el.status.textContent = "Open an Indiamart page, then click Start";
        }
      });
    });
  }

  function stop() {
    chrome.storage.local.set({ [STORAGE_KEYS.running]: false }, () => {
      updateStatus(false);
      el.statusIndicator.classList.remove("running");
      stopCountdownTicker();
      el.countdown.textContent = "";
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id != null) {
          chrome.tabs
            .sendMessage(tabs[0].id, { action: "stop" })
            .catch(() => {});
        }
      });
    });
  }

  el.btnStart.addEventListener("click", saveAndStart);
  el.btnStop.addEventListener("click", stop);
  el.settingsIcon.addEventListener("click", (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  loadSaved();

  // Clean up countdown timer when popup is closed
  window.addEventListener("unload", stopCountdownTicker);
})();
