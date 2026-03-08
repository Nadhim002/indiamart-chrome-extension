// Content script to extract leads from Indiamart pages
(function() {
  // Function to parse time string into minutes
  function parseTimeToMinutes(timeString) {
    if (!timeString) return 0;

    timeString = timeString.toLowerCase().trim();

    // Handle "sec ago" and "secs ago"
    if (timeString.includes('sec')) {
      const value = parseInt(timeString);
      return value / 60; // Convert to minutes
    }

    // Handle "min ago" and "mins ago"
    if (timeString.includes('min')) {
      const value = parseInt(timeString);
      return value;
    }

    // Handle "hr ago" and "hrs ago"
    if (timeString.includes('hr')) {
      const value = parseInt(timeString);
      return value * 60;
    }

    // Handle "day old" and "days old"
    if (timeString.includes('day')) {
      const value = parseInt(timeString);
      return value * 24 * 60;
    }

    // Handle "yesterday"
    if (timeString.includes('yesterday')) {
      return 24 * 60; // One day in minutes
    }

    return 0;
  }

  // Function to extract quantity from string
  function extractQuantity(quantityString) {
    if (!quantityString) return 0;

    const match = quantityString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // Function to extract order value from string
  function extractOrderValue(valueString) {
    if (!valueString) return 0;

    // Extract numeric values from strings like "Rs. 20,000 to 50,000"
    const match = valueString.match(/(\d+(?:,\d+)*)/g);
    if (match && match.length >= 2) {
      // Return the higher value
      return parseInt(match[1].replace(/,/g, ''));
    } else if (match) {
      // Return the single value
      return parseInt(match[0].replace(/,/g, ''));
    }

    return 0;
  }

  // Function to check if location matches target locations
  function isLocationTarget(location, targetLocations) {
    if (!location || !targetLocations || targetLocations.length === 0) return false;

    const lowerLocation = location.toLowerCase();
    return targetLocations.some(loc =>
      lowerLocation.includes(loc.toLowerCase())
    );
  }

  // Function to extract lead information from a card
  function extractLeadInfo(cardElement, cardId) {
    try {
      // Find product title
      let productTitle = '';
      const titleElements = cardElement.querySelectorAll('h3, .product-title');
      if (titleElements.length > 0) {
        productTitle = titleElements[0].textContent.trim();
      }

      // Find location
      let location = '';
      const locationElements = cardElement.querySelectorAll('.location, .loc');
      if (locationElements.length > 0) {
        location = locationElements[0].textContent.trim();
      }

      // Find quantity
      let quantity = '';
      const quantityElements = cardElement.querySelectorAll('.quantity, .qty');
      if (quantityElements.length > 0) {
        quantity = quantityElements[0].textContent.trim();
      }

      // Find order value
      let orderValue = '';
      const valueElements = cardElement.querySelectorAll('.order-value, .price, .amount');
      if (valueElements.length > 0) {
        orderValue = valueElements[0].textContent.trim();
      }

      // Find time passed
      let timePassed = '';
      const timeElements = cardElement.querySelectorAll('.time-passed, .ago, .duration');
      if (timeElements.length > 0) {
        timePassed = timeElements[0].textContent.trim();
      }

      return {
        id: cardId,
        product: productTitle,
        location: location,
        quantity: extractQuantity(quantity),
        orderValue: extractOrderValue(orderValue),
        timePassed: timePassed
      };
    } catch (error) {
      console.error('Error extracting lead info:', error);
      return null;
    }
  }

  // Function to check if a lead matches the criteria
  function isLeadMatch(lead, settings) {
    if (!lead || !settings) return false;

    // Check time passed
    const timeInMinutes = parseTimeToMinutes(lead.timePassed);
    if (timeInMinutes >= settings.minTimePassed) {
      return false;
    }

    // Check quantity or order value
    const meetsQuantity = lead.quantity >= settings.minOrderValue;
    const meetsOrderValue = lead.orderValue >= settings.orderValue;

    if (!meetsQuantity && !meetsOrderValue) {
      return false;
    }

    // Check location
    if (!isLocationTarget(lead.location, settings.targetLocations)) {
      return false;
    }

    return true;
  }

  // Main function to scan and extract leads
  function scanLeads(settings) {
    try {
      console.log('Starting lead scan with settings:', settings);

      const leadCards = document.querySelectorAll('#bl_listing [id^="list"]');

      if (leadCards.length === 0) {
        console.log('No lead cards found');
        return [];
      }

      console.log(`Found ${leadCards.length} lead cards to process`);

      const leads = [];

      leadCards.forEach((card, index) => {
        const cardId = `list${index + 1}`;
        console.log(`Processing card ${cardId}`);

        const leadInfo = extractLeadInfo(card, cardId);

        if (leadInfo) {
          console.log(`Card ${cardId} info extracted:`, leadInfo);

          if (isLeadMatch(leadInfo, settings)) {
            console.log(`Card ${cardId} matches criteria and will be included`);
            leads.push(leadInfo);
          } else {
            console.log(`Card ${cardId} does not match criteria`);
          }
        } else {
          console.log(`Failed to extract info from card ${cardId}`);
        }
      });

      console.log(`Scan complete. Found ${leads.length} matching leads`);
      return leads;
    } catch (error) {
      console.error('Error scanning leads:', error);
      return [];
    }
  }

  // Function to send leads to popup
  function sendLeadsToPopup(leads) {
    console.log('Sending leads to popup:', leads);
    chrome.runtime.sendMessage({
      action: 'updateLeads',
      leads: leads
    });
  }

  // Initialize the content script
  function init() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'scanLeads') {
        const settings = request.settings;
        const leads = scanLeads(settings);
        sendLeadsToPopup(leads);
        sendResponse({status: 'success', count: leads.length});
      }
    });

    // Initial scan
    chrome.runtime.sendMessage({action: 'contentScriptReady'});
  }

  // Start the content script
  init();
})();