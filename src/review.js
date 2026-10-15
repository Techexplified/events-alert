/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { renderStepper } from './stepper.js';
import { conditionSchemas } from './conditions-schemas.js';
import { summarizeConditions } from './condition-summary.js';
import { fetchBoardData, fetchRecipientData, fetchBoardInfo } from './board-data.js';
import { frequencyOptions, getFrequencyLabel } from './frequency-options.js';
import { renderConditionField, formatFieldValue } from './condition-fields.js';
import { createFiltersEditor, TRELLO_LABEL_COLORS } from './filters-editor.js';
import { createRecipientsEditor, getAvatarColors, getInitials } from './recipients-editor.js';
import { createAlert } from './alerts-api.js';

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

function openConditions() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./conditions.html') : './conditions.html';
  window.location.href = targetUrl;
}

function openRecipients() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./recipients.html') : './recipients.html';
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
        console.log('My Alerts clicked - not yet built');
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
  renderStepper('#stepper-container', 4);
  setupSidebarNav();
  setupCloseButton();

  const container = document.getElementById('review-view-container');
  if (!container) return;

  const draft = await loadDraft();

  // Guards: check missing steps
  if (!draft || !draft.triggerType) {
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

  const alertTypeObj = alertTypes.find((t) => t.id === draft.triggerType) || {
    id: draft.triggerType,
    title: 'Custom Alert',
    description: 'Alert configuration',
    iconBg: '#FEE2E2',
    iconColor: '#EF4444'
  };

  const schema = conditionSchemas[draft.triggerType] || { fields: [], filters: [] };

  // Fetch board info for display
  const boardInfo = await fetchBoardInfo(t);

  // Lazy cache for full board data & recipient data (loaded first time any Edit is opened)
  let lazyBoardData = null;
  let lazyRecipientData = null;
  let isBoardDataLoading = false;

  async function ensureBoardDataLoaded() {
    if (!lazyBoardData) {
      isBoardDataLoading = true;
      const [bd, rd] = await Promise.all([
        fetchBoardData(t),
        fetchRecipientData(t)
      ]);
      lazyBoardData = bd;
      lazyRecipientData = rd;
      isBoardDataLoading = false;
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

  // Table of Rows
  const table = document.createElement('div');
  table.className = 'review-table';
  summaryCard.appendChild(table);
  reviewContainer.appendChild(summaryCard);

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

  // --- ROW: Board (Read-only) ---
  const boardRow = document.createElement('div');
  boardRow.className = 'review-row';

  const boardLabel = document.createElement('div');
  boardLabel.className = 'review-row-label';
  boardLabel.textContent = 'Board';

  const boardVal = document.createElement('div');
  boardVal.className = 'review-row-value';
  boardVal.textContent = boardInfo.name || 'Current Board';

  const boardAction = document.createElement('div');
  boardAction.className = 'review-row-action';

  boardRow.appendChild(boardLabel);
  boardRow.appendChild(boardVal);
  boardRow.appendChild(boardAction);
  table.appendChild(boardRow);

  // --- ROWS: Schema Fields ---
  (schema.fields || []).forEach((field) => {
    const row = document.createElement('div');
    row.className = 'review-row';

    const rowLabel = document.createElement('div');
    rowLabel.className = 'review-row-label';
    rowLabel.textContent = field.label || 'Condition';

    const rowValue = document.createElement('div');
    rowValue.className = 'review-row-value';

    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'review-field-display';
    valueDisplay.textContent = formatFieldValue(field, draft.conditions);
    rowValue.appendChild(valueDisplay);

    const rowAction = document.createElement('div');
    rowAction.className = 'review-row-action';

    const editBtn = createEditButton();
    rowAction.appendChild(editBtn);

    row.appendChild(rowLabel);
    row.appendChild(rowValue);
    row.appendChild(rowAction);
    table.appendChild(row);

    editBtn.addEventListener('click', async () => {
      openEditorsCount++;
      updateCreateAlertButtonState();
      editBtn.setAttribute('aria-expanded', 'true');

      // Replace value display with loading state if board data is not ready
      valueDisplay.style.display = 'none';

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
      rowValue.appendChild(inlineWrapper);

      const { boardData } = await ensureBoardDataLoaded();

      const fieldHandle = renderConditionField({
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

      fieldHandle.focus();

      function closeEditor() {
        inlineWrapper.remove();
        valueDisplay.style.display = 'block';
        editBtn.removeAttribute('aria-expanded');
        editBtn.style.display = 'inline-flex';
        openEditorsCount--;
        updateCreateAlertButtonState();
        editBtn.focus();
      }

      saveBtn.addEventListener('click', async () => {
        const isValid = fieldHandle.validate();
        if (!isValid) return;

        const updatedFieldValues = fieldHandle.getValue();
        draft.conditions = { ...draft.conditions, ...updatedFieldValues };
        await persistDraft(draft);

        valueDisplay.textContent = formatFieldValue(field, draft.conditions);
        refreshBannerDescription();
        closeEditor();
      });

      cancelBtn.addEventListener('click', () => {
        closeEditor();
      });
    });
  });

  // --- ROW: Additional Filters (if schema declares filters) ---
  if (schema.filters && schema.filters.length > 0) {
    const filtersRow = document.createElement('div');
    filtersRow.className = 'review-row';

    const filtersLabel = document.createElement('div');
    filtersLabel.className = 'review-row-label';
    filtersLabel.textContent = 'Additional filters';

    const filtersValue = document.createElement('div');
    filtersValue.className = 'review-row-value';

    const displayContainer = document.createElement('div');
    filtersValue.appendChild(displayContainer);

    function renderFiltersDisplay() {
      displayContainer.innerHTML = '';
      const filters = draft.conditions ? draft.conditions.filters : null;

      const hasLabels = filters && Array.isArray(filters.labels) && filters.labels.length > 0;
      const hasMembers = filters && Array.isArray(filters.members) && filters.members.length > 0;
      const hasCustomField = filters && filters.customField && filters.customField.fieldId;

      if (!hasLabels && !hasMembers && !hasCustomField) {
        const noneSpan = document.createElement('span');
        noneSpan.className = 'review-value-muted';
        noneSpan.textContent = 'None';
        displayContainer.appendChild(noneSpan);
        return;
      }

      const lines = document.createElement('div');
      lines.className = 'filter-summary-lines';

      // 1. Labels line
      if (hasLabels) {
        const line = document.createElement('div');
        line.className = 'filter-summary-line';

        const lineHeader = document.createElement('div');
        lineHeader.className = 'filter-line-header';
        lineHeader.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span>Only cards with label:</span>
        `;
        line.appendChild(lineHeader);

        const chipsList = document.createElement('div');
        chipsList.className = 'filter-chips-list';

        filters.labels.forEach((lbl) => {
          const chip = document.createElement('span');
          chip.className = 'review-chip';

          const swatch = document.createElement('span');
          swatch.className = 'chip-swatch';
          const swatchColor = TRELLO_LABEL_COLORS[lbl.color] || lbl.color || '#CBD5E1';
          swatch.style.backgroundColor = swatchColor;
          chip.appendChild(swatch);

          const txt = document.createElement('span');
          txt.textContent = lbl.name || 'Label';
          chip.appendChild(txt);

          chipsList.appendChild(chip);
        });

        line.appendChild(chipsList);
        lines.appendChild(line);
      }

      // 2. Members line
      if (hasMembers) {
        const line = document.createElement('div');
        line.className = 'filter-summary-line';

        const lineHeader = document.createElement('div');
        lineHeader.className = 'filter-line-header';
        lineHeader.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Only cards with member:</span>
        `;
        line.appendChild(lineHeader);

        const chipsList = document.createElement('div');
        chipsList.className = 'filter-chips-list';

        filters.members.forEach((mem) => {
          const chip = document.createElement('span');
          chip.className = 'review-chip';

          const avatar = document.createElement('span');
          avatar.className = 'chip-avatar';
          const colors = getAvatarColors(mem.id);
          avatar.style.backgroundColor = colors.bg;
          avatar.style.color = colors.text;
          avatar.textContent = getInitials(mem.name, mem.username);
          chip.appendChild(avatar);

          const txt = document.createElement('span');
          txt.textContent = mem.name || 'Member';
          chip.appendChild(txt);

          chipsList.appendChild(chip);
        });

        line.appendChild(chipsList);
        lines.appendChild(line);
      }

      // 3. Custom Field line
      if (hasCustomField) {
        const line = document.createElement('div');
        line.className = 'filter-summary-line';

        const lineHeader = document.createElement('div');
        lineHeader.className = 'filter-line-header';
        lineHeader.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          <span>Only cards with custom field:</span>
        `;
        line.appendChild(lineHeader);

        const cfChip = document.createElement('div');
        cfChip.className = 'review-chip';
        // Security: textContent
        cfChip.textContent = `${filters.customField.fieldName}: ${filters.customField.valueLabel}`;
        line.appendChild(cfChip);

        lines.appendChild(line);
      }

      displayContainer.appendChild(lines);
    }

    renderFiltersDisplay();

    const filtersAction = document.createElement('div');
    filtersAction.className = 'review-row-action';

    const editBtn = createEditButton();
    filtersAction.appendChild(editBtn);

    filtersRow.appendChild(filtersLabel);
    filtersRow.appendChild(filtersValue);
    filtersRow.appendChild(filtersAction);
    table.appendChild(filtersRow);

    editBtn.addEventListener('click', async () => {
      openEditorsCount++;
      updateCreateAlertButtonState();
      editBtn.setAttribute('aria-expanded', 'true');
      displayContainer.style.display = 'none';

      // Expanded Card Editor
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

      filtersValue.appendChild(cardEditor);

      const { boardData } = await ensureBoardDataLoaded();
      editorBody.innerHTML = '';

      const filtersEditor = createFiltersEditor({
        container: editorBody,
        boardData,
        value: draft.conditions ? draft.conditions.filters : null,
        onRetry: async (type) => {
          const fresh = await fetchBoardData(t, { forceRefresh: true });
          lazyBoardData = fresh;
          createFiltersEditor({
            container: editorBody,
            boardData: fresh,
            value: draft.conditions ? draft.conditions.filters : null
          });
        }
      });

      // Move focus to the first control
      const firstInput = cardEditor.querySelector('input, select, button');
      if (firstInput) firstInput.focus();

      function closeEditor() {
        cardEditor.remove();
        displayContainer.style.display = 'block';
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

        renderFiltersDisplay();
        refreshBannerDescription();
        closeEditor();
      });

      cancelBtn.addEventListener('click', () => {
        closeEditor();
      });
    });
  }

  // --- ROW: Notify ---
  const notifyRow = document.createElement('div');
  notifyRow.className = 'review-row';

  const notifyLabel = document.createElement('div');
  notifyLabel.className = 'review-row-label';
  notifyLabel.textContent = 'Notify';

  const notifyValue = document.createElement('div');
  notifyValue.className = 'review-row-value';

  const notifyDisplay = document.createElement('div');
  notifyValue.appendChild(notifyDisplay);

  function renderNotifyDisplay() {
    notifyDisplay.innerHTML = '';
    const rec = draft.recipients || { mode: 'me' };

    if (rec.mode === 'me') {
      const txt = document.createElement('span');
      txt.textContent = 'Me only';
      notifyDisplay.appendChild(txt);
    } else if (rec.mode === 'all') {
      const txt = document.createElement('span');
      txt.textContent = 'All board members';
      notifyDisplay.appendChild(txt);
    } else if (rec.mode === 'specific') {
      const memberList = Array.isArray(rec.members) ? rec.members : [];
      if (memberList.length === 0) {
        const txt = document.createElement('span');
        txt.className = 'review-value-muted';
        txt.textContent = 'No members selected';
        notifyDisplay.appendChild(txt);
      } else {
        const chipsList = document.createElement('div');
        chipsList.className = 'filter-chips-list';

        const visibleMembers = memberList.slice(0, 3);
        visibleMembers.forEach((m) => {
          const chip = document.createElement('span');
          chip.className = 'review-chip';

          const avatar = document.createElement('span');
          avatar.className = 'chip-avatar';
          const colors = getAvatarColors(m.id);
          avatar.style.backgroundColor = colors.bg;
          avatar.style.color = colors.text;
          avatar.textContent = getInitials(m.name, m.username);
          chip.appendChild(avatar);

          const txt = document.createElement('span');
          txt.textContent = m.name || 'Member';
          chip.appendChild(txt);

          chipsList.appendChild(chip);
        });

        if (memberList.length > 3) {
          const moreSpan = document.createElement('span');
          moreSpan.className = 'chip-more';
          moreSpan.textContent = `+${memberList.length - 3} more`;
          chipsList.appendChild(moreSpan);
        }

        notifyDisplay.appendChild(chipsList);
      }
    }
  }

  renderNotifyDisplay();

  const notifyAction = document.createElement('div');
  notifyAction.className = 'review-row-action';

  const notifyEditBtn = createEditButton();
  notifyAction.appendChild(notifyEditBtn);

  notifyRow.appendChild(notifyLabel);
  notifyRow.appendChild(notifyValue);
  notifyRow.appendChild(notifyAction);
  table.appendChild(notifyRow);

  notifyEditBtn.addEventListener('click', async () => {
    openEditorsCount++;
    updateCreateAlertButtonState();
    notifyEditBtn.setAttribute('aria-expanded', 'true');
    notifyDisplay.style.display = 'none';

    // Expanded Card Editor for Notify
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

    notifyValue.appendChild(cardEditor);

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
      notifyDisplay.style.display = 'block';
      notifyEditBtn.removeAttribute('aria-expanded');
      notifyEditBtn.style.display = 'inline-flex';
      openEditorsCount--;
      updateCreateAlertButtonState();
      notifyEditBtn.focus();
    }

    saveBtn.addEventListener('click', async () => {
      const isValid = recEditor.validate();
      if (!isValid) return;

      const newRec = recEditor.getValue();
      draft.recipients = { ...draft.recipients, ...newRec };
      await persistDraft(draft);

      renderNotifyDisplay();
      closeEditor();
    });

    cancelBtn.addEventListener('click', () => {
      closeEditor();
    });
  });

  // --- ROW: Notification Frequency ---
  const freqRow = document.createElement('div');
  freqRow.className = 'review-row';

  const freqLabel = document.createElement('div');
  freqLabel.className = 'review-row-label';
  freqLabel.textContent = 'Notification frequency';

  const freqValue = document.createElement('div');
  freqValue.className = 'review-row-value';

  const freqDisplay = document.createElement('div');
  const currentFreqVal = (draft.recipients && draft.recipients.frequency) ? draft.recipients.frequency : 'immediate';
  freqDisplay.textContent = getFrequencyLabel(currentFreqVal);
  freqValue.appendChild(freqDisplay);

  const freqAction = document.createElement('div');
  freqAction.className = 'review-row-action';

  const freqEditBtn = createEditButton();
  freqAction.appendChild(freqEditBtn);

  freqRow.appendChild(freqLabel);
  freqRow.appendChild(freqValue);
  freqRow.appendChild(freqAction);
  table.appendChild(freqRow);

  freqEditBtn.addEventListener('click', () => {
    openEditorsCount++;
    updateCreateAlertButtonState();
    freqEditBtn.setAttribute('aria-expanded', 'true');
    freqDisplay.style.display = 'none';

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
    freqValue.appendChild(inlineWrapper);

    selectEl.focus();

    function closeEditor() {
      inlineWrapper.remove();
      freqDisplay.style.display = 'block';
      freqEditBtn.removeAttribute('aria-expanded');
      freqEditBtn.style.display = 'inline-flex';
      openEditorsCount--;
      updateCreateAlertButtonState();
      freqEditBtn.focus();
    }

    saveBtn.addEventListener('click', async () => {
      if (!draft.recipients) draft.recipients = {};
      draft.recipients.frequency = selectEl.value;
      await persistDraft(draft);

      freqDisplay.textContent = getFrequencyLabel(selectEl.value);
      closeEditor();
    });

    cancelBtn.addEventListener('click', () => {
      closeEditor();
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

  // --- 3. Footer Actions (Back + Create Alert) ---
  const footerActions = document.createElement('div');
  footerActions.className = 'form-actions-split';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.id = 'btn-back';
  backBtn.className = 'btn-outline';
  backBtn.innerHTML = '&larr; Back';
  backBtn.addEventListener('click', () => {
    openRecipients();
  });
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
  createBtn.textContent = 'Create Alert';

  createBtn.addEventListener('click', async () => {
    if (openEditorsCount > 0) return;

    createErrorSpan.classList.remove('visible');
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';

    try {
      const payload = {
        boardId: boardInfo.id,
        boardName: boardInfo.name,
        alertType: draft.conditions.alertType,
        conditions: draft.conditions,
        recipients: draft.recipients,
        createdAt: new Date().toISOString()
      };

      await createAlert(payload);
      await clearDraft();

      // Render success state
      renderSuccessState();
    } catch (err) {
      console.error('Failed to create alert:', err);
      createErrorSpan.textContent = 'Failed to create alert. Please try again.';
      createErrorSpan.classList.add('visible');
      createBtn.disabled = false;
      createBtn.textContent = 'Create Alert';
    }
  });

  createContainer.appendChild(createBtn);
  footerActions.appendChild(createContainer);
  reviewContainer.appendChild(footerActions);

  container.appendChild(reviewContainer);

  function renderSuccessState() {
    container.innerHTML = `
      <div class="review-success-state">
        <div class="success-icon-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2 class="success-title">Alert created</h2>
        <p class="success-subtext">You can manage or edit it anytime from My Alerts.</p>
        <button id="btn-go-home" class="btn-primary">
          Go to Home
        </button>
      </div>
    `;

    const goHomeBtn = document.getElementById('btn-go-home');
    if (goHomeBtn) {
      goHomeBtn.addEventListener('click', openHome);
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initReviewPage();
});
