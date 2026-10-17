/* global TrelloPowerUp */
import { TRELLO_APP_KEY, TRELLO_APP_NAME, TRELLO_APP_AUTHOR } from './config.js';

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
    appKey: TRELLO_APP_KEY,
    appName: TRELLO_APP_NAME,
    appAuthor: TRELLO_APP_AUTHOR
  }
);
