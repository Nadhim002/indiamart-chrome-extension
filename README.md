# Indiamart Lead Buyer Chrome Extension

A Chrome extension that automatically finds and buys leads from Indiamart based on user-defined criteria.

## Features

- Automatically scans Indiamart pages for buyer leads
- Applies configurable filtering criteria to identify relevant leads
- User interface for setting up scraping parameters
- Start/stop functionality with timer display
- Light and dark mode support
- Responsive design for popup interface

## Installation

1. Clone or download this repository
2. Open Chrome browser
3. Navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked"
6. Select the extension folder containing manifest.json

## Usage

1. Configure settings in the popup:
   - Refresh Interval: How often to check for new leads (seconds)
   - Min Time Passed: Minimum time a lead must be old (minutes)
   - Min Order Value: Minimum quantity required for a lead
   - Order Value: Minimum order value required for a lead
   - Target Locations: Comma-separated list of locations to target

2. Click "Start" to begin scanning for leads
3. View detected leads in the popup interface
4. Click "Buy Lead" on any lead to purchase it (placeholder functionality)

## Files

- `manifest.json` - Extension configuration
- `popup.html` - Main popup UI
- `popup.js` - Popup functionality
- `content.js` - Content script for page scraping
- `background.js` - Background script for managing scraping process
- `styles.css` - Styling for components
- `specs.md` - Extension specifications

## Development

This extension follows Chrome Extension Manifest V3 standards and uses modern JavaScript for all functionality.

## License

MIT License