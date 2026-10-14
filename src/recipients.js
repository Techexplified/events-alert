/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { renderStepper } from './stepper.js';
import { summarizeConditions } from './condition-summary.js';

// Initialize the Trello Power-Up iframe connector safely
const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
const t = typeof window.TrelloPowerUp !== 'undefined' && isInsideIframe ? window.TrelloPowerUp.iframe() : null;

// Deterministic pastel palette for member avatars
const PASTEL_PALETTE = [
  { bg: '#E0E7FF', text: '#4338CA' }, // indigo
  { bg: '#BAE6FD', text: '#0369A1' }, // sky blue
  { bg: '#F3E8FF', text: '#7E22CE' }, // purple
  { bg: '#FFEDD5', text: '#C2410C' }, // peach/orange
  { bg: '#DCFCE7', text: '#15803D' }, // green
  { bg: '#FCE7F3', text: '#BE185D' }, // pink
  { bg: '#FEF3C7', text: '#B45309' }, // amber
  { bg: '#E2E8F0', text: '#334155' }  // slate
];

function getAvatarColors(id) {
  if (!id) return PASTEL_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[index];
}

function getInitials(fullName, username) {
  const name = (fullName || username || '').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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

// Fetch live board members and current member
async function fetchRecipientData() {
  let members = null;
  let me = null;
  let membersError = false;
  let meError = false;

  if (t && typeof t.board === 'function') {
    try {
      const [boardRes, meRes] = await Promise.all([
        t.board('members').catch((err) => {
          console.warn('Failed to load board members:', err);
          return null;
        }),
        t.member('id', 'fullName').catch((err) => {
          console.warn('Failed to load current member info:', err);
          return null;
        })
      ]);

      if (boardRes && Array.isArray(boardRes.members)) {
        members = boardRes.members;
      } else {
        membersError = true;
      }

      if (meRes && meRes.id) {
        me = meRes;
      } else {
        meError = true;
      }
    } catch (err) {
      console.warn('Error fetching recipient data:', err);
      membersError = true;
      meError = true;
    }
  } else {
    // Standalone fallback mock data for testing outside Trello
    members = [
      { id: 'mem-1', fullName: 'Sanya Arora', username: 'sanya' },
      { id: 'mem-2', fullName: 'Rahul Kapoor', username: 'rahul' },
      { id: 'mem-3', fullName: 'Meera Patel', username: 'meera' },
      { id: 'mem-4', fullName: 'Dev Tak', username: 'dev' },
      { id: 'mem-5', fullName: 'Alex Rivera', username: 'alexr' },
      { id: 'mem-6', fullName: 'Sarah Chen', username: 'sarahc' }
    ];
    me = {
      id: 'mem-1',
      fullName: 'Sanya Arora'
    };
  }

  return { members, me, membersError, meError };
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
  let { members, me, membersError, meError } = await fetchRecipientData();

  // State handles
  let currentMode = 'me'; // 'me' | 'specific' | 'all'
  let selectedMemberIds = new Set();
  let searchQuery = '';

  // Prefill from draft.recipients if exists
  if (draft.recipients) {
    if (draft.recipients.mode) {
      currentMode = draft.recipients.mode;
    }
    if (Array.isArray(draft.recipients.members) && Array.isArray(members)) {
      const validBoardMemberIds = new Set(members.map((m) => m.id));
      draft.recipients.members.forEach((m) => {
        if (m && m.id && validBoardMemberIds.has(m.id)) {
          selectedMemberIds.add(m.id);
        }
      });
    }
  }

  // Clear container and render banner
  container.innerHTML = '';
  container.appendChild(renderAlertBanner(alertTypeObj, conditionSummary));

  const formSection = document.createElement('div');
  formSection.className = 'form-section';

  // Radio Options Group
  const radioGroup = document.createElement('div');
  radioGroup.className = 'recipient-options-group';

  // Option 1: Me only
  const meCard = document.createElement('div');
  meCard.className = `recipient-card ${currentMode === 'me' ? 'selected' : ''}`;

  const meRow = document.createElement('div');
  meRow.className = 'recipient-card-row';

  const meRadio = document.createElement('input');
  meRadio.type = 'radio';
  meRadio.name = 'recipient-mode';
  meRadio.value = 'me';
  meRadio.id = 'radio-mode-me';
  meRadio.className = 'recipient-radio';
  meRadio.checked = currentMode === 'me';

  const meContent = document.createElement('div');
  meContent.className = 'recipient-card-content';

  const meTitle = document.createElement('label');
  meTitle.className = 'recipient-title';
  meTitle.htmlFor = 'radio-mode-me';
  meTitle.textContent = 'Me only';

  const meSub = document.createElement('span');
  meSub.className = 'recipient-subtitle';
  meSub.textContent = 'Receive alerts at your email.';

  const meErrorContainer = document.createElement('div');
  meErrorContainer.id = 'me-error-container';
  meErrorContainer.className = 'recipient-inline-error';

  meContent.appendChild(meTitle);
  meContent.appendChild(meSub);
  meContent.appendChild(meErrorContainer);

  meRow.appendChild(meRadio);
  meRow.appendChild(meContent);
  meCard.appendChild(meRow);
  radioGroup.appendChild(meCard);

  // Option 2: Specific members
  const specCard = document.createElement('div');
  specCard.className = `recipient-card ${currentMode === 'specific' ? 'selected' : ''}`;

  const specRow = document.createElement('div');
  specRow.className = 'recipient-card-row';

  const specRadio = document.createElement('input');
  specRadio.type = 'radio';
  specRadio.name = 'recipient-mode';
  specRadio.value = 'specific';
  specRadio.id = 'radio-mode-specific';
  specRadio.className = 'recipient-radio';
  specRadio.checked = currentMode === 'specific';

  const specContent = document.createElement('div');
  specContent.className = 'recipient-card-content';

  const specTitle = document.createElement('label');
  specTitle.className = 'recipient-title';
  specTitle.htmlFor = 'radio-mode-specific';
  specTitle.textContent = 'Specific members';

  const specSub = document.createElement('span');
  specSub.className = 'recipient-subtitle';
  specSub.textContent = 'Select one or more board members.';

  specContent.appendChild(specTitle);
  specContent.appendChild(specSub);
  specRow.appendChild(specRadio);
  specRow.appendChild(specContent);
  specCard.appendChild(specRow);

  // Indented Expanded Area for Specific Members
  const expandedArea = document.createElement('div');
  expandedArea.className = `specific-members-expanded-area ${currentMode === 'specific' ? 'open' : ''}`;

  const panel = document.createElement('div');
  panel.className = 'specific-members-panel';

  // Search input wrapper
  const searchWrap = document.createElement('div');
  searchWrap.className = 'members-search-wrapper';
  searchWrap.innerHTML = `
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `;

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'members-search-input';
  searchInput.placeholder = 'Search members...';
  searchWrap.appendChild(searchInput);
  panel.appendChild(searchWrap);

  // Scrollable members list
  const membersListEl = document.createElement('div');
  membersListEl.id = 'members-list-scrollable';
  membersListEl.className = 'members-list-scrollable';
  panel.appendChild(membersListEl);

  // Members error container
  const membersErrorContainer = document.createElement('div');
  membersErrorContainer.id = 'members-error-container';
  panel.appendChild(membersErrorContainer);

  expandedArea.appendChild(panel);

  // Validation error element
  const specValidationError = document.createElement('span');
  specValidationError.id = 'specific-validation-error';
  specValidationError.className = 'error-message';
  specValidationError.style.paddingLeft = '38px';
  specValidationError.style.marginTop = '6px';
  specValidationError.textContent = 'Select at least one member';
  expandedArea.appendChild(specValidationError);

  specCard.appendChild(expandedArea);
  radioGroup.appendChild(specCard);

  // Option 3: All board members
  const allCard = document.createElement('div');
  allCard.className = `recipient-card ${currentMode === 'all' ? 'selected' : ''}`;

  const allRow = document.createElement('div');
  allRow.className = 'recipient-card-row';

  const allRadio = document.createElement('input');
  allRadio.type = 'radio';
  allRadio.name = 'recipient-mode';
  allRadio.value = 'all';
  allRadio.id = 'radio-mode-all';
  allRadio.className = 'recipient-radio';
  allRadio.checked = currentMode === 'all';

  const allContent = document.createElement('div');
  allContent.className = 'recipient-card-content';

  const allTitle = document.createElement('label');
  allTitle.className = 'recipient-title';
  allTitle.htmlFor = 'radio-mode-all';
  allTitle.textContent = 'All board members';

  const allSub = document.createElement('span');
  allSub.className = 'recipient-subtitle';
  allSub.textContent = 'All current and future members will receive alerts.';

  allContent.appendChild(allTitle);
  allContent.appendChild(allSub);
  allRow.appendChild(allRadio);
  allRow.appendChild(allContent);
  allCard.appendChild(allRow);
  radioGroup.appendChild(allCard);

  formSection.appendChild(radioGroup);

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

  // TODO: confirm frequency options; only the first appears in the design.
  const freqOptions = [
    { value: 'immediate', label: 'Immediately when the condition is met' },
    { value: 'daily', label: 'Once a day (daily digest)' },
    { value: 'weekly', label: 'Once a week (weekly digest)' }
  ];

  freqOptions.forEach((opt) => {
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

  // Helper to render members list securely
  function renderMembersList() {
    membersListEl.innerHTML = '';
    membersErrorContainer.innerHTML = '';

    if (membersError) {
      const errorBox = document.createElement('div');
      errorBox.className = 'retry-error-box';

      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-message visible';
      errorMsg.textContent = 'Failed to load board members';

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-retry';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', async () => {
        const fresh = await fetchRecipientData();
        members = fresh.members;
        membersError = fresh.membersError;
        renderMembersList();
      });

      errorBox.appendChild(errorMsg);
      errorBox.appendChild(retryBtn);
      membersErrorContainer.appendChild(errorBox);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = (members || []).filter((m) => {
      if (!query) return true;
      const fn = (m.fullName || '').toLowerCase();
      const un = (m.username || '').toLowerCase();
      return fn.includes(query) || un.includes(query);
    });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'members-empty-state';
      empty.textContent = 'No members found';
      membersListEl.appendChild(empty);
      return;
    }

    filtered.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'member-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'member-checkbox';
      chk.value = m.id;
      chk.checked = selectedMemberIds.has(m.id);

      const avatar = document.createElement('span');
      avatar.className = 'member-avatar';
      const colors = getAvatarColors(m.id);
      avatar.style.backgroundColor = colors.bg;
      avatar.style.color = colors.text;
      avatar.textContent = getInitials(m.fullName, m.username);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'member-name';
      // Security: safe rendering via textContent
      nameSpan.textContent = m.fullName || m.username || 'Member';

      row.appendChild(chk);
      row.appendChild(avatar);
      row.appendChild(nameSpan);

      // Row click toggles checkbox and selection
      row.addEventListener('click', (e) => {
        if (e.target !== chk) {
          chk.checked = !chk.checked;
        }
        if (chk.checked) {
          selectedMemberIds.add(m.id);
          specValidationError.classList.remove('visible');
        } else {
          selectedMemberIds.delete(m.id);
        }
      });

      chk.addEventListener('change', () => {
        if (chk.checked) {
          selectedMemberIds.add(m.id);
          specValidationError.classList.remove('visible');
        } else {
          selectedMemberIds.delete(m.id);
        }
      });

      membersListEl.appendChild(row);
    });
  }

  // Render "Me only" error state if t.member failed
  function renderMeError() {
    meErrorContainer.innerHTML = '';
    if (meError) {
      const errorBox = document.createElement('div');
      errorBox.className = 'retry-error-box';

      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-message visible';
      errorMsg.textContent = 'Couldn’t identify your Trello account';

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-retry';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', async () => {
        const fresh = await fetchRecipientData();
        me = fresh.me;
        meError = fresh.meError;
        renderMeError();
      });

      errorBox.appendChild(errorMsg);
      errorBox.appendChild(retryBtn);
      meErrorContainer.appendChild(errorBox);
    }
  }

  // Initial list and me-error renders
  renderMembersList();
  renderMeError();

  // Search input live filtering
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderMembersList();
  });

  // Mode switching helper
  function setMode(mode) {
    currentMode = mode;
    meRadio.checked = mode === 'me';
    specRadio.checked = mode === 'specific';
    allRadio.checked = mode === 'all';

    if (mode === 'me') {
      meCard.classList.add('selected');
      specCard.classList.remove('selected');
      allCard.classList.remove('selected');
      expandedArea.classList.remove('open');
      specValidationError.classList.remove('visible');
    } else if (mode === 'specific') {
      meCard.classList.remove('selected');
      specCard.classList.add('selected');
      allCard.classList.remove('selected');
      expandedArea.classList.add('open');
    } else if (mode === 'all') {
      meCard.classList.remove('selected');
      specCard.classList.remove('selected');
      allCard.classList.add('selected');
      expandedArea.classList.remove('open');
      specValidationError.classList.remove('visible');
    }
  }

  // Attach radio card click listeners (whole row clickable)
  meRow.addEventListener('click', () => setMode('me'));
  meRadio.addEventListener('change', () => setMode('me'));

  specRow.addEventListener('click', () => setMode('specific'));
  specRadio.addEventListener('change', () => setMode('specific'));

  allRow.addEventListener('click', () => setMode('all'));
  allRadio.addEventListener('change', () => setMode('all'));

  // Collect recipient state helper
  function collectRecipientState() {
    // Backend contract:
    // - 'me' = the member creating this alert (normally the board owner). The backend resolves their email.
    // - 'all' stores no member list on purpose, so members added later are included.
    //   The backend resolves the member list at send time.
    // - 'specific' stores member IDs (names are for display only).
    // TODO (backend): Trello only exposes a member's email to a token that member authorized
    // with the 'account' scope. Other members' emails can't be read through the API.
    // Decide how recipient emails are obtained before building the email sender.
    return {
      mode: currentMode,
      creator: me ? { id: me.id, name: me.fullName || me.username || 'Creator' } : null,
      members: currentMode === 'specific'
        ? Array.from(selectedMemberIds).map((id) => {
            const found = (members || []).find((m) => m.id === id);
            return {
              id,
              name: found ? found.fullName || found.username || id : id
            };
          })
        : [],
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
    let isValid = true;
    let firstErrorEl = null;

    if (currentMode === 'specific') {
      if (selectedMemberIds.size === 0) {
        specValidationError.classList.add('visible');
        isValid = false;
        firstErrorEl = panel;
      } else {
        specValidationError.classList.remove('visible');
      }
    } else if (currentMode === 'me') {
      if (meError || !me) {
        isValid = false;
        renderMeError();
        firstErrorEl = meCard;
      }
    }

    if (!isValid) {
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    draft.recipients = collectRecipientState();
    await persistDraft(draft);

    // TODO: step 4 (Review) page not built yet
    console.log('proceeding to step 4 (Review) with draft:', draft);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initRecipientsPage();
});
