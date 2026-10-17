import { apiFetch } from './api-client.js';

/**
 * List all alerts for the specified board (newest first).
 * Non-interactive.
 *
 * @param {object} t - Trello Power-Up context
 * @param {string} boardId - Board ID
 * @returns {Promise<Array>} Array of alerts, each with canManage
 */
export async function listAlerts(t, boardId) {
  if (!boardId) {
    throw new Error('boardId is required to list alerts');
  }
  const data = await apiFetch(t, `/api/alerts?boardId=${encodeURIComponent(boardId)}`, {
    method: 'GET',
    interactive: false
  });
  return data.alerts || [];
}

/**
 * Fetch a single alert by ID.
 * Non-interactive.
 *
 * @param {object} t - Trello Power-Up context
 * @param {string} id - Alert ID
 * @returns {Promise<object>} The alert object with canManage
 */
export async function getAlert(t, id) {
  if (!id) {
    throw new Error('id is required to get an alert');
  }
  const data = await apiFetch(t, `/api/alerts/${encodeURIComponent(id)}`, {
    method: 'GET',
    interactive: false
  });
  return data.alert;
}

/**
 * Create a new alert.
 * Interactive (must run at start of click handler).
 *
 * @param {object} t - Trello Power-Up context
 * @param {object} payload - { alertType, boardId, boardName, conditions, recipients }
 * @returns {Promise<object>} The created alert with canManage: true
 */
export async function createAlert(t, payload) {
  const data = await apiFetch(t, '/api/alerts', {
    method: 'POST',
    body: payload,
    interactive: true
  });
  return data.alert;
}

/**
 * Update an existing alert's conditions and/or recipients.
 * Interactive (must run at start of click handler).
 *
 * @param {object} t - Trello Power-Up context
 * @param {string} id - Alert ID
 * @param {object} update - { conditions?, recipients? }
 * @returns {Promise<object>} The updated alert with canManage: true
 */
export async function updateAlert(t, id, { conditions, recipients } = {}) {
  const data = await apiFetch(t, `/api/alerts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { conditions, recipients },
    interactive: true
  });
  return data.alert;
}

/**
 * Set an alert's status to 'active' or 'paused'.
 * Interactive (must run at start of click handler).
 *
 * @param {object} t - Trello Power-Up context
 * @param {string} id - Alert ID
 * @param {string} status - 'active' | 'paused'
 * @returns {Promise<object>} The updated alert with canManage: true
 */
export async function setAlertStatus(t, id, status) {
  const data = await apiFetch(t, `/api/alerts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status },
    interactive: true
  });
  return data.alert;
}

/**
 * Delete an alert by ID.
 * Interactive (must run at start of click handler).
 *
 * @param {object} t - Trello Power-Up context
 * @param {string} id - Alert ID
 * @returns {Promise<object>} { ok: true }
 */
export async function deleteAlert(t, id) {
  const data = await apiFetch(t, `/api/alerts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    interactive: true
  });
  return data;
}
