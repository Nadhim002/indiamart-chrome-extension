// Background script for the extension
let scrapingInterval = null;
let timerInterval = null;
let timeLeft = 0;
let isScraping = false;

// Initialize the background script
chrome.runtime.onInstalled.addListener(() => {
  console.log('Indiamart Lead Buyer extension installed');
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScraping') {
    startScraping(request.settings);
    sendResponse({status: 'started'});
  } else if (request.action === 'stopScraping') {
    stopScraping();
    sendResponse({status: 'stopped'});
  } else if (request.action === 'getTimer') {
    sendResponse({timeLeft: timeLeft});
  } else if (request.action === 'buyLead') {
    buyLead(request.leadId);
    sendResponse({status: 'lead bought'});
  } else if (request.action === 'contentScriptReady') {
    // Content script is ready
    console.log('Content script ready');
  }
});

// Start the scraping process
function startScraping(settings) {
  if (isScraping) return;

  isScraping = true;
  timeLeft = settings.refreshInterval;

  // Initial scan
  scanLeads(settings);

  // Set up interval for periodic scanning
  scrapingInterval = setInterval(() => {
    timeLeft = settings.refreshInterval;
    scanLeads(settings);
  }, settings.refreshInterval * 1000);

  // Update timer display
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      chrome.runtime.sendMessage({
        action: 'updateTimer',
        timeLeft: timeLeft
      });
    }
  }, 1000);

  // Update status in popup
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    status: 'Running',
    isRunning: true
  });
}

// Stop the scraping process
function stopScraping() {
  if (scrapingInterval) {
    clearInterval(scrapingInterval);
    scrapingInterval = null;
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  isScraping = false;

  // Update status in popup
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    status: 'Stopped',
    isRunning: false
  });
}

// Scan for leads
function scanLeads(settings) {
  // Send message to content script to scan for leads
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'scanLeads',
        settings: settings
      }, (response) => {
        console.log('Scan response:', response);
      });
    }
  });
}

// Function to buy a lead (placeholder)
function buyLead(leadId) {
  console.log(`Buying lead with ID: ${leadId}`);
  // This function will be implemented in the future
  // For now, just log the action
}