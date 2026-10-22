/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { renderStepper } from './stepper.js';
import { summarizeConditions } from './condition-summary.js';
import { fetchRecipientData } from './board-data.js';
import { frequencyOptions } from './frequency-options.js';
import { createRecipientsEditor } from './recipients-editor.js';
import { goToMyAlerts } from './navigation.js';
import { getTrello } from './trello-instance.js';

// Initialize the Trello Power-Up iframe connector safely
let t = getTrello();

// Navigation helpers
function openHome() {
  if (!t) t = getTrello();
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./home.html') : './home.html';
  window.location.href = targetUrl;
}

function openStep1() {
  if (!t) t = getTrello();
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./create-alert.html') : './create-alert.html';
  window.location.href = targetUrl;
}

function openConditions() {
  if (!t) t = getTrello();
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./conditions.html') : './conditions.html';
  window.location.href = targetUrl;
}

function openReview() {
  if (!t) t = getTrello();
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

// Build and render the Alert Type Banner with condition summary
function renderAlertBanner(typeObj, summaryText) {
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
  desc.textContent = summaryText;
  info.appendChild(desc);

  banner.appendChild(info);
  return banner;
}

// Main page setup and rendering
async function initRecipientsPage() {
  renderStepper('#stepper-container', 3);
  setupSidebarNav();
  setupCloseButton();

  const container = document.getElementById('recipients-view-container');
  if (!container) return;

  const draft = await loadDraft();

  // If there is no draft or no saved conditions, show message with button back to step 1
  if (!draft || !draft.triggerType || !draft.conditions) {
    container.innerHTML = `
      <div class="coming-soon-banner">
        <p style="font-weight: 600; color: var(--text-dark); margin-bottom: 6px;">No alert conditions found</p>
        <p style="margin-bottom: 16px;">Please choose an alert type and configure conditions first.</p>
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

  const conditionSummary = summarizeConditions(draft);

  // Load live data
  let { members, me } = await fetchRecipientData(t);

  // Clear container and render banner
  container.innerHTML = '';
  container.appendChild(renderAlertBanner(alertTypeObj, conditionSummary));

  const formSection = document.createElement('div');
  formSection.className = 'form-section';

  // Radio Options Group using shared editor
  const recipientsEditorContainer = document.createElement('div');
  formSection.appendChild(recipientsEditorContainer);

  let recipientsEditor = createRecipientsEditor({
    container: recipientsEditorContainer,
    members,
    me,
    value: draft.recipients,
    onRetryMembers: async () => {
      const fresh = await fetchRecipientData(t, { forceRefresh: true });
      members = fresh.members;
      me = fresh.me;
      recipientsEditor = createRecipientsEditor({
        container: recipientsEditorContainer,
        members,
        me,
        value: draft.recipients
      });
    }
  });

  // Notification Frequency Section
  const freqGroup = document.createElement('div');
  freqGroup.className = 'form-group';
  freqGroup.style.marginTop = '24px';

  const freqLabel = document.createElement('label');
  freqLabel.className = 'form-label';
  freqLabel.htmlFor = 'frequency-select';
  freqLabel.textContent = 'Notification frequency';
  freqGroup.appendChild(freqLabel);

  const freqSub = document.createElement('p');
  freqSub.style.fontSize = '12.5px';
  freqSub.style.color = 'var(--text-muted)';
  freqSub.style.marginBottom = '8px';
  freqSub.textContent = 'Choose how often you want to receive alerts.';
  freqGroup.appendChild(freqSub);

  const freqWrap = document.createElement('div');
  freqWrap.className = 'select-wrapper';

  const freqSelect = document.createElement('select');
  freqSelect.id = 'frequency-select';
  freqSelect.className = 'form-select';

  frequencyOptions.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (draft.recipients && draft.recipients.frequency === opt.value) {
      o.selected = true;
    } else if (!draft.recipients && opt.value === 'immediate') {
      o.selected = true;
    }
    freqSelect.appendChild(o);
  });

  freqWrap.appendChild(freqSelect);

  const freqChevron = document.createElement('span');
  freqChevron.className = 'select-chevron';
  freqChevron.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  freqWrap.appendChild(freqChevron);
  freqGroup.appendChild(freqWrap);

  formSection.appendChild(freqGroup);
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

  function collectRecipientState() {
    const base = recipientsEditor.getValue();
    return {
      ...base,
      frequency: freqSelect ? freqSelect.value : 'immediate'
    };
  }

  // Handle Back: saves in-progress state and navigates to Conditions
  backBtn.addEventListener('click', async () => {
    draft.recipients = collectRecipientState();
    await persistDraft(draft);
    openConditions();
  });

  // Handle Next with validation
  nextBtn.addEventListener('click', async () => {
    const isValid = recipientsEditor.validate();

    if (!isValid) {
      recipientsEditorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    draft.recipients = collectRecipientState();
    await persistDraft(draft);

    openReview();
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initRecipientsPage();
});
