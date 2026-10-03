/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';

// Initialize the Trello Power-Up iframe connector safely
const t = typeof window.TrelloPowerUp !== 'undefined' ? window.TrelloPowerUp.iframe() : null;

function openCreateAlert() {
  if (!t) {
    console.log('openCreateAlert called (outside Trello iframe)');
    window.location.href = './create-alert.html';
    return;
  }
  t.closeModal().then(function () {
    // Note: this closes and reopens a new modal rather than an in-page
    // transition, consistent with the separate-HTML-file-per-screen
    // pattern used throughout this project.
    t.modal({
      title: 'Event Alerts',
      url: t.signUrl('./create-alert.html'),
      accentColor: '#2563EB',
      height: 650
    });
  });
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

// Setup sidebar navigation
function setupSidebarNav() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      if (target === 'create-alert') {
        openCreateAlert();
      } else if (target === 'my-alerts') {
        navButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        console.log('My Alerts clicked - not yet built');
        // TODO: wire real navigation once My Alerts view exists
      } else if (target === 'home') {
        navButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
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

// Setup bottom create alert button
function setupCreateButton() {
  const createBtn = document.getElementById('btn-create-alert');
  if (!createBtn) return;

  createBtn.addEventListener('click', () => {
    openCreateAlert();
  });
}

// Initialize home view
document.addEventListener('DOMContentLoaded', () => {
  renderAlertCards();
  setupSidebarNav();
  setupCloseButton();
  setupCreateButton();
});
