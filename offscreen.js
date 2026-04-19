setInterval(() => {
  chrome.runtime.sendMessage({ type: 'TICK' });
}, 1000);
