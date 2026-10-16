/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { summarizeConditions } from './condition-summary.js';
import { getAlerts, toggleAlertStatus, deleteAlert } from './alerts-api.js';

// Initialize the Trello Power-Up iframe connector safely
const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
const t = typeof window.TrelloPowerUp !== 'undefined' && isInsideIframe ? window.TrelloPowerUp.iframe() : null;

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
function formatRecipientSummary(recipients) {
  if (!recipients) return 'Me only';
  if (recipients.mode === 'me') return 'Me only';
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

// Helper to create metadata column element securely
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
  valEl.textContent = value;
  infoEl.appendChild(valEl);

  col.appendChild(infoEl);
  return col;
}

// Main page setup and rendering
async function initMyAlertsPage() {
  setupSidebarNav();
  setupCloseButton();

  // Top "+ Create Alert" button listener
  const topCreateBtn = document.getElementById('btn-create-alert-top');
  if (topCreateBtn) {
    topCreateBtn.addEventListener('click', openCreateAlert);
  }

  const container = document.getElementById('alerts-list-container');
  if (!container) return;

  let allAlerts = await getAlerts(t);
  let currentTab = 'all'; // 'all' | 'active' | 'paused'

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

  function renderAlertCards() {
    container.innerHTML = '';
    updateTabCounts();

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
        ? 'No alerts created yet'
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
      topRight.appendChild(toggleLabel);

      // Status Pill
      const statusPill = document.createElement('span');
      const isInitialActive = alert.status === 'active';
      statusPill.className = isInitialActive ? 'status-pill-active' : 'status-pill-paused';
      statusPill.textContent = isInitialActive ? 'Active' : 'Paused';
      topRight.appendChild(statusPill);

      toggleInput.addEventListener('change', async () => {
        const newStatus = await toggleAlertStatus(alert.id, t);
        alert.status = newStatus;
        const isActive = newStatus === 'active';

        statusPill.className = isActive ? 'status-pill-active' : 'status-pill-paused';
        statusPill.textContent = isActive ? 'Active' : 'Paused';

        updateTabCounts();

        // If tab is currently active or paused, smoothly remove card from current view
        if (currentTab !== 'all') {
          card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.98)';
          setTimeout(() => {
            renderAlertCards();
          }, 200);
        }
      });

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
      editItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdown.classList.remove('open');

        // Load into draft with editingAlertId and open Review in edit mode
        const editDraft = {
          alertType: alert.alertType,
          conditions: alert.conditions,
          recipients: alert.recipients,
          editingAlertId: alert.id
        };

        if (t && typeof t.set === 'function') {
          try {
            await t.set('board', 'private', 'alertDraft', editDraft);
          } catch (err) {}
        }
        try {
          localStorage.setItem('alertDraft', JSON.stringify(editDraft));
        } catch (err) {}

        openReview();
      });

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
          confirmDeleteBtn.textContent = 'Deleting…';
          await deleteAlert(alert.id, t);
          allAlerts = allAlerts.filter((a) => a.id !== alert.id);
          renderAlertCards();
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmDeleteBtn);
        confirmBox.appendChild(actions);
        card.appendChild(confirmBox);
      });

      dropdown.appendChild(editItem);
      dropdown.appendChild(deleteItem);

      kebabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close any other open dropdowns first
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
      const metaRow = document.createElement('div');
      metaRow.className = 'alert-card-meta-row';

      // 1. Board
      const boardCol = createMetaColumn(ICONS.board, 'Board', alert.boardName || 'Product Development');
      metaRow.appendChild(boardCol);

      const conditions = alert.conditions || {};

      // 2. Alert type specific fields
      if (alertType === 'stuck-in-list') {
        const listName = conditions.listName || 'In Progress';
        const listCol = createMetaColumn(ICONS.list, 'List', listName);
        metaRow.appendChild(listCol);

        const days = conditions.days || 3;
        const daysCol = createMetaColumn(ICONS.calendar, 'Days', `${days} days`);
        metaRow.appendChild(daysCol);
      } else if (alertType === 'no-activity') {
        const days = conditions.days || 5;
        const noActCol = createMetaColumn(ICONS.calendar, 'No activity', `${days} days`);
        metaRow.appendChild(noActCol);

        const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients));
        metaRow.appendChild(notifyCol);
      } else if (alertType === 'overdue-in-list') {
        const listName = conditions.listName || 'On Hold';
        const listCol = createMetaColumn(ICONS.list, 'List', listName);
        metaRow.appendChild(listCol);

        const condVal = conditions.timing === 'overdue-by-days'
          ? `Overdue by ${conditions.overdueDays || conditions.days || 1} days`
          : 'Overdue';
        const condCol = createMetaColumn(ICONS.condition, 'Condition', condVal);
        metaRow.appendChild(condCol);

        const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients));
        metaRow.appendChild(notifyCol);
      } else if (alertType === 'due-soon-unassigned') {
        const dueVal = conditions.timing === 'before-due-date'
          ? `${conditions.dueSoonDays || conditions.days || 2} days`
          : 'Today';
        const dueCol = createMetaColumn(ICONS.calendar, 'Due in', dueVal);
        metaRow.appendChild(dueCol);

        const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients));
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
        const notifyCol = createMetaColumn(ICONS.notify, 'Notify', formatRecipientSummary(alert.recipients));
        metaRow.appendChild(notifyCol);
      }

      card.appendChild(metaRow);
      container.appendChild(card);
    });
  }

  // Initial render
  renderAlertCards();

  // Document click listener to close kebab dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.kebab-wrapper')) {
      document.querySelectorAll('.kebab-dropdown.open').forEach((d) => d.classList.remove('open'));
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initMyAlertsPage();
});
