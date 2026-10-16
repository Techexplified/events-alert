/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { summarizeConditions } from './condition-summary.js';
import { renderAlertSummaryRows } from './alert-summary.js';
import { deleteAlert } from './alerts-api.js';
import { goToMyAlerts } from './navigation.js';

// Initialize the Trello Power-Up iframe connector safely
const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
const t = typeof window.TrelloPowerUp !== 'undefined' && isInsideIframe ? window.TrelloPowerUp.iframe() : null;

// Navigation helpers
function openHome() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./home.html') : './home.html';
  window.location.href = targetUrl;
}

function openStep1() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./create-alert.html') : './create-alert.html';
  window.location.href = targetUrl;
}

function openReview() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./review.html') : './review.html';
  window.location.href = targetUrl;
}

// Setup sidebar navigation
function setupSidebarNav() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      if (target === 'home') {
        openHome();
      } else if (target === 'my-alerts') {
        goToMyAlerts();
      } else if (target === 'create-alert') {
        openStep1();
      }
    });
  });
}

// Setup header close button
function setupCloseButton() {
  const closeBtn = document.getElementById('close-modal-btn');
  if (!closeBtn) return;

  closeBtn.addEventListener('click', () => {
    if (t && typeof t.closeModal === 'function') {
      t.closeModal();
    } else {
      console.log('Modal closed (running outside Trello iframe)');
    }
  });
}

