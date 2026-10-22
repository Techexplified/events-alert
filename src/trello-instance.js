import { TRELLO_APP_KEY, TRELLO_APP_NAME, TRELLO_APP_AUTHOR } from './config.js';

let cachedTrello = null;

/**
 * Returns the Trello Power-Up iframe instance safely.
 * If running outside an iframe (e.g. standalone tab), returns null.
 * Uses lazy acquisition so that if window.TrelloPowerUp is delayed,
 * subsequent calls will successfully retrieve the instance.
 */
export function getTrello(options = {}) {
  if (cachedTrello) return cachedTrello;
  if (typeof window === 'undefined') return null;

  const isInsideIframe = window.self !== window.top;
  if (!isInsideIframe) {
    return null;
  }

  if (typeof window.TrelloPowerUp === 'undefined') {
    return null;
  }

  const merged = {
    appKey: TRELLO_APP_KEY,
    appName: TRELLO_APP_NAME,
    appAuthor: TRELLO_APP_AUTHOR,
    ...options
  };

  try {
    cachedTrello = window.TrelloPowerUp.iframe(merged);
    return cachedTrello;
  } catch (err) {
    console.warn('Failed to initialize TrelloPowerUp.iframe:', err);
    return null;
  }
}
