import { conditionSchemas } from './conditions-schemas.js';
import { formatFieldValue } from './condition-fields.js';
import { getFrequencyLabel } from './frequency-options.js';
import { TRELLO_LABEL_COLORS } from './filters-editor.js';
import { getAvatarColors, getInitials } from './recipients-editor.js';

/**
 * Builds and renders the Additional Filters summary elements.
 * @param {HTMLElement} container - Element to render chips/lines into.
 * @param {object} filters - The saved filters object from conditions.
 */
export function renderFiltersSummary(container, filters) {
  container.innerHTML = '';

  const hasLabels = filters && Array.isArray(filters.labels) && filters.labels.length > 0;
  const hasMembers = filters && Array.isArray(filters.members) && filters.members.length > 0;
  const hasCustomField = filters && filters.customField && filters.customField.fieldId;

  if (!hasLabels && !hasMembers && !hasCustomField) {
    const noneSpan = document.createElement('span');
    noneSpan.className = 'review-value-muted';
    noneSpan.textContent = 'None';
    container.appendChild(noneSpan);
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
      // Security: render text safely
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
      avatar.setAttribute('aria-hidden', 'true');
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
    cfChip.textContent = `${filters.customField.fieldName}: ${filters.customField.valueLabel}`;
    line.appendChild(cfChip);

    lines.appendChild(line);
  }

  container.appendChild(lines);
}

/**
 * Builds and renders the Notify summary elements.
 * @param {HTMLElement} container - Element to render into.
 * @param {object} recipients - Saved recipients object.
 */
export function renderNotifySummary(container, recipients, currentMember = null) {
  container.innerHTML = '';
  const rec = recipients || { mode: 'me' };

  if (rec.mode === 'me') {
    const isOther = rec.creator && currentMember && rec.creator.id !== currentMember.id;
    const txt = document.createElement('span');
    txt.textContent = isOther ? `Only ${rec.creator.name || 'creator'}` : 'Me only';
    container.appendChild(txt);
  } else if (rec.mode === 'all') {
    const txt = document.createElement('span');
    txt.textContent = 'All board members';
    container.appendChild(txt);
  } else if (rec.mode === 'specific') {
    const memberList = Array.isArray(rec.members) ? rec.members : [];
    if (memberList.length === 0) {
      const txt = document.createElement('span');
      txt.className = 'review-value-muted';
      txt.textContent = 'No members selected';
      container.appendChild(txt);
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
        avatar.setAttribute('aria-hidden', 'true');
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

      container.appendChild(chipsList);
    }
  }
}

/**
 * Generates the complete summary rows (Board, schema fields, Additional filters, Notify, Frequency).
 * Used by both Review and Alert Created pages.
 *
 * @param {object} options
 * @param {HTMLElement} options.container - The table DOM element.
 * @param {object} options.alert - Alert object or draft.
 * @param {string} options.boardName - Name of the board.
 * @param {object} [options.currentMember] - Logged in Trello member info.
 * @returns {Array<object>} List of row descriptor handles with references for attaching editors/actions.
 */