// Load last saved alert data
async function loadLastSavedAlert() {
  let savedData = null;

  if (t && typeof t.get === 'function') {
    try {
      savedData = await t.get('board', 'private', 'lastSavedAlert');
    } catch (err) {
      console.warn('Error reading lastSavedAlert from Trello storage:', err);
    }
  }

  if (!savedData) {
    try {
      const stored = localStorage.getItem('lastSavedAlert');
      if (stored) {
        savedData = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Error reading lastSavedAlert from localStorage:', err);
    }
  }

  return savedData;
}

// Clear last saved alert from storage
async function clearLastSavedAlert() {
  if (t && typeof t.set === 'function') {
    try {
      await t.set('board', 'private', 'lastSavedAlert', null);
    } catch (err) {
      console.warn('Error clearing lastSavedAlert from Trello storage:', err);
    }
  }
  try {
    localStorage.removeItem('lastSavedAlert');
  } catch (err) {
    console.warn('Error clearing lastSavedAlert from localStorage:', err);
  }
}

// Clear alert draft from storage
async function clearDraft() {
  if (t && typeof t.set === 'function') {
    try {
      await t.set('board', 'private', 'alertDraft', null);
    } catch (err) {
      console.warn('Error clearing draft from Trello storage:', err);
    }
  }
  try {
    localStorage.removeItem('alertDraft');
  } catch (err) {
    console.warn('Error clearing draft from localStorage:', err);
  }
}

// Save draft
async function saveDraft(draft) {
  if (t && typeof t.set === 'function') {
    try {
      await t.set('board', 'private', 'alertDraft', draft);
    } catch (err) {
      console.warn('Error saving draft to Trello storage:', err);
    }
  }
  try {
    localStorage.setItem('alertDraft', JSON.stringify(draft));
  } catch (err) {
    console.warn('Error saving draft to localStorage:', err);
  }
}

// Main page setup and rendering
async function initAlertCreatedPage() {
  setupSidebarNav();
  setupCloseButton();

  const container = document.getElementById('alert-created-view-container');
  if (!container) return;

  const savedData = await loadLastSavedAlert();

  if (!savedData || !savedData.alert) {
    container.innerHTML = `
      <div class="coming-soon-banner" style="text-align: center; padding: 40px 20px;">
        <p style="font-weight: 600; font-size: 16px; color: var(--text-dark); margin-bottom: 8px;">No alert to show</p>
        <p style="color: var(--text-muted); margin-bottom: 20px;">You haven't created or saved an alert yet.</p>
        <button id="btn-empty-home" class="btn-primary">
          Go to Home
        </button>
      </div>
    `;
    const homeBtn = document.getElementById('btn-empty-home');
    if (homeBtn) homeBtn.addEventListener('click', openHome);
    return;
  }

  const alert = savedData.alert;
  const savedAs = savedData.savedAs || 'created';

  container.innerHTML = '';

  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'created-page-container';

  // 1. Success Mark (Circle, Checkmark, Sparkles)
  const markWrapper = document.createElement('div');
  markWrapper.className = 'success-mark-wrapper';

  // Sparkles SVG
  const sparklesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sparklesSvg.setAttribute('class', 'success-sparkles');
  sparklesSvg.setAttribute('viewBox', '0 0 90 90');
  sparklesSvg.innerHTML = `
    <!-- Top-Right: green line, blue dot -->
    <line x1="65" y1="25" x2="72" y2="18" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" />
    <circle cx="78" cy="28" r="2.5" fill="#3B82F6" />

    <!-- Top-Left: blue line, green dot -->
    <line x1="25" y1="25" x2="18" y2="18" stroke="#3B82F6" stroke-width="2.2" stroke-linecap="round" />
    <circle cx="12" cy="27" r="2.5" fill="#10B981" />

    <!-- Bottom-Left: blue line -->
    <line x1="24" y1="66" x2="18" y2="72" stroke="#3B82F6" stroke-width="2.2" stroke-linecap="round" />

    <!-- Bottom-Right: blue line -->
    <line x1="66" y1="66" x2="73" y2="73" stroke="#3B82F6" stroke-width="2.2" stroke-linecap="round" />
  `;
  markWrapper.appendChild(sparklesSvg);

  // Circle with white check
  const circle = document.createElement('div');
  circle.className = 'success-mark-circle';
  circle.innerHTML = `
    <svg class="success-mark-check" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;
  markWrapper.appendChild(circle);

  pageWrapper.appendChild(markWrapper);

  // 2. Headings
  const heading = document.createElement('h2');
  heading.className = 'created-page-title';
  heading.textContent = savedAs === 'updated' ? 'Alert updated successfully!' : 'Alert created successfully!';
  pageWrapper.appendChild(heading);

  const subtext = document.createElement('p');
  subtext.className = 'created-page-subtitle';
  subtext.textContent = 'We will monitor your cards and send email alerts when the condition is met.';
  pageWrapper.appendChild(subtext);

  // 3. Alert Card
  const alertCard = document.createElement('div');
  alertCard.className = 'review-card';
  alertCard.style.width = '100%';

  // Banner at top with "● Active" pill
  const banner = document.createElement('div');
  banner.className = 'alert-type-banner';

  const alertType = alert.alertType || (alert.conditions && alert.conditions.alertType) || 'stuck-in-list';
  const typeObj = alertTypes.find((t) => t.id === alertType) || {
    id: alertType,
    title: 'Custom Alert',
    description: 'Alert configuration',
    iconBg: '#FEE2E2',
    iconColor: '#EF4444'
  };

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'alert-icon-wrapper';
  iconWrapper.style.backgroundColor = typeObj.iconBg;
  iconWrapper.innerHTML = getIconSvg(typeObj.id, typeObj.iconColor);
  banner.appendChild(iconWrapper);

  const bannerInfo = document.createElement('div');
  bannerInfo.className = 'banner-info';
  bannerInfo.style.flex = '1';

  const bannerTitle = document.createElement('h3');
  bannerTitle.className = 'banner-title';
  bannerTitle.textContent = typeObj.title;
  bannerInfo.appendChild(bannerTitle);

  const bannerDesc = document.createElement('p');
  bannerDesc.className = 'banner-description';
  bannerDesc.textContent = summarizeConditions(alert);
  bannerInfo.appendChild(bannerDesc);

  banner.appendChild(bannerInfo);

  // Active Status Pill (top right)
  const activePill = document.createElement('span');
  activePill.className = 'status-pill-active';
  activePill.innerHTML = '<span class="status-dot-active"></span>Active';
  banner.appendChild(activePill);

  alertCard.appendChild(banner);

  // Read-only rows container
  const table = document.createElement('div');
  table.className = 'review-table';
  alertCard.appendChild(table);

  // Render shared summary rows
  renderAlertSummaryRows({
    container: table,
    alert,
    boardName: alert.boardName
  });

  // Card divider
  const divider = document.createElement('hr');
  divider.className = 'card-actions-divider';
  alertCard.appendChild(divider);

  // Card Actions (Edit Alert & Delete)
  const cardActionsRow = document.createElement('div');
  cardActionsRow.className = 'card-actions-row';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn-card-action btn-card-edit';
  editBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
    <span>Edit Alert</span>
  `;

  editBtn.addEventListener('click', async () => {
    // Load saved alert into draft and open review page in edit mode
    await saveDraft({
      alertType: alert.alertType,
      conditions: alert.conditions,
      recipients: alert.recipients,
      editingAlertId: alert.id
    });
    openReview();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-card-action btn-card-delete';
  deleteBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
    <span>Delete</span>
  `;

  cardActionsRow.appendChild(editBtn);
  cardActionsRow.appendChild(deleteBtn);
  alertCard.appendChild(cardActionsRow);

  // Inline Delete Confirmation
  deleteBtn.addEventListener('click', () => {
    cardActionsRow.innerHTML = '';

    const confirmBox = document.createElement('div');
    confirmBox.className = 'delete-confirm-box';

    const confirmText = document.createElement('span');
    confirmText.className = 'delete-confirm-text';
    confirmText.textContent = 'Delete this alert? This can’t be undone.';
    confirmBox.appendChild(confirmText);

    const confirmActions = document.createElement('div');
    confirmActions.className = 'delete-confirm-actions';

    const cancelDeleteBtn = document.createElement('button');
    cancelDeleteBtn.type = 'button';
    cancelDeleteBtn.className = 'btn-outline btn-sm';
    cancelDeleteBtn.textContent = 'Cancel';

    cancelDeleteBtn.addEventListener('click', () => {
      confirmBox.remove();
      cardActionsRow.appendChild(editBtn);
      cardActionsRow.appendChild(deleteBtn);
    });

    const confirmDeleteBtn = document.createElement('button');
    confirmDeleteBtn.type = 'button';
    confirmDeleteBtn.className = 'btn-danger-solid';
    confirmDeleteBtn.textContent = 'Delete';

    const deleteErrorSpan = document.createElement('span');
    deleteErrorSpan.className = 'error-message';
    deleteErrorSpan.style.marginRight = '8px';

    confirmDeleteBtn.addEventListener('click', async () => {
      confirmDeleteBtn.disabled = true;
      cancelDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Deleting…';
      deleteErrorSpan.classList.remove('visible');

      try {
        await deleteAlert(alert.id);
        await clearLastSavedAlert();

        // Replace card content with "Alert deleted" state
        alertCard.innerHTML = '<div class="card-deleted-state">Alert deleted</div>';
      } catch (err) {
        console.error('Delete alert failed:', err);
        deleteErrorSpan.textContent = 'Failed to delete alert. Please try again.';
        deleteErrorSpan.classList.add('visible');
        confirmBox.insertBefore(deleteErrorSpan, confirmActions);
        confirmDeleteBtn.disabled = false;
        cancelDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Delete';
      }
    });

    confirmActions.appendChild(cancelDeleteBtn);
    confirmActions.appendChild(confirmDeleteBtn);
    confirmBox.appendChild(confirmActions);
    cardActionsRow.appendChild(confirmBox);
  });

  pageWrapper.appendChild(alertCard);

  // 4. Bottom Buttons (+ Create Another Alert, Go to My Alerts ->)
  const bottomActions = document.createElement('div');
  bottomActions.className = 'page-bottom-actions';

  const createAnotherBtn = document.createElement('button');
  createAnotherBtn.type = 'button';
  createAnotherBtn.className = 'btn-create-another';
  createAnotherBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
    <span>Create Another Alert</span>
  `;

  createAnotherBtn.addEventListener('click', async () => {
    await clearDraft();
    openStep1();
  });

  const goToMyAlertsBtn = document.createElement('button');
  goToMyAlertsBtn.type = 'button';
  goToMyAlertsBtn.className = 'btn-primary';
  goToMyAlertsBtn.innerHTML = `
    <span>Go to My Alerts</span>
    <span style="font-size: 16px; margin-left: 4px;">&rarr;</span>
  `;

  goToMyAlertsBtn.addEventListener('click', () => {
    goToMyAlerts();
  });

  bottomActions.appendChild(createAnotherBtn);
  bottomActions.appendChild(goToMyAlertsBtn);
  pageWrapper.appendChild(bottomActions);

  container.appendChild(pageWrapper);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initAlertCreatedPage();
});
