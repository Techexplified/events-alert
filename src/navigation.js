/**
 * Shared navigation handlers.
 */

import { getTrello } from './trello-instance.js';

export function goToMyAlerts(t = null) {
  const tInst = t || getTrello();
  const targetUrl = tInst && typeof tInst.signUrl === 'function' ? tInst.signUrl('./my-alerts.html') : './my-alerts.html';
  window.location.href = targetUrl;
}
