/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { renderStepper } from './stepper.js';
import { summarizeConditions } from './condition-summary.js';
import { fetchBoardData, fetchRecipientData, fetchBoardInfo, fetchCurrentMember } from './board-data.js';
import { frequencyOptions, getFrequencyLabel } from './frequency-options.js';
import { renderConditionField } from './condition-fields.js';
import { createFiltersEditor } from './filters-editor.js';
import { createRecipientsEditor } from './recipients-editor.js';
import { createAlert, updateAlert } from './alerts-api.js';
import { renderAlertSummaryRows } from './alert-summary.js';
import { goToMyAlerts } from './navigation.js';
import { TRELLO_APP_KEY, TRELLO_APP_NAME, TRELLO_APP_AUTHOR } from './config.js';
import { NotAuthorizedError, ApiError } from './api-client.js';

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

function openStep1() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./create-alert.html') : './create-alert.html';
  window.location.href = targetUrl;
}

function openConditions() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./conditions.html') : './conditions.html';
  window.location.href = targetUrl;
}

function openRecipients() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./recipients.html') : './recipients.html';
  window.location.href = targetUrl;
}

function openAlertCreated() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./alert-created.html') : './alert-created.html';
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

// Read alert draft from Trello storage or fallback localStorage
async function loadDraft() {
  let draft = null;

  if (t && typeof t.get === 'function') {
    try {
      draft = await t.get('board', 'private', 'alertDraft');
    } catch (err) {
      console.warn('Error reading alertDraft from Trello storage:', err);
    }
  }

  if (!draft) {
    try {
      const stored = localStorage.getItem('alertDraft');
      if (stored) {
        draft = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Error reading alertDraft from localStorage:', err);
    }
  }

  return draft;
}

// Save alert draft to storage
async function persistDraft(draft) {
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

// Helper to create an Edit button with pencil SVG icon
function createEditButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-row-edit';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
    <span>Edit</span>
  `;
  return btn;
}

// Main page setup and rendering
async function initReviewPage() {
  setupSidebarNav();
  setupCloseButton();

  const container = document.getElementById('review-view-container');
  if (!container) return;

  const draft = await loadDraft();

  // Guards: check missing steps (only in non-edit mode)
  const isEditMode = !!(draft && draft.editingAlertId);

  if (!draft || (!draft.triggerType && !draft.alertType)) {
    container.innerHTML = `
      <div class="coming-soon-banner">
        <p style="font-weight: 600; color: var(--text-dark); margin-bottom: 6px;">No alert type selected</p>
        <p style="margin-bottom: 16px;">Please choose an alert type in step 1 before reviewing.</p>
        <button id="btn-guard-step1" class="btn-primary">
          &larr; Back to Step 1
        </button>
      </div>
    `;
    const btn = document.getElementById('btn-guard-step1');
    if (btn) btn.addEventListener('click', openStep1);
    return;
  }

  if (!draft.conditions) {
    container.innerHTML = `
      <div class="coming-soon-banner">
        <p style="font-weight: 600; color: var(--text-dark); margin-bottom: 6px;">No alert conditions found</p>
        <p style="margin-bottom: 16px;">Please configure alert conditions in step 2 before reviewing.</p>
        <button id="btn-guard-conditions" class="btn-primary">
          &larr; Back to Conditions
        </button>
      </div>
    `;
    const btn = document.getElementById('btn-guard-conditions');
    if (btn) btn.addEventListener('click', openConditions);
    return;
  }

  if (!draft.recipients) {
    container.innerHTML = `
      <div class="coming-soon-banner">
        <p style="font-weight: 600; color: var(--text-dark); margin-bottom: 6px;">No recipients selected</p>
        <p style="margin-bottom: 16px;">Please choose recipients in step 3 before reviewing.</p>
        <button id="btn-guard-recipients" class="btn-primary">
          &larr; Back to Recipients
        </button>
      </div>
    `;
    const btn = document.getElementById('btn-guard-recipients');
    if (btn) btn.addEventListener('click', openRecipients);
    return;
  }

  const stepperContainer = document.getElementById('stepper-container');
  const pageTitleEl = document.querySelector('.content-title');
  const pageSubtitleEl = document.querySelector('.content-subtitle');

  if (isEditMode) {
    if (stepperContainer) stepperContainer.style.display = 'none';
    if (pageTitleEl) pageTitleEl.textContent = 'Edit alert';
    if (pageSubtitleEl) pageSubtitleEl.textContent = 'Update your alert settings, then save.';
  } else {
    renderStepper('#stepper-container', 4);
    if (pageTitleEl) pageTitleEl.textContent = 'Review and create';
    if (pageSubtitleEl) pageSubtitleEl.textContent = 'Please confirm your alert settings.';
  }

  const triggerType = draft.alertType || (draft.conditions && draft.conditions.alertType) || draft.triggerType;
  const alertTypeObj = alertTypes.find((t) => t.id === triggerType) || {
    id: triggerType,
    title: 'Custom Alert',
    description: 'Alert configuration',
    iconBg: '#FEE2E2',
    iconColor: '#EF4444'
  };

  // Fetch board info and current member for display
  const [boardInfo, currentMember] = await Promise.all([
    fetchBoardInfo(t),
    fetchCurrentMember(t)
  ]);

  // Lazy cache for full board data & recipient data (loaded first time any Edit is opened)
  let lazyBoardData = null;
  let lazyRecipientData = null;

  async function ensureBoardDataLoaded() {
    if (!lazyBoardData) {
      const [bd, rd] = await Promise.all([
        fetchBoardData(t),
        fetchRecipientData(t)
      ]);
      lazyBoardData = bd;
      lazyRecipientData = rd;
    }
    return { boardData: lazyBoardData, recipientData: lazyRecipientData };
  }

  // Clear container
  container.innerHTML = '';

  const reviewContainer = document.createElement('div');
  reviewContainer.className = 'review-container';

  // --- 1. Summary Card ---
  const summaryCard = document.createElement('div');
  summaryCard.className = 'review-card';

  // Banner at top of card
  const banner = document.createElement('div');
  banner.className = 'alert-type-banner';

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'alert-icon-wrapper';
  iconWrapper.style.backgroundColor = alertTypeObj.iconBg;
  iconWrapper.innerHTML = getIconSvg(alertTypeObj.id, alertTypeObj.iconColor);
  banner.appendChild(iconWrapper);

  const bannerInfo = document.createElement('div');
  bannerInfo.className = 'banner-info';

  const bannerTitle = document.createElement('h3');
  bannerTitle.className = 'banner-title';
  bannerTitle.textContent = alertTypeObj.title;
  bannerInfo.appendChild(bannerTitle);

  const bannerDesc = document.createElement('p');
  bannerDesc.className = 'banner-description';
  bannerDesc.textContent = summarizeConditions(draft);
  bannerInfo.appendChild(bannerDesc);

  banner.appendChild(bannerInfo);
  summaryCard.appendChild(banner);

  function refreshBannerDescription() {
    bannerDesc.textContent = summarizeConditions(draft);
  }

  // Table of Rows rendered via shared alert-summary.js
  const table = document.createElement('div');
  table.className = 'review-table';
  summaryCard.appendChild(table);
  reviewContainer.appendChild(summaryCard);

  // Render shared summary rows
  const summaryRows = renderAlertSummaryRows({
    container: table,
    alert: draft,
    boardName: boardInfo.name,
    currentMember
  });

  // Track open editors
  let openEditorsCount = 0;
  function updateCreateAlertButtonState() {
    const btn = document.getElementById('btn-create-alert');
    const hint = document.getElementById('create-alert-hint');
    if (btn) {
      btn.disabled = openEditorsCount > 0;
    }
    if (hint) {
      hint.style.display = openEditorsCount > 0 ? 'block' : 'none';
    }
  }

  // Attach inline editors to all editable rows
  summaryRows.forEach((rowHandle) => {
    if (!rowHandle.isEditable) return;

    const editBtn = createEditButton();
    rowHandle.actionElement.appendChild(editBtn);

    editBtn.addEventListener('click', async () => {
      openEditorsCount++;
      updateCreateAlertButtonState();
      editBtn.setAttribute('aria-expanded', 'true');

      if (rowHandle.valueDisplayElement) {
        rowHandle.valueDisplayElement.style.display = 'none';
      }

      // 1. Schema field inline editor
      if (rowHandle.type === 'schema-field') {
        const field = rowHandle.field;

        const inlineWrapper = document.createElement('div');
        inlineWrapper.className = 'inline-edit-wrapper';

        const controlWrap = document.createElement('div');
        controlWrap.className = 'inline-edit-control';
        controlWrap.innerHTML = '<span class="review-value-muted">Loading options...</span>';
        inlineWrapper.appendChild(controlWrap);

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'inline-edit-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-primary btn-sm';
        saveBtn.textContent = 'Save';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-outline btn-sm';
        cancelBtn.textContent = 'Cancel';

        actionsWrap.appendChild(saveBtn);
        actionsWrap.appendChild(cancelBtn);
        inlineWrapper.appendChild(actionsWrap);
        rowHandle.valueElement.appendChild(inlineWrapper);

        const { boardData } = await ensureBoardDataLoaded();

        const fieldControl = renderConditionField({
          field,
          container: controlWrap,
          boardData,
          value: draft.conditions,
          isInline: true,
          onRetry: async () => {
            const fresh = await fetchBoardData(t, { forceRefresh: true });
            lazyBoardData = fresh;
            renderConditionField({
              field,
              container: controlWrap,
              boardData: fresh,
              value: draft.conditions,
              isInline: true
            });
          }
        });

        fieldControl.focus();

        function closeEditor() {
          inlineWrapper.remove();
          if (rowHandle.valueDisplayElement) rowHandle.valueDisplayElement.style.display = 'block';
          editBtn.removeAttribute('aria-expanded');
          editBtn.style.display = 'inline-flex';
          openEditorsCount--;
          updateCreateAlertButtonState();
          editBtn.focus();
        }

        saveBtn.addEventListener('click', async () => {
          const isValid = fieldControl.validate();
          if (!isValid) return;

          const updatedFieldValues = fieldControl.getValue();
          draft.conditions = { ...draft.conditions, ...updatedFieldValues };
          await persistDraft(draft);

          rowHandle.refreshValue(draft);
          refreshBannerDescription();
          closeEditor();
        });

        cancelBtn.addEventListener('click', () => {
          closeEditor();
        });
      }

      // 2. Additional filters expanded card editor
      else if (rowHandle.type === 'filters') {
        const cardEditor = document.createElement('div');
        cardEditor.className = 'expanded-card-editor';

        const header = document.createElement('div');
        header.className = 'expanded-card-header';
        const title = document.createElement('h4');
        title.className = 'expanded-card-title';
        title.textContent = 'Additional filters (optional)';
        const sub = document.createElement('p');
        sub.className = 'expanded-card-subtitle';
        sub.textContent = 'Narrow down which cards should trigger this alert.';
        header.appendChild(title);
        header.appendChild(sub);
        cardEditor.appendChild(header);

        const editorBody = document.createElement('div');
        editorBody.innerHTML = '<div class="conditions-loading"><div class="loading-spinner"></div><span>Loading filters...</span></div>';
        cardEditor.appendChild(editorBody);

        const actions = document.createElement('div');
        actions.className = 'expanded-card-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-primary';
        saveBtn.textContent = 'Save';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-outline';
        cancelBtn.textContent = 'Cancel';

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        cardEditor.appendChild(actions);

        rowHandle.valueElement.appendChild(cardEditor);

        const { boardData } = await ensureBoardDataLoaded();
        editorBody.innerHTML = '';

        const filtersEditor = createFiltersEditor({
          container: editorBody,
          boardData,
          value: draft.conditions ? draft.conditions.filters : null,
          onRetry: async () => {
            const fresh = await fetchBoardData(t, { forceRefresh: true });
            lazyBoardData = fresh;
            createFiltersEditor({
              container: editorBody,
              boardData: fresh,
              value: draft.conditions ? draft.conditions.filters : null
            });
          }
        });

        const firstInput = cardEditor.querySelector('input, select, button');
        if (firstInput) firstInput.focus();

        function closeEditor() {
          cardEditor.remove();
          if (rowHandle.valueDisplayElement) rowHandle.valueDisplayElement.style.display = 'block';
          editBtn.removeAttribute('aria-expanded');
          editBtn.style.display = 'inline-flex';
          openEditorsCount--;
          updateCreateAlertButtonState();
          editBtn.focus();
        }

        saveBtn.addEventListener('click', async () => {
          const isValid = filtersEditor.validate();
          if (!isValid) return;

          draft.conditions.filters = filtersEditor.getValue();
          await persistDraft(draft);

          rowHandle.refreshValue(draft);
          refreshBannerDescription();
          closeEditor();
        });

        cancelBtn.addEventListener('click', () => {
          closeEditor();
        });
      }

      // 3. Notify expanded card editor
      else if (rowHandle.type === 'notify') {
        const cardEditor = document.createElement('div');
        cardEditor.className = 'expanded-card-editor';

        const header = document.createElement('div');
        header.className = 'expanded-card-header';
        const title = document.createElement('h4');
        title.className = 'expanded-card-title';
        title.textContent = 'Notify';
        const sub = document.createElement('p');
        sub.className = 'expanded-card-subtitle';
        sub.textContent = 'Choose who should receive the alert.';
        header.appendChild(title);
        header.appendChild(sub);
        cardEditor.appendChild(header);

        const editorBody = document.createElement('div');
        editorBody.innerHTML = '<div class="conditions-loading"><div class="loading-spinner"></div><span>Loading recipient options...</span></div>';
        cardEditor.appendChild(editorBody);

        const actions = document.createElement('div');
        actions.className = 'expanded-card-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-primary';
        saveBtn.textContent = 'Save';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-outline';
        cancelBtn.textContent = 'Cancel';

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        cardEditor.appendChild(actions);

        rowHandle.valueElement.appendChild(cardEditor);

        const { recipientData } = await ensureBoardDataLoaded();
        editorBody.innerHTML = '';

        const recEditor = createRecipientsEditor({
          container: editorBody,
          members: recipientData.members,
          me: recipientData.me,
          value: draft.recipients,
          onRetryMembers: async () => {
            const fresh = await fetchRecipientData(t, { forceRefresh: true });
            lazyRecipientData = fresh;
            createRecipientsEditor({
              container: editorBody,
              members: fresh.members,
              me: fresh.me,
              value: draft.recipients
            });
          }
        });

        const firstInput = cardEditor.querySelector('input, select, button');
        if (firstInput) firstInput.focus();

        function closeEditor() {
          cardEditor.remove();
          if (rowHandle.valueDisplayElement) rowHandle.valueDisplayElement.style.display = 'block';
          editBtn.removeAttribute('aria-expanded');
          editBtn.style.display = 'inline-flex';
          openEditorsCount--;
          updateCreateAlertButtonState();
          editBtn.focus();
        }

        saveBtn.addEventListener('click', async () => {
          const isValid = recEditor.validate();
          if (!isValid) return;

          const newRec = recEditor.getValue();
          draft.recipients = { ...draft.recipients, ...newRec };
          await persistDraft(draft);

          rowHandle.refreshValue(draft);
          closeEditor();
        });

        cancelBtn.addEventListener('click', () => {
          closeEditor();
        });
      }

      // 4. Notification frequency inline editor
      else if (rowHandle.type === 'frequency') {
        const inlineWrapper = document.createElement('div');
        inlineWrapper.className = 'inline-edit-wrapper';

        const selectWrap = document.createElement('div');
        selectWrap.className = 'select-wrapper inline-edit-control';

        const selectEl = document.createElement('select');
        selectEl.className = 'form-select';

        frequencyOptions.forEach((opt) => {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (draft.recipients && draft.recipients.frequency === opt.value) {
            o.selected = true;
          }
          selectEl.appendChild(o);
        });

        selectWrap.appendChild(selectEl);

        const chevron = document.createElement('span');
        chevron.className = 'select-chevron';
        chevron.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        `;
        selectWrap.appendChild(chevron);
        inlineWrapper.appendChild(selectWrap);

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'inline-edit-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-primary btn-sm';
        saveBtn.textContent = 'Save';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-outline btn-sm';
        cancelBtn.textContent = 'Cancel';

        actionsWrap.appendChild(saveBtn);
        actionsWrap.appendChild(cancelBtn);
        inlineWrapper.appendChild(actionsWrap);
        rowHandle.valueElement.appendChild(inlineWrapper);

        selectEl.focus();

        function closeEditor() {
          inlineWrapper.remove();
          if (rowHandle.valueDisplayElement) rowHandle.valueDisplayElement.style.display = 'block';
          editBtn.removeAttribute('aria-expanded');
          editBtn.style.display = 'inline-flex';
          openEditorsCount--;
          updateCreateAlertButtonState();
          editBtn.focus();
        }

        saveBtn.addEventListener('click', async () => {
          if (!draft.recipients) draft.recipients = {};
          draft.recipients.frequency = selectEl.value;
          await persistDraft(draft);

          rowHandle.refreshValue(draft);
          closeEditor();
        });

        cancelBtn.addEventListener('click', () => {
          closeEditor();
        });
      }
    });
  });

  // --- 2. Info Box: What happens next? ---
  const infoBox = document.createElement('div');
  infoBox.className = 'review-info-box';

  const infoIcon = document.createElement('div');
  infoIcon.className = 'review-info-icon';
  infoIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  `;
  infoBox.appendChild(infoIcon);

  const infoContent = document.createElement('div');
  infoContent.className = 'review-info-content';

  const infoTitle = document.createElement('h4');
  infoTitle.className = 'review-info-title';
  infoTitle.textContent = 'What happens next?';
  infoContent.appendChild(infoTitle);

  const infoText = document.createElement('p');
  infoText.className = 'review-info-text';
  infoText.textContent = 'We will monitor your cards and send an email alert when the condition is met. You can manage or edit this alert anytime from My Alerts.';
  infoContent.appendChild(infoText);

  infoBox.appendChild(infoContent);
  reviewContainer.appendChild(infoBox);

  // --- 3. Footer Actions (Back / Cancel + Create Alert / Save changes) ---
  const footerActions = document.createElement('div');
  footerActions.className = 'form-actions-split';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.id = 'btn-back';
  backBtn.className = 'btn-outline';

  if (isEditMode) {
    backBtn.textContent = 'Cancel';
    backBtn.addEventListener('click', async () => {
      const returnTo = draft.returnTo || 'my-alerts';
      await clearDraft();
      if (returnTo === 'alert-created') {
        openAlertCreated();
      } else {
        goToMyAlerts(t);
      }
    });
  } else {
    backBtn.innerHTML = '&larr; Back';
    backBtn.addEventListener('click', () => {
      openRecipients();
    });
  }

  footerActions.appendChild(backBtn);

  const createContainer = document.createElement('div');
  createContainer.className = 'create-action-container';

  const createErrorSpan = document.createElement('span');
  createErrorSpan.className = 'error-message';
  createContainer.appendChild(createErrorSpan);

  const hintText = document.createElement('span');
  hintText.id = 'create-alert-hint';
  hintText.className = 'create-hint-text';
  hintText.textContent = 'Save or cancel your changes first';
  createContainer.appendChild(hintText);

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.id = 'btn-create-alert';
  createBtn.className = 'btn-primary';
  createBtn.textContent = isEditMode ? 'Save changes' : 'Create Alert';

  createBtn.addEventListener('click', async () => {
    if (openEditorsCount > 0) return;

    createErrorSpan.classList.remove('visible');
    createBtn.disabled = true;

    if (isEditMode) {
      createBtn.textContent = 'Saving…';
      try {
        const updatedAlert = await updateAlert(t, draft.editingAlertId, {
          conditions: draft.conditions,
          recipients: draft.recipients
        });

        const alertId = updatedAlert?.id || draft.editingAlertId;
        const pointer = { alertId, savedAs: 'updated' };
        if (t && typeof t.set === 'function') {
          try {
            await t.set('board', 'private', 'lastSavedAlert', pointer);
          } catch (e) {}
        }
        try {
          localStorage.setItem('lastSavedAlert', JSON.stringify(pointer));
        } catch (e) {}

        await clearDraft();
        openAlertCreated();
      } catch (err) {
        console.error('Failed to update alert:', err);
        const errorMsg = (err instanceof NotAuthorizedError)
          ? 'Please connect your Trello account to save changes.'
          : (err.message || 'Failed to update alert. Please try again.');
        createErrorSpan.textContent = errorMsg;
        createErrorSpan.classList.add('visible');
        createBtn.disabled = false;
        createBtn.textContent = 'Save changes';
      }
    } else {
      createBtn.textContent = 'Creating…';
      try {
        const payload = {
          boardId: boardInfo.id,
          boardName: boardInfo.name,
          alertType: draft.conditions?.alertType || triggerType,
          conditions: draft.conditions,
          recipients: draft.recipients
        };

        const createdAlert = await createAlert(t, payload);

        const pointer = { alertId: createdAlert.id, savedAs: 'created' };
        if (t && typeof t.set === 'function') {
          try {
            await t.set('board', 'private', 'lastSavedAlert', pointer);
          } catch (e) {}
        }
        try {
          localStorage.setItem('lastSavedAlert', JSON.stringify(pointer));
        } catch (e) {}

        await clearDraft();
        openAlertCreated();
      } catch (err) {
        console.error('Failed to create alert:', err);
        const errorMsg = (err instanceof NotAuthorizedError)
          ? 'Please connect your Trello account to create an alert.'
          : (err.message || 'Failed to create alert. Please try again.');
        createErrorSpan.textContent = errorMsg;
        createErrorSpan.classList.add('visible');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Alert';
      }
    }
  });

  createContainer.appendChild(createBtn);
  footerActions.appendChild(createContainer);
  reviewContainer.appendChild(footerActions);

  container.appendChild(reviewContainer);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initReviewPage();
});
