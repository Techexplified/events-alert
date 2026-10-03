/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { renderStepper } from './stepper.js';

// Initialize the Trello Power-Up iframe connector safely
const t = typeof window.TrelloPowerUp !== 'undefined' ? window.TrelloPowerUp.iframe() : null;

let selectedTriggerId = null;

// Reopen Home view
function openHome() {
  if (!t) {
    console.log('openHome called (outside Trello iframe)');
    window.location.href = './home.html';
    return;
  }
  t.closeModal().then(function () {
    t.modal({
      title: 'Event Alerts',
      url: t.signUrl('./home.html'),
      accentColor: '#2563EB',
      height: 600
    });
  });
}

// Render selectable trigger cards
function renderTriggerCards() {
  const container = document.getElementById('trigger-cards-container');
  if (!container) return;

  container.innerHTML = alertTypes
    .map(
      (type) => `
    <div class="alert-card selectable" data-type-id="${type.id}">
      <div class="alert-icon-wrapper" style="background-color: ${type.iconBg};">
        ${getIconSvg(type.id, type.iconColor)}
      </div>
      <div class="alert-info">
        <h3 class="alert-title">${type.title}</h3>
        <p class="alert-description">${type.description}</p>
      </div>
      <div class="alert-radio">
        <div class="radio-dot"></div>
      </div>
    </div>
  `
    )
    .join('');

  // Attach click listener to each card
  container.querySelectorAll('.alert-card').forEach((card) => {
    card.addEventListener('click', () => {
      const typeId = card.getAttribute('data-type-id');
      selectTrigger(typeId);
    });
  });
}

// Select a trigger type and update UI
function selectTrigger(typeId) {
  selectedTriggerId = typeId;
  const cards = document.querySelectorAll('#trigger-cards-container .alert-card');
  cards.forEach((c) => {
    if (c.getAttribute('data-type-id') === typeId) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });

  const triggerError = document.getElementById('trigger-error');
  if (triggerError) {
    triggerError.classList.remove('visible');
  }
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
        // TODO: wire real navigation once My Alerts view exists
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

// Setup input listeners & Next CTA
function setupFormListeners() {
  const nameInput = document.getElementById('alert-name-input');
  const nameError = document.getElementById('alert-name-error');
  const nextBtn = document.getElementById('btn-next');

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      if (nameInput.value.trim().length > 0) {
        nameInput.classList.remove('has-error');
        if (nameError) nameError.classList.remove('visible');
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', handleNext);
  }
}

// Validate, persist draft, and proceed
async function handleNext() {
  const nameInput = document.getElementById('alert-name-input');
  const nameError = document.getElementById('alert-name-error');
  const triggerError = document.getElementById('trigger-error');

  const nameInputValue = nameInput ? nameInput.value.trim() : '';
  let isValid = true;

  if (!nameInputValue) {
    if (nameInput) nameInput.classList.add('has-error');
    if (nameError) nameError.classList.add('visible');
    isValid = false;
  } else {
    if (nameInput) nameInput.classList.remove('has-error');
    if (nameError) nameError.classList.remove('visible');
  }

  if (!selectedTriggerId) {
    if (triggerError) triggerError.classList.add('visible');
    isValid = false;
  } else {
    if (triggerError) triggerError.classList.remove('visible');
  }

  if (!isValid) {
    return;
  }

  const draft = {
    alertName: nameInputValue,
    triggerType: selectedTriggerId,
    // populated by later steps once built:
    conditions: null,
    recipients: null
  };

  if (t && typeof t.set === 'function') {
    try {
      await t.set('board', 'private', 'alertDraft', draft);
    } catch (err) {
      console.warn('Error saving draft to Trello storage:', err);
    }
  } else {
    try {
      localStorage.setItem('alertDraft', JSON.stringify(draft));
    } catch (err) {
      console.warn('Error saving draft to localStorage:', err);
    }
  }

  // TODO: step 2 (Conditions) page not built yet — this should open conditions.html once it exists
  console.log('proceeding to step 2 with draft:', draft);
}

// Restore previously saved draft if any
async function restoreDraft() {
  let existing = null;

  if (t && typeof t.get === 'function') {
    try {
      existing = await t.get('board', 'private', 'alertDraft');
    } catch (err) {
      console.warn('Error reading alertDraft from Trello storage:', err);
    }
  }

  if (!existing) {
    try {
      const stored = localStorage.getItem('alertDraft');
      if (stored) {
        existing = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Error reading alertDraft from localStorage:', err);
    }
  }

  if (existing) {
    const nameInput = document.getElementById('alert-name-input');
    if (existing.alertName && nameInput) {
      nameInput.value = existing.alertName;
    }
    if (existing.triggerType) {
      selectTrigger(existing.triggerType);
    }
  }
}

// Initialize Step 1
document.addEventListener('DOMContentLoaded', async () => {
  renderStepper('#stepper-container', 1);
  renderTriggerCards();
  setupSidebarNav();
  setupCloseButton();
  setupFormListeners();
  await restoreDraft();
});
