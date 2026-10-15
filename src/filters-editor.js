import { createMultiSelect } from './multi-select.js';

// Trello color palette mapping for label swatches
export const TRELLO_LABEL_COLORS = {
  green: '#61BD4F',
  yellow: '#F2D600',
  orange: '#FF9F1A',
  red: '#EB5A46',
  purple: '#C377E0',
  blue: '#0079BF',
  sky: '#00C2E0',
  lime: '#51E898',
  pink: '#FF78CB',
  black: '#344563',
  default: '#B3BAC5'
};

/**
 * Creates the Additional Filters UI (labels, members, custom fields).
 *
 * @param {object} options
 * @param {HTMLElement} options.container - Container element to render into.
 * @param {object} options.boardData - { labels, members, customFields }.
 * @param {object} [options.value] - Existing filter values { labels, members, customField }.
 * @param {function} [options.onRetry] - Callback when retry is clicked for failed data.
 * @returns {object} { getValue(), validate(), destroy() }
 */
export function createFiltersEditor({
  container,
  boardData = {},
  value = {},
  onRetry = null
}) {
  if (!container) throw new Error('createFiltersEditor: container is required');

  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'filters-section';

  const { labels, members, customFields } = boardData;
  const initialFilters = value || {};

  // State handles
  let labelMultiSelect = null;
  let memberMultiSelect = null;

  // --- Row 1: Labels Filter ---
  const labelCard = document.createElement('div');
  labelCard.className = 'filter-card disabled';

  const labelHeader = document.createElement('div');
  labelHeader.className = 'filter-card-header';

  const labelLabelWrap = document.createElement('label');
  labelLabelWrap.className = 'filter-card-label-wrap';

  const labelCheckboxEl = document.createElement('input');
  labelCheckboxEl.type = 'checkbox';
  labelCheckboxEl.className = 'filter-checkbox';

  const labelIcon = document.createElement('span');
  labelIcon.className = 'filter-icon';
  labelIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
      <line x1="7" y1="7" x2="7.01" y2="7"></line>
    </svg>
  `;

  const labelTitle = document.createElement('span');
  labelTitle.className = 'filter-title';
  labelTitle.textContent = 'Only cards with a specific label';

  labelLabelWrap.appendChild(labelCheckboxEl);
  labelLabelWrap.appendChild(labelIcon);
  labelLabelWrap.appendChild(labelTitle);
  labelHeader.appendChild(labelLabelWrap);

  const labelControls = document.createElement('div');
  labelControls.className = 'filter-controls';

  const labelMultiContainer = document.createElement('div');
  labelControls.appendChild(labelMultiContainer);
  labelHeader.appendChild(labelControls);
  labelCard.appendChild(labelHeader);

  const labelError = document.createElement('span');
  labelError.className = 'error-message';
  labelError.style.paddingLeft = '28px';
  labelError.textContent = 'Select at least one label';
  labelCard.appendChild(labelError);

  if (labels === null) {
    labelCheckboxEl.disabled = true;
    const note = document.createElement('div');
    note.className = 'filter-notice';
    note.textContent = 'Labels unavailable on this board';
    if (onRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-retry';
      retryBtn.style.marginLeft = '8px';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => onRetry('labels'));
      note.appendChild(retryBtn);
    }
    labelCard.appendChild(note);
  }

  root.appendChild(labelCard);

  const labelOptions = (labels || []).map((lbl) => ({
    id: lbl.id,
    label:
      lbl.name && lbl.name.trim().length > 0
        ? lbl.name
        : lbl.color
        ? lbl.color.charAt(0).toUpperCase() + lbl.color.slice(1)
        : 'Unnamed label',
    swatch: TRELLO_LABEL_COLORS[lbl.color] || lbl.color || '#CBD5E1'
  }));

  labelMultiSelect = createMultiSelect({
    container: labelMultiContainer,
    placeholder: 'Select labels',
    options: labelOptions,
    selectedIds: [],
    onChange: () => {
      labelError.classList.remove('visible');
    }
  });
  labelMultiSelect.setDisabled(true);

  labelCheckboxEl.addEventListener('change', () => {
    if (labelCheckboxEl.checked) {
      labelCard.classList.remove('disabled');
      labelMultiSelect.setDisabled(false);
    } else {
      labelCard.classList.add('disabled');
      labelMultiSelect.setDisabled(true);
      labelError.classList.remove('visible');
    }
  });

  // --- Row 2: Members Filter ---
  const memberCard = document.createElement('div');
  memberCard.className = 'filter-card disabled';

  const memberHeader = document.createElement('div');
  memberHeader.className = 'filter-card-header';

  const memberLabelWrap = document.createElement('label');
  memberLabelWrap.className = 'filter-card-label-wrap';

  const memberCheckboxEl = document.createElement('input');
  memberCheckboxEl.type = 'checkbox';
  memberCheckboxEl.className = 'filter-checkbox';

  const memberIcon = document.createElement('span');
  memberIcon.className = 'filter-icon';
  memberIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  `;

  const memberTitle = document.createElement('span');
  memberTitle.className = 'filter-title';
  memberTitle.textContent = 'Only cards with a specific member';

  memberLabelWrap.appendChild(memberCheckboxEl);
  memberLabelWrap.appendChild(memberIcon);
  memberLabelWrap.appendChild(memberTitle);
  memberHeader.appendChild(memberLabelWrap);

  const memberControls = document.createElement('div');
  memberControls.className = 'filter-controls';

  const memberMultiContainer = document.createElement('div');
  memberControls.appendChild(memberMultiContainer);
  memberHeader.appendChild(memberControls);
  memberCard.appendChild(memberHeader);

  const memberError = document.createElement('span');
  memberError.className = 'error-message';
  memberError.style.paddingLeft = '28px';
  memberError.textContent = 'Select at least one member';
  memberCard.appendChild(memberError);

  if (members === null) {
    memberCheckboxEl.disabled = true;
    const note = document.createElement('div');
    note.className = 'filter-notice';
    note.textContent = 'Members unavailable on this board';
    if (onRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-retry';
      retryBtn.style.marginLeft = '8px';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => onRetry('members'));
      note.appendChild(retryBtn);
    }
    memberCard.appendChild(note);
  }

  root.appendChild(memberCard);

  const memberOptions = (members || []).map((m) => ({
    id: m.id,
    label: m.fullName || m.name || m.username || 'Member',
    swatch: null
  }));

  memberMultiSelect = createMultiSelect({
    container: memberMultiContainer,
    placeholder: 'Select members',
    options: memberOptions,
    selectedIds: [],
    onChange: () => {
      memberError.classList.remove('visible');
    }
  });
  memberMultiSelect.setDisabled(true);

  memberCheckboxEl.addEventListener('change', () => {
    if (memberCheckboxEl.checked) {
      memberCard.classList.remove('disabled');
      memberMultiSelect.setDisabled(false);
    } else {
      memberCard.classList.add('disabled');
      memberMultiSelect.setDisabled(true);
      memberError.classList.remove('visible');
    }
  });

  // --- Row 3: Custom Field Filter ---
  const cfCard = document.createElement('div');
  cfCard.className = 'filter-card disabled';

  const cfHeader = document.createElement('div');
  cfHeader.className = 'filter-card-header';

  const cfLabelWrap = document.createElement('label');
  cfLabelWrap.className = 'filter-card-label-wrap';

  const customFieldCheckboxEl = document.createElement('input');
  customFieldCheckboxEl.type = 'checkbox';
  customFieldCheckboxEl.className = 'filter-checkbox';

  const cfIcon = document.createElement('span');
  cfIcon.className = 'filter-icon';
  cfIcon.innerHTML = `
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
  `;

  const cfTitle = document.createElement('span');
  cfTitle.className = 'filter-title';
  cfTitle.textContent = 'Only cards with a specific custom field';

  cfLabelWrap.appendChild(customFieldCheckboxEl);
  cfLabelWrap.appendChild(cfIcon);
  cfLabelWrap.appendChild(cfTitle);
  cfHeader.appendChild(cfLabelWrap);
  cfCard.appendChild(cfHeader);

  const cfRow = document.createElement('div');
  cfRow.className = 'filter-custom-fields-row';

  // Field Select
  const cfFieldWrap = document.createElement('div');
  cfFieldWrap.className = 'select-wrapper';

  const customFieldSelectEl = document.createElement('select');
  customFieldSelectEl.className = 'form-select';
  customFieldSelectEl.disabled = true;

  const defaultCfOpt = document.createElement('option');
  defaultCfOpt.value = '';
  defaultCfOpt.textContent = 'Select custom field';
  defaultCfOpt.disabled = true;
  defaultCfOpt.selected = true;
  customFieldSelectEl.appendChild(defaultCfOpt);

  const supportedCustomFields = (customFields || []).filter((f) => {
    return f.type === 'list' || f.type === 'checkbox';
  });

  supportedCustomFields.forEach((cf) => {
    const opt = document.createElement('option');
    opt.value = cf.id;
    // Security: render text safely
    opt.textContent = cf.name;
    customFieldSelectEl.appendChild(opt);
  });

  cfFieldWrap.appendChild(customFieldSelectEl);

  const cfFieldChevron = document.createElement('span');
  cfFieldChevron.className = 'select-chevron';
  cfFieldChevron.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  cfFieldWrap.appendChild(cfFieldChevron);
  cfRow.appendChild(cfFieldWrap);

  // Value Select
  const cfValueWrap = document.createElement('div');
  cfValueWrap.className = 'select-wrapper';

  const customFieldValueSelectEl = document.createElement('select');
  customFieldValueSelectEl.className = 'form-select';
  customFieldValueSelectEl.disabled = true;

  const defaultCfValueOpt = document.createElement('option');
  defaultCfValueOpt.value = '';
  defaultCfValueOpt.textContent = 'Select value';
  defaultCfValueOpt.disabled = true;
  defaultCfValueOpt.selected = true;
  customFieldValueSelectEl.appendChild(defaultCfValueOpt);

  cfValueWrap.appendChild(customFieldValueSelectEl);

  const cfValueChevron = document.createElement('span');
  cfValueChevron.className = 'select-chevron';
  cfValueChevron.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  cfValueWrap.appendChild(cfValueChevron);
  cfRow.appendChild(cfValueWrap);

  cfCard.appendChild(cfRow);

  const cfError = document.createElement('span');
  cfError.className = 'error-message';
  cfError.style.paddingLeft = '28px';
  cfError.textContent = 'Select a custom field and value';
  cfCard.appendChild(cfError);

  if (customFields === null) {
    customFieldCheckboxEl.disabled = true;
    const note = document.createElement('div');
    note.className = 'filter-notice';
    note.textContent = 'Enable the Custom Fields Power-Up on this board to use this filter';
    cfCard.appendChild(note);
  }

  root.appendChild(cfCard);
  container.appendChild(root);

  function updateCustomFieldValueOptions(fieldId, preselectedValueId = null) {
    customFieldValueSelectEl.innerHTML = '';
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = 'Select value';
    placeholderOpt.disabled = true;
    placeholderOpt.selected = true;
    customFieldValueSelectEl.appendChild(placeholderOpt);

    const targetField = supportedCustomFields.find((f) => f.id === fieldId);
    if (!targetField) {
      customFieldValueSelectEl.disabled = true;
      return;
    }

    if (targetField.type === 'list') {
      const opts = targetField.options || [];
      opts.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = (o.value && o.value.text) ? o.value.text : o.id;
        if (preselectedValueId && o.id === preselectedValueId) {
          opt.selected = true;
        }
        customFieldValueSelectEl.appendChild(opt);
      });
      customFieldValueSelectEl.disabled = false;
    } else if (targetField.type === 'checkbox') {
      const checkedOpt = document.createElement('option');
      checkedOpt.value = 'true';
      checkedOpt.textContent = 'Checked';
      if (preselectedValueId === 'true') checkedOpt.selected = true;
      customFieldValueSelectEl.appendChild(checkedOpt);

      const uncheckedOpt = document.createElement('option');
      uncheckedOpt.value = 'false';
      uncheckedOpt.textContent = 'Not checked';
      if (preselectedValueId === 'false') uncheckedOpt.selected = true;
      customFieldValueSelectEl.appendChild(uncheckedOpt);

      customFieldValueSelectEl.disabled = false;
    }
  }

  customFieldSelectEl.addEventListener('change', () => {
    cfError.classList.remove('visible');
    customFieldSelectEl.classList.remove('has-error');
    updateCustomFieldValueOptions(customFieldSelectEl.value);
  });

  customFieldValueSelectEl.addEventListener('change', () => {
    cfError.classList.remove('visible');
    customFieldValueSelectEl.classList.remove('has-error');
  });

  customFieldCheckboxEl.addEventListener('change', () => {
    if (customFieldCheckboxEl.checked) {
      cfCard.classList.remove('disabled');
      customFieldSelectEl.disabled = false;
      if (customFieldSelectEl.value) {
        customFieldValueSelectEl.disabled = false;
      }
    } else {
      cfCard.classList.add('disabled');
      customFieldSelectEl.disabled = true;
      customFieldValueSelectEl.disabled = true;
      cfError.classList.remove('visible');
    }
  });

  // Prefill initial values
  if (initialFilters) {
    if (Array.isArray(initialFilters.labels) && initialFilters.labels.length > 0 && labels !== null) {
      labelCheckboxEl.checked = true;
      labelCard.classList.remove('disabled');
      labelMultiSelect.setDisabled(false);
      labelMultiSelect.setSelectedIds(initialFilters.labels.map((l) => l.id));
    }
    if (Array.isArray(initialFilters.members) && initialFilters.members.length > 0 && members !== null) {
      memberCheckboxEl.checked = true;
      memberCard.classList.remove('disabled');
      memberMultiSelect.setDisabled(false);
      memberMultiSelect.setSelectedIds(initialFilters.members.map((m) => m.id));
    }
    if (initialFilters.customField && initialFilters.customField.fieldId && customFields !== null) {
      customFieldCheckboxEl.checked = true;
      cfCard.classList.remove('disabled');
      customFieldSelectEl.disabled = false;
      customFieldSelectEl.value = initialFilters.customField.fieldId;
      updateCustomFieldValueOptions(initialFilters.customField.fieldId, initialFilters.customField.valueId);
    }
  }

  return {
    getValue() {
      let filterLabels = null;
      if (labelCheckboxEl && labelCheckboxEl.checked) {
        const selectedIds = labelMultiSelect.getSelectedIds();
        filterLabels = selectedIds.map((id) => {
          const found = (labels || []).find((l) => l.id === id);
          return {
            id,
            name: found ? found.name || found.color || 'Label' : id,
            color: found ? found.color : null
          };
        });
      }

      let filterMembers = null;
      if (memberCheckboxEl && memberCheckboxEl.checked) {
        const selectedIds = memberMultiSelect.getSelectedIds();
        filterMembers = selectedIds.map((id) => {
          const found = (members || []).find((m) => m.id === id);
          return {
            id,
            name: found ? found.fullName || found.name || found.username || 'Member' : id
          };
        });
      }

      let filterCustomField = null;
      if (customFieldCheckboxEl && customFieldCheckboxEl.checked) {
        const fieldId = customFieldSelectEl.value || '';
        const fieldOpt = customFieldSelectEl.options[customFieldSelectEl.selectedIndex];
        const fieldName = fieldOpt && fieldOpt.value ? fieldOpt.textContent : '';

        const valueId = customFieldValueSelectEl.value || '';
        const valueOpt = customFieldValueSelectEl.options[customFieldValueSelectEl.selectedIndex];
        const valueLabel = valueOpt && valueOpt.value ? valueOpt.textContent : '';

        filterCustomField = {
          fieldId,
          fieldName,
          valueId,
          valueLabel
        };
      }

      return {
        labels: filterLabels,
        members: filterMembers,
        customField: filterCustomField
      };
    },

    validate() {
      let isValid = true;

      if (labelCheckboxEl && labelCheckboxEl.checked) {
        const labelIds = labelMultiSelect.getSelectedIds();
        if (!labelIds || labelIds.length === 0) {
          labelError.classList.add('visible');
          isValid = false;
        } else {
          labelError.classList.remove('visible');
        }
      } else {
        labelError.classList.remove('visible');
      }

      if (memberCheckboxEl && memberCheckboxEl.checked) {
        const memberIds = memberMultiSelect.getSelectedIds();
        if (!memberIds || memberIds.length === 0) {
          memberError.classList.add('visible');
          isValid = false;
        } else {
          memberError.classList.remove('visible');
        }
      } else {
        memberError.classList.remove('visible');
      }

      if (customFieldCheckboxEl && customFieldCheckboxEl.checked) {
        const fId = customFieldSelectEl ? customFieldSelectEl.value : '';
        const vId = customFieldValueSelectEl ? customFieldValueSelectEl.value : '';
        if (!fId || !vId) {
          cfError.classList.add('visible');
          if (!fId) customFieldSelectEl.classList.add('has-error');
          if (!vId) customFieldValueSelectEl.classList.add('has-error');
          isValid = false;
        } else {
          cfError.classList.remove('visible');
          customFieldSelectEl.classList.remove('has-error');
          customFieldValueSelectEl.classList.remove('has-error');
        }
      } else {
        cfError.classList.remove('visible');
      }

      return isValid;
    },

    destroy() {
      if (labelMultiSelect && typeof labelMultiSelect.destroy === 'function') {
        labelMultiSelect.destroy();
      }
      if (memberMultiSelect && typeof memberMultiSelect.destroy === 'function') {
        memberMultiSelect.destroy();
      }
      container.innerHTML = '';
    }
  };
}
