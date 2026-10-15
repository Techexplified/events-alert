/**
 * Format a schema field's current value for read-only display in the Review page.
 *
 * @param {object} field - The field definition from conditionSchemas.
 * @param {object} conditions - The saved conditions from draft.
 * @returns {string} Formatted display string.
 */
export function formatFieldValue(field, conditions) {
  if (!field || !conditions) return '';

  switch (field.type) {
    case 'list-select': {
      if (conditions.listName) {
        return conditions.listName;
      }
      return field.required ? 'Not selected' : 'Any list';
    }

    case 'number': {
      const days = conditions.days != null ? conditions.days : field.default;
      const unit = field.unit || 'days';
      if (unit === 'days') {
        return `${days} ${days === 1 ? 'day' : 'days'}`;
      }
      return `${days} ${unit}`;
    }

    case 'radio-overdue': {
      const timing = conditions.timing || conditions.condition || 'on-due-date';
      if (timing === 'overdue-by-days') {
        const days = conditions.overdueDays != null ? conditions.overdueDays : (conditions.days != null ? conditions.days : 1);
        return `Overdue by more than ${days} ${days === 1 ? 'day' : 'days'}`;
      }
      return 'On due date (overdue)';
    }

    case 'radio-due-soon': {
      const timing = conditions.dueDateCondition || conditions.timing || conditions.condition || 'before-due-date';
      if (timing === 'before-due-date') {
        const days = conditions.dueSoonDays != null ? conditions.dueSoonDays : (conditions.days != null ? conditions.days : 2);
        return `Before due date (${days} ${days === 1 ? 'day' : 'days'})`;
      }
      return 'On due date';
    }

    default:
      return String(conditions[field.key] || '');
  }
}

/**
 * Render a schema-driven field control and validator.
 * Can be used in the full Conditions form or inline within a Review row.
 *
 * @param {object} options
 * @param {object} options.field - Field definition from conditionsSchemas.
 * @param {HTMLElement} options.container - Element to render into.
 * @param {object} options.boardData - { lists, labels, members, customFields }.
 * @param {object} options.value - Current conditions object (or partial).
 * @param {boolean} [options.isInline=false] - Whether this is rendered in an inline row editor.
 * @param {function} [options.onRetry] - Optional callback when retrying a failed loader.
 * @returns {object} { getValue(), validate(), focus() }
 */
