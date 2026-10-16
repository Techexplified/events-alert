/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { renderStepper } from './stepper.js';
import { conditionSchemas } from './conditions-schemas.js';
import { fetchBoardData } from './board-data.js';
import { renderConditionField } from './condition-fields.js';
import { createFiltersEditor } from './filters-editor.js';
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

// Build and render the Alert Type Banner
function renderAlertBanner(typeObj) {
  const banner = document.createElement('div');
  banner.className = 'alert-type-banner';

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'alert-icon-wrapper';
  iconWrapper.style.backgroundColor = typeObj.iconBg;
  iconWrapper.innerHTML = getIconSvg(typeObj.id, typeObj.iconColor);
  banner.appendChild(iconWrapper);

  const info = document.createElement('div');
  info.className = 'banner-info';

  const title = document.createElement('h3');
  title.className = 'banner-title';
  title.textContent = typeObj.title;
  info.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'banner-description';
  desc.textContent = typeObj.description;
  info.appendChild(desc);

  banner.appendChild(info);
  return banner;
}

// Main page setup and rendering
async function initConditionsPage() {
  renderStepper('#stepper-container', 2);
  setupSidebarNav();
  setupCloseButton();

  const container = document.getElementById('conditions-view-container');
  if (!container) return;

  const draft = await loadDraft();

  // If there is no draft or no selected type (opened directly), show message with back button
  if (!draft || !draft.triggerType) {
    container.innerHTML = `
      <div class="coming-soon-banner">
        <p style="font-weight: 600; color: var(--text-dark); margin-bottom: 6px;">No alert type selected</p>
        <p style="margin-bottom: 16px;">Please choose an alert type in step 1 before setting conditions.</p>
        <button id="btn-empty-back" class="btn-primary">
          &larr; Back to Step 1
        </button>
      </div>
    `;
    const emptyBackBtn = document.getElementById('btn-empty-back');
    if (emptyBackBtn) {
      emptyBackBtn.addEventListener('click', openStep1);
    }
    return;
  }

  const alertTypeObj = alertTypes.find((t) => t.id === draft.triggerType) || {
    id: draft.triggerType,
    title: 'Custom Alert',
    description: 'Alert configuration',
    iconBg: '#FEE2E2',
    iconColor: '#EF4444'
  };

  const schema = conditionSchemas[draft.triggerType];

  // If schema is null, show banner + coming soon message + only Back button
  if (!schema) {
    container.innerHTML = '';
    container.appendChild(renderAlertBanner(alertTypeObj));

    const comingSoonBox = document.createElement('div');
    comingSoonBox.className = 'coming-soon-banner';
    comingSoonBox.textContent = 'Conditions for this alert type are coming soon.';
    container.appendChild(comingSoonBox);

    const actions = document.createElement('div');
    actions.className = 'form-actions-split';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-outline';
    backBtn.innerHTML = '&larr; Back';
    backBtn.addEventListener('click', openStep1);
    actions.appendChild(backBtn);
    container.appendChild(actions);
    return;
  }

  // Fetch live board data in parallel
  const boardData = await fetchBoardData(t);

  // Build the form
  container.innerHTML = '';
  container.appendChild(renderAlertBanner(alertTypeObj));

  const formSection = document.createElement('div');
  formSection.className = 'form-section';

  const existingCond = (draft.conditions && draft.conditions.alertType === draft.triggerType) ? draft.conditions : {};

  // Render schema-driven fields
  const fieldHandles = [];
  (schema.fields || []).forEach((field) => {
    const fieldContainer = document.createElement('div');
    const handle = renderConditionField({
      field,
      container: fieldContainer,
      boardData,
      value: existingCond,
      isInline: false
    });
    fieldHandles.push({ field, handle, container: fieldContainer });
    formSection.appendChild(fieldContainer);
  });

  // Render Additional Filters if schema specifies filters
  let filtersEditor = null;
  let filtersSection = null;
  if (schema.filters && schema.filters.length > 0) {
    filtersSection = document.createElement('div');
    filtersSection.className = 'filters-section';

    const filtersHeader = document.createElement('div');
    filtersHeader.className = 'filters-header';
    const filtersTitle = document.createElement('h4');
    filtersTitle.className = 'filters-title';
    filtersTitle.textContent = 'Additional filters (optional)';
    const filtersSubtext = document.createElement('p');
    filtersSubtext.className = 'filters-subtitle';
    filtersSubtext.textContent = 'Add filters to narrow down which cards to monitor.';
    filtersHeader.appendChild(filtersTitle);
    filtersHeader.appendChild(filtersSubtext);
    filtersSection.appendChild(filtersHeader);

    const filtersContainer = document.createElement('div');
    filtersSection.appendChild(filtersContainer);
    formSection.appendChild(filtersSection);

    filtersEditor = createFiltersEditor({
      container: filtersContainer,
      boardData,
      value: existingCond.filters || null
    });
  }

  container.appendChild(formSection);

  // Footer Actions: Back (left) and Next (right)
  const actions = document.createElement('div');
  actions.className = 'form-actions-split';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.id = 'btn-back';
  backBtn.className = 'btn-outline';
  backBtn.innerHTML = '&larr; Back';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.id = 'btn-next';
  nextBtn.className = 'btn-primary';
  nextBtn.innerHTML = 'Next &rarr;';

  actions.appendChild(backBtn);
  actions.appendChild(nextBtn);
  container.appendChild(actions);

  // Collect form state helper
  function collectFormState() {
    let collected = {
      alertType: draft.triggerType,
      filters: filtersEditor ? filtersEditor.getValue() : null
    };

    fieldHandles.forEach(({ handle }) => {
      const val = handle.getValue();
      collected = { ...collected, ...val };
    });

    return collected;
  }

  // Handle Back
  backBtn.addEventListener('click', async () => {
    draft.conditions = collectFormState();
    await persistDraft(draft);
    openStep1();
  });

  // Handle Next with validation
  nextBtn.addEventListener('click', async () => {
    let isValid = true;
    let firstErrorContainer = null;

    fieldHandles.forEach(({ handle, container: fieldCont }) => {
      const fieldValid = handle.validate();
      if (!fieldValid) {
        isValid = false;
        if (!firstErrorContainer) firstErrorContainer = fieldCont;
      }
    });

    if (filtersEditor) {
      const filtersValid = filtersEditor.validate();
      if (!filtersValid) {
        isValid = false;
        if (!firstErrorContainer) firstErrorContainer = filtersSection;
      }
    }

    if (!isValid) {
      if (firstErrorContainer) {
        firstErrorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    draft.conditions = collectFormState();
    await persistDraft(draft);
    openRecipients();
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initConditionsPage();
});
