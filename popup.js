// Popup script for the extension
document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.sync.get([
    'refreshInterval',
    'minTimePassed',
    'minOrderValue',
    'orderValue',
    'targetLocations'
  ], function(result) {
    document.getElementById('refreshInterval').value = result.refreshInterval || 15;
    document.getElementById('minTimePassed').value = result.minTimePassed || 10;
    document.getElementById('minOrderValue').value = result.minOrderValue || 100;
    document.getElementById('orderValue').value = result.orderValue || 20000;
    document.getElementById('targetLocations').value = result.targetLocations || 'Tamil Nadu,Karnataka,Andhra,Kerala';
  });

  // Start button
  document.getElementById('startBtn').addEventListener('click', function() {
    const settings = {
      refreshInterval: parseInt(document.getElementById('refreshInterval').value),
      minTimePassed: parseInt(document.getElementById('minTimePassed').value),
      minOrderValue: parseInt(document.getElementById('minOrderValue').value),
      orderValue: parseInt(document.getElementById('orderValue').value),
      targetLocations: document.getElementById('targetLocations').value.split(',').map(loc => loc.trim())
    };

    chrome.storage.sync.set(settings, function() {
      chrome.runtime.sendMessage({action: 'startScraping', settings: settings});
      updateStatus('Running', true);
    });
  });

  // Stop button
  document.getElementById('stopBtn').addEventListener('click', function() {
    chrome.runtime.sendMessage({action: 'stopScraping'});
    updateStatus('Stopped', false);
  });

  // Update timer display
  let timerInterval = setInterval(function() {
    chrome.runtime.sendMessage({action: 'getTimer'}, function(response) {
      if (response && response.timeLeft !== undefined) {
        document.getElementById('timer').textContent = `Timer: ${response.timeLeft}s`;
      }
    });
  }, 1000);

  // Update status display
  function updateStatus(status, isRunning) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = `Status: ${status}`;
    statusElement.className = `status ${isRunning ? 'running' : 'stopped'}`;
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateLeads') {
      displayLeads(request.leads);
    } else if (request.action === 'updateStatus') {
      updateStatus(request.status, request.isRunning);
    } else if (request.action === 'updateTimer') {
      // Update timer when received from background script
      document.getElementById('timer').textContent = `Timer: ${request.timeLeft}s`;
    }
  });

  // Display leads
  function displayLeads(leads) {
    const container = document.getElementById('leadsContainer');
    container.innerHTML = '';

    if (!leads || leads.length === 0) {
      container.innerHTML = '<p>No leads found</p>';
      return;
    }

    leads.forEach(lead => {
      const leadElement = document.createElement('div');
      leadElement.className = 'lead-card';

      let locationInfo = '';
      if (lead.location) {
        locationInfo = `<p><strong>Location:</strong> ${lead.location}</p>`;
      }

      leadElement.innerHTML = `
        <h3>${lead.product}</h3>
        ${locationInfo}
        <p><strong>Quantity:</strong> ${lead.quantity}</p>
        <p><strong>Order Value:</strong> ${lead.orderValue}</p>
        <p><strong>Time Passed:</strong> ${lead.timePassed}</p>
        <button onclick="buyLead('${lead.id}')">Buy Lead</button>
      `;

      container.appendChild(leadElement);
    });
  }

  // Buy lead function (placeholder)
  window.buyLead = function(leadId) {
    chrome.runtime.sendMessage({
      action: 'buyLead',
      leadId: leadId
    });
  };

  // Check if dark mode is enabled
  chrome.storage.sync.get(['darkMode'], function(result) {
    if (result.darkMode === true) {
      document.body.classList.add('dark-mode');
    }
  });
});