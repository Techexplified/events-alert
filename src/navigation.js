/**
 * Shared navigation handlers.
 */

export function goToMyAlerts(t = null) {
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
  const tInst = t || (typeof window.TrelloPowerUp !== 'undefined' && isInsideIframe ? window.TrelloPowerUp.iframe() : null);
  const targetUrl = tInst && typeof tInst.signUrl === 'function' ? tInst.signUrl('./my-alerts.html') : './my-alerts.html';
  window.location.href = targetUrl;
}
