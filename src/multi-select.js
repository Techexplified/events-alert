/**
 * Reusable multi-select dropdown component without external libraries.
 * API: createMultiSelect({ container, placeholder, options: [{ id, label, swatch }], selectedIds, onChange })
 */
export function createMultiSelect({
  container,
  placeholder = 'Select...',
  options = [],
  selectedIds = [],
  onChange = () => {}
}) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) {
    throw new Error('createMultiSelect: container element not found');
  }

  root.innerHTML = '';
  root.classList.add('multi-select-wrapper');

  let currentSelected = new Set(selectedIds || []);
  let currentOptions = [...(options || [])];
  let isOpen = false;
  let isDisabled = false;

  // Trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'multi-select-trigger';

  const triggerText = document.createElement('span');
  triggerText.className = 'multi-select-trigger-text';
  trigger.appendChild(triggerText);

  const chevron = document.createElement('span');
  chevron.className = 'multi-select-chevron';
  chevron.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  trigger.appendChild(chevron);
  root.appendChild(trigger);

  // Dropdown panel
  const panel = document.createElement('div');
  panel.className = 'multi-select-panel';
  panel.setAttribute('role', 'listbox');
  root.appendChild(panel);

  function updateTriggerDisplay() {
    if (currentSelected.size === 0) {
      triggerText.textContent = placeholder;
      triggerText.classList.add('is-placeholder');
    } else {
      triggerText.textContent = `${currentSelected.size} selected`;
      triggerText.classList.remove('is-placeholder');
    }
  }

  function renderOptions() {
    panel.innerHTML = '';

    if (currentOptions.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'multi-select-empty';
      emptyItem.textContent = 'No options available';
      panel.appendChild(emptyItem);
      return;
    }

    currentOptions.forEach((opt) => {
      const label = document.createElement('label');
      label.className = 'multi-select-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'multi-select-checkbox';
      checkbox.value = String(opt.id);
      checkbox.checked = currentSelected.has(opt.id);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          currentSelected.add(opt.id);
        } else {
          currentSelected.delete(opt.id);
        }
        updateTriggerDisplay();
        onChange(Array.from(currentSelected));
      });

      label.appendChild(checkbox);

      if (opt.swatch) {
        const swatch = document.createElement('span');
        swatch.className = 'multi-select-swatch';
        swatch.style.backgroundColor = opt.swatch;
        label.appendChild(swatch);
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'multi-select-option-text';
      // Security: use textContent to prevent XSS
      textSpan.textContent = opt.label;
      label.appendChild(textSpan);

      panel.appendChild(label);
    });
  }

  function open() {
    if (isDisabled || isOpen) return;
    isOpen = true;
    panel.classList.add('open');
    trigger.classList.add('open');
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('open');
    trigger.classList.remove('open');
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  const onDocClick = (e) => {
    if (!root.contains(e.target)) {
      close();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  };

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeyDown);

  updateTriggerDisplay();
  renderOptions();

  return {
    getSelectedIds() {
      return Array.from(currentSelected);
    },
    setSelectedIds(ids) {
      currentSelected = new Set(ids || []);
      updateTriggerDisplay();
      renderOptions();
    },
    setOptions(newOptions) {
      currentOptions = [...(newOptions || [])];
      renderOptions();
      updateTriggerDisplay();
    },
    setDisabled(flag) {
      isDisabled = !!flag;
      trigger.disabled = isDisabled;
      if (isDisabled) {
        close();
        root.classList.add('disabled');
      } else {
        root.classList.remove('disabled');
      }
    },
    destroy() {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      root.innerHTML = '';
    }
  };
}
