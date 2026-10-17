/**
 * Initiates editing an alert by populating the wizard draft with the alert's configuration
 * and navigating to the Review page.
 *
 * @param {object} t - Trello Power-Up context
 * @param {object} alert - The alert object to edit
 * @param {string} returnTo - Where Cancel in Review should return ('my-alerts' or 'alert-created')
 */
export async function startEditingAlert(t, alert, returnTo = 'my-alerts') {
  if (!alert) return;

  const editDraft = {
    alertType: alert.alertType,
    conditions: alert.conditions,
    recipients: alert.recipients,
    editingAlertId: alert.id,
    returnTo
  };

  if (t && typeof t.set === 'function') {
    try {
      await t.set('board', 'private', 'alertDraft', editDraft);
    } catch (err) {
      console.warn('Error saving alertDraft to Trello storage:', err);
    }
  }

  try {
    localStorage.setItem('alertDraft', JSON.stringify(editDraft));
  } catch (err) {
    console.warn('Error saving alertDraft to localStorage:', err);
  }

  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./review.html') : './review.html';
  window.location.href = targetUrl;
}