export function renderAlertSummaryRows({ container, alert, boardName, currentMember = null }) {
  container.innerHTML = '';
  const rows = [];

  const conditions = alert.conditions || {};
  const recipients = alert.recipients || { mode: 'me', frequency: 'immediate' };
  const alertType = alert.alertType || conditions.alertType || alert.triggerType;
  const schema = conditionSchemas[alertType] || { fields: [], filters: [] };

  // 1. Board Row (Read-only, no edit link)
  const boardRow = document.createElement('div');
  boardRow.className = 'review-row';

  const boardLabel = document.createElement('div');
  boardLabel.className = 'review-row-label';
  boardLabel.textContent = 'Board';

  const boardVal = document.createElement('div');
  boardVal.className = 'review-row-value';
  boardVal.textContent = boardName || alert.boardName || 'Current Board';

  const boardAction = document.createElement('div');
  boardAction.className = 'review-row-action';

  boardRow.appendChild(boardLabel);
  boardRow.appendChild(boardVal);
  boardRow.appendChild(boardAction);
  container.appendChild(boardRow);

  rows.push({
    id: 'board',
    type: 'board',
    rowElement: boardRow,
    labelElement: boardLabel,
    valueElement: boardVal,
    actionElement: boardAction,
    isEditable: false
  });

  // 2. Schema Fields Rows
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
    valueDisplay.textContent = formatFieldValue(field, conditions);
    rowValue.appendChild(valueDisplay);

    const rowAction = document.createElement('div');
    rowAction.className = 'review-row-action';

    row.appendChild(rowLabel);
    row.appendChild(rowValue);
    row.appendChild(rowAction);
    container.appendChild(row);

    rows.push({
      id: `field-${field.key}`,
      type: 'schema-field',
      field,
      rowElement: row,
      labelElement: rowLabel,
      valueElement: rowValue,
      valueDisplayElement: valueDisplay,
      actionElement: rowAction,
      isEditable: true,
      refreshValue: (currentAlert) => {
        const curCond = currentAlert.conditions || {};
        valueDisplay.textContent = formatFieldValue(field, curCond);
      }
    });
  });

  // 3. Additional Filters Row (only if schema declares filters)
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
    renderFiltersSummary(displayContainer, conditions.filters);

    const filtersAction = document.createElement('div');
    filtersAction.className = 'review-row-action';

    filtersRow.appendChild(filtersLabel);
    filtersRow.appendChild(filtersValue);
    filtersRow.appendChild(filtersAction);
    container.appendChild(filtersRow);

    rows.push({
      id: 'filters',
      type: 'filters',
      rowElement: filtersRow,
      labelElement: filtersLabel,
      valueElement: filtersValue,
      valueDisplayElement: displayContainer,
      actionElement: filtersAction,
      isEditable: true,
      refreshValue: (currentAlert) => {
        const curCond = currentAlert.conditions || {};
        renderFiltersSummary(displayContainer, curCond.filters);
      }
    });
  }

  // 4. Notify Row
  const notifyRow = document.createElement('div');
  notifyRow.className = 'review-row';

  const notifyLabel = document.createElement('div');
  notifyLabel.className = 'review-row-label';
  notifyLabel.textContent = 'Notify';

  const notifyValue = document.createElement('div');
  notifyValue.className = 'review-row-value';

  const notifyDisplay = document.createElement('div');
  notifyValue.appendChild(notifyDisplay);
  renderNotifySummary(notifyDisplay, recipients, currentMember);

  const notifyAction = document.createElement('div');
  notifyAction.className = 'review-row-action';

  notifyRow.appendChild(notifyLabel);
  notifyRow.appendChild(notifyValue);
  notifyRow.appendChild(notifyAction);
  container.appendChild(notifyRow);

  rows.push({
    id: 'notify',
    type: 'notify',
    rowElement: notifyRow,
    labelElement: notifyLabel,
    valueElement: notifyValue,
    valueDisplayElement: notifyDisplay,
    actionElement: notifyAction,
    isEditable: true,
    refreshValue: (currentAlert) => {
      const curRec = currentAlert.recipients || { mode: 'me' };
      renderNotifySummary(notifyDisplay, curRec, currentMember);
    }
  });

  // 5. Notification Frequency Row
  const freqRow = document.createElement('div');
  freqRow.className = 'review-row';

  const freqLabel = document.createElement('div');
  freqLabel.className = 'review-row-label';
  freqLabel.textContent = 'Notification frequency';

  const freqValue = document.createElement('div');
  freqValue.className = 'review-row-value';

  const freqDisplay = document.createElement('div');
  const initialFreq = recipients.frequency || 'immediate';
  freqDisplay.textContent = getFrequencyLabel(initialFreq);
  freqValue.appendChild(freqDisplay);

  const freqAction = document.createElement('div');
  freqAction.className = 'review-row-action';

  freqRow.appendChild(freqLabel);
  freqRow.appendChild(freqValue);
  freqRow.appendChild(freqAction);
  container.appendChild(freqRow);

  rows.push({
    id: 'frequency',
    type: 'frequency',
    rowElement: freqRow,
    labelElement: freqLabel,
    valueElement: freqValue,
    valueDisplayElement: freqDisplay,
    actionElement: freqAction,
    isEditable: true,
    refreshValue: (currentAlert) => {
      const curRec = currentAlert.recipients || {};
      freqDisplay.textContent = getFrequencyLabel(curRec.frequency || 'immediate');
    }
  });

  return rows;
}
