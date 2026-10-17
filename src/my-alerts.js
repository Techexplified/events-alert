/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { summarizeConditions } from './condition-summary.js';
import { listAlerts, setAlertStatus, deleteAlert } from './alerts-api.js';
import { startEditingAlert } from './edit-alert.js';
import { fetchCurrentMember } from './board-data.js';
import { goToMyAlerts } from './navigation.js';
import { TRELLO_APP_KEY, TRELLO_APP_NAME, TRELLO_APP_AUTHOR } from './config.js';
import { NotAuthorizedError, ApiError, getToken } from './api-client.js';

// Initialize the Trello Power-Up iframe connector safely
const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
const t = typeof window.TrelloPowerUp !== 'undefined' && isInsideIframe
  ? window.TrelloPowerUp.iframe({
      appKey: TRELLO_APP_KEY,
      appName: TRELLO_APP_NAME,
      appAuthor: TRELLO_APP_AUTHOR
    })
  : null;

// Navigation helpers
function openHome() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./home.html') : './home.html';
  window.location.href = targetUrl;
}

function openCreateAlert() {
  // Clear draft for a fresh wizard flow
  if (t && typeof t.set === 'function') {
    try {
      t.set('board', 'private', 'alertDraft', null);
    } catch (e) {}
  }
  try {
    localStorage.removeItem('alertDraft');
  } catch (e) {}

  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./create-alert.html') : './create-alert.html';
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
        goToMyAlerts(t);
      } else if (target === 'create-alert') {
        openCreateAlert();
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

// Helper to format recipients for card footer
// When recipients.mode === 'me' and current member isn't recipients.creator.id, show "Only {creator name}"
function formatRecipientSummary(recipients, currentMember) {
  if (!recipients) return 'Me only';
  if (recipients.mode === 'me') {
    if (recipients.creator && currentMember && recipients.creator.id !== currentMember.id) {
      return `Only ${recipients.creator.name || 'creator'}`;
    }
    return 'Me only';
  }
  if (recipients.mode === 'all') return 'All members';
  if (recipients.mode === 'specific') {
    const count = Array.isArray(recipients.members) ? recipients.members.length : 0;
    return count === 1 ? '1 member' : `${count} members`;
  }
  return 'Me only';
}

// SVG Icons for metadata columns
const ICONS = {
  board: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
    <line x1="9" y1="3" x2="9" y2="21"></line>
  </svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>`,
  condition: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"></circle>
    <polyline points="12 6 12 12 14 14"></polyline>
  </svg>`,
  notify: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>`
};

// Helper to create metadata column element securely using textContent
function createMetaColumn(iconSvg, label, value) {
  const col = document.createElement('div');
  col.className = 'alert-meta-col';

  const iconEl = document.createElement('span');
  iconEl.className = 'alert-meta-icon';
  iconEl.innerHTML = iconSvg;
  col.appendChild(iconEl);

  const infoEl = document.createElement('div');
  infoEl.className = 'alert-meta-info';

  const labelEl = document.createElement('span');
  labelEl.className = 'alert-meta-label';
  labelEl.textContent = label;
  infoEl.appendChild(labelEl);

  const valEl = document.createElement('span');
  valEl.className = 'alert-meta-val';
  // Security: render Trello-sourced text strictly with textContent
  valEl.textContent = String(value || '');
  infoEl.appendChild(valEl);

  col.appendChild(infoEl);
  return col;
}

// Global state for My Alerts page
let allAlerts = [];
let currentTab = 'all'; // 'all' | 'active' | 'paused'
let currentBoardId = null;
let currentMember = null;
let globalErrorMessage = null;

// Main page setup and rendering
async function initMyAlertsPage() {
  setupSidebarNav();
  setupCloseButton();

  // Top "+ Create Alert" button listener
  const topCreateBtn = document.getElementById('btn-create-alert-top');
  if (topCreateBtn) {
    topCreateBtn.addEventListener('click', openCreateAlert);
  }

  // Tab buttons
  const tabs = document.querySelectorAll('.alerts-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const selected = tab.getAttribute('data-tab');
      if (selected === currentTab) return;

      currentTab = selected;
      tabs.forEach((tBtn) => {
        const isActive = tBtn.getAttribute('data-tab') === currentTab;
        tBtn.classList.toggle('active', isActive);
        tBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      renderAlertCards();
    });
  });

  // Document click listener to close kebab dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.kebab-wrapper')) {
      document.querySelectorAll('.kebab-dropdown.open').forEach((d) => d.classList.remove('open'));
    }
  });

  await loadAndRenderAlerts();
}

function updateTabCounts() {
  const totalCount = allAlerts.length;
  const activeCount = allAlerts.filter((a) => a.status === 'active').length;
  const pausedCount = allAlerts.filter((a) => a.status === 'paused').length;

  const countAllEl = document.getElementById('tab-count-all');
  const countActiveEl = document.getElementById('tab-count-active');
  const countPausedEl = document.getElementById('tab-count-paused');

  if (countAllEl) countAllEl.textContent = `(${totalCount})`;
  if (countActiveEl) countActiveEl.textContent = `(${activeCount})`;
  if (countPausedEl) countPausedEl.textContent = `(${pausedCount})`;
}

// Shows skeleton loading state
function renderLoadingSkeleton() {
  const container = document.getElementById('alerts-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="alerts-loading-skeleton">
      <div class="alert-skeleton-card"></div>
      <div class="alert-skeleton-card"></div>
    </div>
  `;
}

// Shows Not Connected state with interactive auth button
function renderNotConnectedState() {
  const container = document.getElementById('alerts-list-container');
  if (!container) return;

  container.innerHTML = '';
  updateTabCounts();

  const emptyState = document.createElement('div');
  emptyState.className = 'alerts-empty-state';

  const emptyIcon = document.createElement('div');
  emptyIcon.className = 'empty-state-icon';
  emptyIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  `;
  emptyState.appendChild(emptyIcon);

  const emptyTitle = document.createElement('h3');
  emptyTitle.className = 'empty-state-title';
  emptyTitle.textContent = 'Connect your Trello account';
  emptyState.appendChild(emptyTitle);

  const emptySub = document.createElement('p');
  emptySub.className = 'empty-state-subtext';
  emptySub.textContent = 'Authorize Event Alerts to view and manage your board alerts.';
  emptyState.appendChild(emptySub);

  const connectBtn = document.createElement('button');
  connectBtn.className = 'btn-primary';
  connectBtn.textContent = 'Connect your Trello account';

  connectBtn.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting…';
    try {
      await getToken(t, { interactive: true });
      await loadAndRenderAlerts();
    } catch (err) {
      console.error('Failed to authorize:', err);
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect your Trello account';
    }
  });

  emptyState.appendChild(connectBtn);
  container.appendChild(emptyState);
}

// Shows Error state with Retry button
function renderErrorState(errorMessage) {
  const container = document.getElementById('alerts-list-container');
  if (!container) return;

  container.innerHTML = '';
  updateTabCounts();

  const emptyState = document.createElement('div');
  emptyState.className = 'alerts-empty-state';

  const emptyIcon = document.createElement('div');
  emptyIcon.className = 'empty-state-icon';
  emptyIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;
  emptyState.appendChild(emptyIcon);

  const emptyTitle = document.createElement('h3');
  emptyTitle.className = 'empty-state-title';
  emptyTitle.textContent = 'Failed to load alerts';
  emptyState.appendChild(emptyTitle);

  const emptySub = document.createElement('p');
  emptySub.className = 'empty-state-subtext';
  emptySub.textContent = errorMessage || 'Something went wrong while fetching alerts for this board.';
  emptyState.appendChild(emptySub);

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn-primary';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => loadAndRenderAlerts());
  emptyState.appendChild(retryBtn);

  container.appendChild(emptyState);
}

// Fetch alerts from backend and render
async function loadAndRenderAlerts() {
  renderLoadingSkeleton();

  try {
    if (t && typeof t.board === 'function') {
      const b = await t.board('id');
      currentBoardId = b?.id || null;
    }

    if (!currentBoardId) {
      currentBoardId = 'board-mock-1';
    }

    currentMember = await fetchCurrentMember(t);
    allAlerts = await listAlerts(t, currentBoardId);
    globalErrorMessage = null;
    renderAlertCards();
  } catch (err) {
    console.error('loadAndRenderAlerts error:', err);
    if (err instanceof NotAuthorizedError) {
      renderNotConnectedState();
    } else {
      renderErrorState(err.message || 'Unable to connect to server');
    }
  }
}

function showCardInlineError(card, message) {
  let errBox = card.querySelector('.card-inline-error');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.className = 'card-inline-error';
    card.appendChild(errBox);
  }
  errBox.textContent = message;
  setTimeout(() => {
    if (errBox) errBox.remove();
  }, 4000);
}

// Main card rendering based on currentTab
function renderAlertCards() {
  const container = document.getElementById('alerts-list-container');
  if (!container) return;

  container.innerHTML = '';
  updateTabCounts();

  // If there is an active global error message, show the banner
  if (globalErrorMessage) {
    const errorBanner = document.createElement('div');
    errorBanner.className = 'alerts-inline-error-banner';

    const errText = document.createElement('span');
    errText.textContent = globalErrorMessage;
    errorBanner.appendChild(errText);

    const closeBannerBtn = document.createElement('button');
    closeBannerBtn.className = 'btn-close-error';
    closeBannerBtn.innerHTML = '&times;';
    closeBannerBtn.addEventListener('click', () => {
      globalErrorMessage = null;
      errorBanner.remove();
    });
    errorBanner.appendChild(closeBannerBtn);

    container.appendChild(errorBanner);
  }

  const filtered = allAlerts.filter((alert) => {
    if (currentTab === 'active') return alert.status === 'active';
    if (currentTab === 'paused') return alert.status === 'paused';
    return true;
  });

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'alerts-empty-state';

    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'empty-state-icon';
    emptyIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
    emptyState.appendChild(emptyIcon);

    const emptyTitle = document.createElement('h3');
    emptyTitle.className = 'empty-state-title';
    emptyTitle.textContent = currentTab === 'all'
      ? 'No alerts on this board yet'
      : currentTab === 'active'
      ? 'No active alerts'
      : 'No paused alerts';
    emptyState.appendChild(emptyTitle);

    const emptySub = document.createElement('p');
    emptySub.className = 'empty-state-subtext';
    emptySub.textContent = currentTab === 'all'
      ? 'Get started by creating your first automated alert.'
      : 'All of your alerts are currently in another state.';
    emptyState.appendChild(emptySub);

    if (currentTab === 'all') {
      const createBtn = document.createElement('button');
      createBtn.className = 'btn-primary';
      createBtn.textContent = '+ Create Alert';
      createBtn.addEventListener('click', openCreateAlert);
      emptyState.appendChild(createBtn);
    }

    container.appendChild(emptyState);
    return;
  }

  filtered.forEach((alert) => {
    const card = document.createElement('div');
    card.className = 'alert-item-card';
    if (alert.status === 'paused') {
      card.classList.add('is-paused');
    }
    card.setAttribute('data-alert-id', alert.id);

    const alertType = alert.alertType || (alert.conditions && alert.conditions.alertType) || 'stuck-in-list';
    const typeObj = alertTypes.find((t) => t.id === alertType) || {
      id: alertType,
      title: 'Custom Alert',
      description: 'Alert configuration',
      iconBg: '#FEE2E2',
      iconColor: '#EF4444'
    };

    // --- Top Row ---
    const topRow = document.createElement('div');
    topRow.className = 'alert-card-top';

    // Left: Icon + Title + Description
    const topLeft = document.createElement('div');
    topLeft.className = 'alert-card-top-left';

    const iconBadge = document.createElement('div');
    iconBadge.className = 'alert-type-badge-icon';
    iconBadge.style.backgroundColor = typeObj.iconBg;
    iconBadge.innerHTML = getIconSvg(typeObj.id, typeObj.iconColor);
    topLeft.appendChild(iconBadge);

    const infoBox = document.createElement('div');
    infoBox.className = 'alert-card-info';

    const titleEl = document.createElement('h3');
    titleEl.className = 'alert-card-title';
    titleEl.textContent = typeObj.title;
    infoBox.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.className = 'alert-card-description';
    descEl.textContent = summarizeConditions(alert);
    infoBox.appendChild(descEl);

    topLeft.appendChild(infoBox);
    topRow.appendChild(topLeft);

    // Right: Toggle Switch + Status Pill + Kebab Button
    const topRight = document.createElement('div');
    topRight.className = 'alert-card-top-right';

    // Toggle Switch
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';
    toggleLabel.setAttribute('aria-label', `Toggle ${typeObj.title}`);

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = alert.status === 'active';

    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';

    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);

    // Status Pill
    const statusPill = document.createElement('span');
    const isInitialActive = alert.status === 'active';
    statusPill.className = isInitialActive ? 'status-pill-active' : 'status-pill-paused';
    statusPill.textContent = isInitialActive ? 'Active' : 'Paused';

    const canManage = alert.canManage !== false;

    // Read-only handling for toggle
    if (!canManage) {
      toggleInput.disabled = true;
      toggleLabel.style.cursor = 'not-allowed';
      toggleLabel.title = 'Only the creator or a board admin can change this';
      toggleInput.title = 'Only the creator or a board admin can change this';
    } else {
      // Optimistic Toggle Listener
      toggleInput.addEventListener('change', async () => {
        const previousStatus = alert.status;
        const targetStatus = toggleInput.checked ? 'active' : 'paused';

        // 1. Optimistic UI update
        alert.status = targetStatus;
        const isNowActive = targetStatus === 'active';
        statusPill.className = isNowActive ? 'status-pill-active' : 'status-pill-paused';
        statusPill.textContent = isNowActive ? 'Active' : 'Paused';
        card.classList.toggle('is-paused', !isNowActive);
        updateTabCounts();

        toggleInput.disabled = true;

        try {
          await setAlertStatus(t, alert.id, targetStatus);
          toggleInput.disabled = false;

          // If current tab is active or paused, smoothly transition card
          if (currentTab !== 'all') {
            card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
              renderAlertCards();
            }, 200);
          }
        } catch (err) {
          // 2. Roll back on failure
          alert.status = previousStatus;
          const wasActive = previousStatus === 'active';
          toggleInput.checked = wasActive;
          toggleInput.disabled = false;
          statusPill.className = wasActive ? 'status-pill-active' : 'status-pill-paused';
          statusPill.textContent = wasActive ? 'Active' : 'Paused';
          card.classList.toggle('is-paused', !wasActive);
          updateTabCounts();

          if (err.status === 403) {
            globalErrorMessage = "Only the alert's creator or a board admin can change this alert";
            await loadAndRenderAlerts();
          } else {
            showCardInlineError(card, err.message || 'Failed to update alert status');
          }
        }
      });
    }

    topRight.appendChild(toggleLabel);
    topRight.appendChild(statusPill);

    // Three Dots Kebab Button & Dropdown
    const kebabWrapper = document.createElement('div');
    kebabWrapper.className = 'kebab-wrapper';

    const kebabBtn = document.createElement('button');
    kebabBtn.type = 'button';
    kebabBtn.className = 'btn-kebab';
    kebabBtn.setAttribute('aria-label', 'Options');
    kebabBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="1.8"></circle>
        <circle cx="12" cy="12" r="1.8"></circle>
        <circle cx="12" cy="19" r="1.8"></circle>
      </svg>
    `;

    const dropdown = document.createElement('div');
    dropdown.className = 'kebab-dropdown';

    // Dropdown item 1: Edit Alert
    const editItem = document.createElement('button');
    editItem.type = 'button';
    editItem.className = 'kebab-item';
    editItem.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
      </svg>
      <span>Edit Alert</span>
    `;

    // Dropdown item 2: Delete
    const deleteItem = document.createElement('button');
    deleteItem.type = 'button';
    deleteItem.className = 'kebab-item delete';
    deleteItem.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span>Delete</span>
    `;

    if (!canManage) {
      editItem.disabled = true;
      editItem.classList.add('disabled');
      editItem.title = 'Only the creator or a board admin can change this';

      deleteItem.disabled = true;
      deleteItem.classList.add('disabled');
      deleteItem.title = 'Only the creator or a board admin can change this';
    } else {
      editItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdown.classList.remove('open');
        try {
          await startEditingAlert(t, alert, 'my-alerts');
        } catch (err) {
          if (err.status === 403) {
            globalErrorMessage = "Only the alert's creator or a board admin can change this alert";
            await loadAndRenderAlerts();
          } else {
            showCardInlineError(card, err.message || 'Failed to edit alert');
          }
        }
      });

      deleteItem.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('open');

        // Inline confirmation on the card
        card.innerHTML = '';
        const confirmBox = document.createElement('div');
        confirmBox.className = 'delete-confirm-box';

        const confirmText = document.createElement('span');
        confirmText.className = 'delete-confirm-text';
        confirmText.textContent = 'Delete this alert? This can’t be undone.';
        confirmBox.appendChild(confirmText);

        const actions = document.createElement('div');
        actions.className = 'delete-confirm-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-outline btn-sm';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
          renderAlertCards();
        });

        const confirmDeleteBtn = document.createElement('button');
        confirmDeleteBtn.type = 'button';
        confirmDeleteBtn.className = 'btn-danger-solid';
        confirmDeleteBtn.textContent = 'Delete';

        confirmDeleteBtn.addEventListener('click', async () => {
          confirmDeleteBtn.disabled = true;
          cancelBtn.disabled = true;
          confirmDeleteBtn.textContent = 'Deleting…';

          try {
            await deleteAlert(t, alert.id);
            allAlerts = allAlerts.filter((a) => a.id !== alert.id);
            renderAlertCards();
          } catch (err) {
            console.error('Delete failed:', err);
            if (err.status === 403) {
              globalErrorMessage = "Only the alert's creator or a board admin can change this alert";
              await loadAndRenderAlerts();
            } else {
              confirmDeleteBtn.disabled = false;
              cancelBtn.disabled = false;
              confirmDeleteBtn.textContent = 'Delete';
              confirmText.textContent = err.message || 'Failed to delete alert. Please try again.';
            }
          }
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmDeleteBtn);
        confirmBox.appendChild(actions);
        card.appendChild(confirmBox);
      });
    }

    dropdown.appendChild(editItem);
    dropdown.appendChild(deleteItem);

    kebabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.kebab-dropdown.open').forEach((d) => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
    });

    kebabWrapper.appendChild(kebabBtn);
    kebabWrapper.appendChild(dropdown);
    topRight.appendChild(kebabWrapper);

    topRow.appendChild(topRight);
    card.appendChild(topRow);

    // --- Bottom Row (Metadata Columns) ---
    // Security: render all Trello-sourced text strictly with textContent
    const metaRow = document.createElement('div');
    metaRow.className = 'alert-card-meta-row';

    // 1. Board
    const boardCol = createMetaColumn(ICONS.board, 'Board', alert.boardName || 'Current Board');
    metaRow.appendChild(boardCol);

    const conditions = alert.conditions || {};

    // 2. Alert type specific fields
    if (alertType === 'stuck-in-list') {
      const listName = conditions.listName || 'Any list';
      const listCol = createMetaColumn(ICONS.list, 'List', listName);
      metaRow.appendChild(listCol);

      const days = conditions.days != null ? conditions.days : 3;
      const daysCol = createMetaColumn(ICONS.calendar, 'Days', `${days} days`);
      metaRow.appendChild(daysCol);
    } else if (alertType === 'no-activity') {
      const days = conditions.days != null ? conditions.days : 5;
      const noActCol = createMetaColumn(ICONS.calendar, 'No activity', `${days} days`);
      metaRow.appendChild(noActCol);

      const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients, currentMember));
      metaRow.appendChild(notifyCol);
    } else if (alertType === 'overdue-in-list') {
      const listName = conditions.listName || 'Any list';
      const listCol = createMetaColumn(ICONS.list, 'List', listName);
      metaRow.appendChild(listCol);

      const condVal = conditions.timing === 'overdue-by-days'
        ? `Overdue by ${conditions.overdueDays || conditions.days || 1} days`
        : 'Overdue';
      const condCol = createMetaColumn(ICONS.condition, 'Condition', condVal);
      metaRow.appendChild(condCol);

      const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients, currentMember));
      metaRow.appendChild(notifyCol);
    } else if (alertType === 'due-soon-unassigned') {
      const dueVal = conditions.timing === 'before-due-date'
        ? `${conditions.dueSoonDays || conditions.days || 2} days`
        : 'Today';
      const dueCol = createMetaColumn(ICONS.calendar, 'Due in', dueVal);
      metaRow.appendChild(dueCol);

      const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients, currentMember));
      metaRow.appendChild(notifyCol);
    } else {
      if (conditions.listName) {
        const listCol = createMetaColumn(ICONS.list, 'List', conditions.listName);
        metaRow.appendChild(listCol);
      }
      if (conditions.days != null) {
        const daysCol = createMetaColumn(ICONS.calendar, 'Days', `${conditions.days} days`);
        metaRow.appendChild(daysCol);
      }
      const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients, currentMember));
      metaRow.appendChild(notifyCol);
    }

    card.appendChild(metaRow);
    container.appendChild(card);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initMyAlertsPage();
});