export function renderConditionField({
  field,
  container,
  boardData = {},
  value = {},
  isInline = false,
  onRetry = null
}) {
  if (!container) throw new Error('renderConditionField: container is required');
  container.innerHTML = '';

  const { lists } = boardData;

  // 1. List Select Field
  if (field.type === 'list-select') {
    const wrapper = document.createElement('div');
    wrapper.className = isInline ? 'inline-select-container' : 'form-group';

    if (!isInline && field.label) {
      const lbl = document.createElement('label');
      lbl.className = 'form-label';
      lbl.textContent = field.label;
      wrapper.appendChild(lbl);
    }

    const selectWrap = document.createElement('div');
    selectWrap.className = 'select-wrapper';

    const selectEl = document.createElement('select');
    selectEl.className = 'form-select';
    selectEl.id = `field-${field.key}`;

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';

    if (lists === null) {
      defaultOpt.textContent = 'Failed to load lists';
      selectEl.appendChild(defaultOpt);
      selectEl.disabled = true;
    } else if (lists.length === 0) {
      defaultOpt.textContent = 'No lists on this board';
      selectEl.appendChild(defaultOpt);
      selectEl.disabled = true;
    } else {
      defaultOpt.textContent = field.placeholder || (field.required ? 'Select a list' : 'Any list');
      defaultOpt.disabled = !!field.required;
      if (!value.listId) defaultOpt.selected = true;
      selectEl.appendChild(defaultOpt);

      lists.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        // Security: render Trello text safely with textContent
        opt.textContent = item.name;
        if (value.listId && value.listId === item.id) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      });
    }

    selectWrap.appendChild(selectEl);

    const chevron = document.createElement('span');
    chevron.className = 'select-chevron';
    chevron.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    selectWrap.appendChild(chevron);
    wrapper.appendChild(selectWrap);

    const errorEl = document.createElement('span');
    errorEl.className = 'error-message';
    errorEl.textContent = 'Please select a list';
    wrapper.appendChild(errorEl);

    if (lists === null && onRetry) {
      const retryWrap = document.createElement('div');
      retryWrap.className = 'retry-error-box';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-retry';
      retryBtn.textContent = 'Retry loading lists';
      retryBtn.addEventListener('click', onRetry);
      retryWrap.appendChild(retryBtn);
      wrapper.appendChild(retryWrap);
    }

    selectEl.addEventListener('change', () => {
      selectEl.classList.remove('has-error');
      errorEl.classList.remove('visible');
    });

    container.appendChild(wrapper);

    return {
      getValue() {
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        const listName = selectedOpt && selectedOpt.value ? selectedOpt.textContent : (field.required ? '' : 'Any list');
        return {
          listId: selectEl.value || null,
          listName
        };
      },
      validate() {
        if (field.required && !selectEl.value) {
          selectEl.classList.add('has-error');
          errorEl.classList.add('visible');
          return false;
        }
        selectEl.classList.remove('has-error');
        errorEl.classList.remove('visible');
        return true;
      },
      focus() {
        selectEl.focus();
      }
    };
  }

  // 2. Number Field
  if (field.type === 'number') {
    const wrapper = document.createElement('div');
    wrapper.className = isInline ? 'inline-number-container' : 'form-group';

    if (!isInline && field.label) {
      const lbl = document.createElement('label');
      lbl.className = 'form-label';
      lbl.textContent = field.label;
      wrapper.appendChild(lbl);
    }

    const suffixGroup = document.createElement('div');
    suffixGroup.className = 'input-group-suffix';

    const inputEl = document.createElement('input');
    inputEl.type = 'number';
    inputEl.className = 'suffix-input';
    inputEl.id = `field-${field.key}`;
    const minVal = field.min != null ? field.min : 1;
    const maxVal = field.max != null ? field.max : 365;
    inputEl.min = String(minVal);
    inputEl.max = String(maxVal);

    const initialVal = value.days != null ? value.days : (field.default != null ? field.default : 3);
    inputEl.value = String(initialVal);
    suffixGroup.appendChild(inputEl);

    const badge = document.createElement('span');
    badge.className = 'suffix-badge';
    badge.textContent = field.unit || 'days';
    suffixGroup.appendChild(badge);

    wrapper.appendChild(suffixGroup);

    const errorEl = document.createElement('span');
    errorEl.className = 'error-message';
    errorEl.textContent = `Please enter a whole number of days between ${minVal} and ${maxVal}`;
    wrapper.appendChild(errorEl);

    inputEl.addEventListener('input', () => {
      suffixGroup.classList.remove('has-error');
      errorEl.classList.remove('visible');
    });

    container.appendChild(wrapper);

    return {
      getValue() {
        const parsed = parseInt(inputEl.value, 10);
        return {
          days: isNaN(parsed) ? (field.default || 1) : parsed
        };
      },
      validate() {
        const raw = inputEl.value.trim();
        const num = Number(raw);
        if (!raw || !Number.isInteger(num) || num < minVal || num > maxVal) {
          suffixGroup.classList.add('has-error');
          errorEl.classList.add('visible');
          return false;
        }
        suffixGroup.classList.remove('has-error');
        errorEl.classList.remove('visible');
        return true;
      },
      focus() {
        inputEl.focus();
        inputEl.select();
      }
    };
  }

  // 3. Overdue Condition Field (radio-overdue)
  if (field.type === 'radio-overdue' || (field.key === 'condition' && field.type !== 'radio-due-soon')) {
    const wrapper = document.createElement('div');
    wrapper.className = isInline ? 'inline-radio-container' : 'form-group';

    if (!isInline && field.label) {
      const lbl = document.createElement('label');
      lbl.className = 'form-label';
      lbl.textContent = field.label;
      wrapper.appendChild(lbl);
    }

    const radioContainer = document.createElement('div');
    radioContainer.className = 'radio-group-container';

    const currentTiming = value.timing || value.condition || 'on-due-date';
    const optByDays = (field.options || []).find((o) => o.value === 'overdue-by-days') || {};
    const defaultDays = optByDays.defaultDays != null ? optByDays.defaultDays : 1;
    const minDays = optByDays.minDays != null ? optByDays.minDays : 1;
    const maxDays = optByDays.maxDays != null ? optByDays.maxDays : 365;

    // Row 1: On due date (overdue)
    const row1 = document.createElement('label');
    row1.className = 'radio-row';

    const rOnDue = document.createElement('input');
    rOnDue.type = 'radio';
    rOnDue.name = `overdue-timing-${Math.random().toString(36).substring(2, 7)}`;
    rOnDue.value = 'on-due-date';
    rOnDue.className = 'radio-input';
    rOnDue.checked = currentTiming === 'on-due-date';

    const row1Label = document.createElement('span');
    row1Label.className = 'radio-row-label';
    row1Label.textContent = 'On due date (overdue)';

    row1.appendChild(rOnDue);
    row1.appendChild(row1Label);
    radioContainer.appendChild(row1);

    // Row 2: Overdue by more than [ 1 ] day(s)
    const row2 = document.createElement('div');
    row2.className = 'radio-row';

    const rByDays = document.createElement('input');
    rByDays.type = 'radio';
    rByDays.name = rOnDue.name;
    rByDays.value = 'overdue-by-days';
    rByDays.className = 'radio-input';
    rByDays.checked = currentTiming === 'overdue-by-days';

    const row2Label = document.createElement('label');
    row2Label.className = 'radio-row-label';
    row2Label.textContent = 'Overdue by more than';

    const daysInput = document.createElement('input');
    daysInput.type = 'number';
    daysInput.className = 'inline-number-input';
    daysInput.min = String(minDays);
    daysInput.max = String(maxDays);
    const existingDays = value.overdueDays != null ? value.overdueDays : (value.days != null ? value.days : defaultDays);
    daysInput.value = String(existingDays);
    daysInput.disabled = !rByDays.checked;

    const row2Unit = document.createElement('span');
    row2Unit.className = 'radio-unit-text';
    row2Unit.textContent = optByDays.unit || 'day(s)';

    row2.appendChild(rByDays);
    row2.appendChild(row2Label);
    row2.appendChild(daysInput);
    row2.appendChild(row2Unit);
    radioContainer.appendChild(row2);

    wrapper.appendChild(radioContainer);

    const errorEl = document.createElement('span');
    errorEl.className = 'error-message';
    errorEl.textContent = `Please enter a whole number of days between ${minDays} and ${maxDays}`;
    wrapper.appendChild(errorEl);

    function updateState() {
      if (rByDays.checked) {
        daysInput.disabled = false;
      } else {
        daysInput.disabled = true;
        daysInput.classList.remove('has-error');
        errorEl.classList.remove('visible');
      }
    }

    rOnDue.addEventListener('change', updateState);
    rByDays.addEventListener('change', () => {
      updateState();
      daysInput.focus();
    });

    row2Label.addEventListener('click', () => {
      rByDays.checked = true;
      updateState();
      daysInput.focus();
    });

    daysInput.addEventListener('focus', () => {
      if (!rByDays.checked) {
        rByDays.checked = true;
        updateState();
      }
    });

    daysInput.addEventListener('input', () => {
      daysInput.classList.remove('has-error');
      errorEl.classList.remove('visible');
    });

    container.appendChild(wrapper);

    return {
      getValue() {
        const isDays = rByDays.checked;
        const parsedDays = parseInt(daysInput.value, 10);
        const overdueDays = isNaN(parsedDays) ? defaultDays : parsedDays;
        return {
          timing: isDays ? 'overdue-by-days' : 'on-due-date',
          condition: isDays ? 'overdue-by-days' : 'on-due-date',
          days: isDays ? overdueDays : 0,
          overdueDays: isDays ? overdueDays : 0
        };
      },
      validate() {
        if (rByDays.checked) {
          const raw = daysInput.value.trim();
          const num = Number(raw);
          if (!raw || !Number.isInteger(num) || num < minDays || num > maxDays) {
            daysInput.classList.add('has-error');
            errorEl.classList.add('visible');
            return false;
          }
        }
        daysInput.classList.remove('has-error');
        errorEl.classList.remove('visible');
        return true;
      },
      focus() {
        if (rByDays.checked) {
          daysInput.focus();
        } else {
          rOnDue.focus();
        }
      }
    };
  }

  // 4. Due Soon Condition Field (radio-due-soon)
  if (field.type === 'radio-due-soon' || field.key === 'dueDateCondition') {
    const wrapper = document.createElement('div');
    wrapper.className = isInline ? 'inline-radio-container' : 'form-group';

    if (!isInline && field.label) {
      const lbl = document.createElement('label');
      lbl.className = 'form-label';
      lbl.textContent = field.label;
      wrapper.appendChild(lbl);
    }

    const radioContainer = document.createElement('div');
    radioContainer.className = 'radio-group-container';

    const currentTiming = value.dueDateCondition || value.timing || value.condition || 'before-due-date';
    const optBefore = (field.options || []).find((o) => o.value === 'before-due-date') || {};
    const defaultDays = optBefore.defaultDays != null ? optBefore.defaultDays : 2;
    const minDays = optBefore.minDays != null ? optBefore.minDays : 1;
    const maxDays = optBefore.maxDays != null ? optBefore.maxDays : 365;

    // Row 1: Before due date [ 2 ] day(s)
    const row1 = document.createElement('div');
    row1.className = 'radio-row';

    const rBefore = document.createElement('input');
    rBefore.type = 'radio';
    rBefore.name = `due-soon-timing-${Math.random().toString(36).substring(2, 7)}`;
    rBefore.value = 'before-due-date';
    rBefore.className = 'radio-input';
    rBefore.checked = currentTiming === 'before-due-date';

    const row1Label = document.createElement('label');
    row1Label.className = 'radio-row-label';
    row1Label.textContent = optBefore.label || 'Before due date';

    const daysInput = document.createElement('input');
    daysInput.type = 'number';
    daysInput.className = 'inline-number-input';
    daysInput.min = String(minDays);
    daysInput.max = String(maxDays);
    const existingDays = value.dueSoonDays != null ? value.dueSoonDays : (value.days != null ? value.days : defaultDays);
    daysInput.value = String(existingDays);
    daysInput.disabled = !rBefore.checked;

    const row1Unit = document.createElement('span');
    row1Unit.className = 'radio-unit-text';
    row1Unit.textContent = optBefore.unit || 'day(s)';

    row1.appendChild(rBefore);
    row1.appendChild(row1Label);
    row1.appendChild(daysInput);
    row1.appendChild(row1Unit);
    radioContainer.appendChild(row1);

    // Row 2: On due date
    const optOnDue = (field.options || []).find((o) => o.value === 'on-due-date') || {};
    const row2 = document.createElement('label');
    row2.className = 'radio-row';

    const rOnDue = document.createElement('input');
    rOnDue.type = 'radio';
    rOnDue.name = rBefore.name;
    rOnDue.value = 'on-due-date';
    rOnDue.className = 'radio-input';
    rOnDue.checked = currentTiming === 'on-due-date';

    const row2Label = document.createElement('span');
    row2Label.className = 'radio-row-label';
    row2Label.textContent = optOnDue.label || 'On due date';

    row2.appendChild(rOnDue);
    row2.appendChild(row2Label);
    radioContainer.appendChild(row2);

    wrapper.appendChild(radioContainer);

    const errorEl = document.createElement('span');
    errorEl.className = 'error-message';
    errorEl.textContent = `Please enter a whole number of days between ${minDays} and ${maxDays}`;
    wrapper.appendChild(errorEl);

    function updateState() {
      if (rBefore.checked) {
        daysInput.disabled = false;
      } else {
        daysInput.disabled = true;
        daysInput.classList.remove('has-error');
        errorEl.classList.remove('visible');
      }
    }

    rBefore.addEventListener('change', updateState);
    rOnDue.addEventListener('change', updateState);

    row1Label.addEventListener('click', () => {
      rBefore.checked = true;
      updateState();
      daysInput.focus();
    });

    daysInput.addEventListener('focus', () => {
      if (!rBefore.checked) {
        rBefore.checked = true;
        updateState();
      }
    });

    daysInput.addEventListener('input', () => {
      daysInput.classList.remove('has-error');
      errorEl.classList.remove('visible');
    });

    container.appendChild(wrapper);

    return {
      getValue() {
        const isBefore = rBefore.checked;
        const parsedDays = parseInt(daysInput.value, 10);
        const dueSoonDays = isNaN(parsedDays) ? defaultDays : parsedDays;
        return {
          dueDateCondition: isBefore ? 'before-due-date' : 'on-due-date',
          condition: isBefore ? 'before-due-date' : 'on-due-date',
          timing: isBefore ? 'before-due-date' : 'on-due-date',
          days: isBefore ? dueSoonDays : 0,
          dueSoonDays: isBefore ? dueSoonDays : 0
        };
      },
      validate() {
        if (rBefore.checked) {
          const raw = daysInput.value.trim();
          const num = Number(raw);
          if (!raw || !Number.isInteger(num) || num < minDays || num > maxDays) {
            daysInput.classList.add('has-error');
            errorEl.classList.add('visible');
            return false;
          }
        }
        daysInput.classList.remove('has-error');
        errorEl.classList.remove('visible');
        return true;
      },
      focus() {
        if (rBefore.checked) {
          daysInput.focus();
        } else {
          rOnDue.focus();
        }
      }
    };
  }

  // Fallback for unknown field type
  const fallback = document.createElement('div');
  fallback.textContent = `Field ${field.key} (${field.type})`;
  container.appendChild(fallback);

  return {
    getValue() {
      return {};
    },
    validate() {
      return true;
    },
    focus() {}
  };
}
