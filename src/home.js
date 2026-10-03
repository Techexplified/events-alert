/* global TrelloPowerUp */

// Initialize the Trello Power-Up iframe connector safely
const t = typeof window.TrelloPowerUp !== 'undefined' ? window.TrelloPowerUp.iframe() : null;

// Alert types data array
const alertTypes = [
  {
    id: 'due-date',
    icon: '📅',
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    title: 'Due date reminder',
    description: "Get notified before a card's due date."
  },
  {
    id: 'card-moves',
    icon: '↔️',
    iconBg: '#D1FAE5',
    iconColor: '#059669',
    title: 'Card moves',
    description: 'Get notified when a card is moved.'
  },
  {
    id: 'mentions',
    icon: '@',
    iconBg: '#FFEDD5',
    iconColor: '#D97706',
    title: 'Mentions',
    description: 'Get notified when you are mentioned.'
  },
  {
    id: 'comments',
    icon: '💬',
    iconBg: '#EDE9FE',
    iconColor: '#7C3AED',
    title: 'Comments',
    description: 'Get notified when a new comment is added.'
  },
  {
    id: 'custom-fields',
    icon: '🎚️',
    iconBg: '#CCFBF1',
    iconColor: '#0D9488',
    title: 'Custom field changes',
    description: 'Get notified when a custom field is updated.'
  }
];

// Helper to render crisp icons matching the design screenshot
function getIconSvg(typeId, color) {
  switch (typeId) {
    case 'due-date':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>`;
    case 'card-moves':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 7H20M20 7L16 3M20 7L16 11M16 17H4M4 17L8 13M4 17L8 21"/>
      </svg>`;
    case 'mentions':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>
      </svg>`;
    case 'comments':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
      </svg>`;
    case 'custom-fields':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" x2="20" y1="21" y2="21"/>
        <line x1="4" x2="20" y1="14" y2="14"/>
        <line x1="4" x2="20" y1="7" y2="7"/>
        <circle cx="9" cy="7" r="2" fill="${color}"/>
        <circle cx="15" cy="14" r="2" fill="${color}"/>
        <circle cx="10" cy="21" r="2" fill="${color}"/>
      </svg>`;
    default:
      return '';
  }
}

// Render alert cards
function renderAlertCards() {
  const container = document.getElementById('alert-cards-container');
  if (!container) return;

  container.innerHTML = alertTypes
    .map(
      (type) => `
    <div class="alert-card" data-alert-id="${type.id}">
      <div class="alert-icon-wrapper" style="background-color: ${type.iconBg};">
        ${getIconSvg(type.id, type.iconColor)}
      </div>
      <div class="alert-info">
        <h3 class="alert-title">${type.title}</h3>
        <p class="alert-description">${type.description}</p>
      </div>
      <div class="alert-chevron">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    </div>
  `
    )
    .join('');

  // Attach click listeners to alert cards
  container.querySelectorAll('.alert-card').forEach((card) => {
    card.addEventListener('click', () => {
      const typeId = card.getAttribute('data-alert-id');
      console.log('alert type selected:', typeId);
      // TODO: navigate to alert-type-specific setup once that flow is built
    });
  });
}

// Setup sidebar navigation toggling
function setupSidebarNav() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // TODO: wire real navigation once My Alerts and Create Alert views exist
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

// Setup bottom create alert button
function setupCreateButton() {
  const createBtn = document.getElementById('btn-create-alert');
  if (!createBtn) return;

  createBtn.addEventListener('click', () => {
    console.log('create alert clicked');
    // TODO: open alert creation flow once built
  });
}

// Initialize home view
document.addEventListener('DOMContentLoaded', () => {
  renderAlertCards();
  setupSidebarNav();
  setupCloseButton();
  setupCreateButton();
});
