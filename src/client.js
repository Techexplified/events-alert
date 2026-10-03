/* global TrelloPowerUp */

// Initialize the Trello Power-Up connector
window.TrelloPowerUp.initialize(
  {
    'board-buttons': function (t, options) {
      return [
        {
          // Bell icon for board button
          icon: {
            dark: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/bell.svg',
            light: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/bell.svg'
          },
          text: 'Event Alerts',
          callback: function (t) {
            return t.modal({
              title: 'Event Alerts',
              url: t.signUrl('./home.html'),
              accentColor: '#2563EB',
              fullscreen: false,
              height: 600
            });
          }
        }
      ];
    }
  },
  {
    // TODO: Real appKey, appName, and appAuthor values go in once the Power-Up is registered in Trello's admin
    appKey: 'YOUR_TRELLO_API_KEY',
    appName: 'Event Alerts',
    appAuthor: 'Event Alerts Team'
  }
);
