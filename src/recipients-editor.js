// Deterministic pastel palette for member avatars
export const PASTEL_PALETTE = [
  { bg: '#E0E7FF', text: '#4338CA' }, // indigo
  { bg: '#BAE6FD', text: '#0369A1' }, // sky blue
  { bg: '#F3E8FF', text: '#7E22CE' }, // purple
  { bg: '#FFEDD5', text: '#C2410C' }, // peach/orange
  { bg: '#DCFCE7', text: '#15803D' }, // green
  { bg: '#FCE7F3', text: '#BE185D' }, // pink
  { bg: '#FEF3C7', text: '#B45309' }, // amber
  { bg: '#E2E8F0', text: '#334155' }  // slate
];

export function getAvatarColors(id) {
  if (!id) return PASTEL_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[index];
}

export function getInitials(fullName, username) {
  const name = (fullName || username || '').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Creates the Recipients radio group and expandable member checklist editor.
 *
 * @param {object} options
 * @param {HTMLElement} options.container - Container element to render into.
 * @param {Array} options.members - List of board members.
 * @param {object} options.me - Current logged-in member info.
 * @param {object} [options.value] - Existing recipient configuration { mode, members }.
 * @param {function} [options.onRetryMembers] - Optional callback to retry loading members.
 * @returns {object} { getValue(), validate(), destroy() }
 */
export function createRecipientsEditor({
  container,
  members = [],
  me = null,
  value = {},
  onRetryMembers = null
}) {
  if (!container) throw new Error('createRecipientsEditor: container is required');

  container.innerHTML = '';

  const initialVal = value || {};
  let currentMode = initialVal.mode || 'me';
  const selectedMemberIds = new Set();

  if (Array.isArray(initialVal.members) && Array.isArray(members)) {
    const validBoardMemberIds = new Set(members.map((m) => m.id));
    initialVal.members.forEach((m) => {
      if (m && m.id && validBoardMemberIds.has(m.id)) {
        selectedMemberIds.add(m.id);
      }
    });
  }

  let searchQuery = '';

  // Radio Options Group
  const radioGroup = document.createElement('div');
  radioGroup.className = 'recipient-options-group';

  // Option 1: Me only
  const meCard = document.createElement('div');
  meCard.className = `recipient-card ${currentMode === 'me' ? 'selected' : ''}`;

  const meRow = document.createElement('div');
  meRow.className = 'recipient-card-row';

  const radioName = `recipient-mode-${Math.random().toString(36).substring(2, 7)}`;

  const meRadio = document.createElement('input');
  meRadio.type = 'radio';
  meRadio.name = radioName;
  meRadio.value = 'me';
  meRadio.className = 'recipient-radio';
  meRadio.checked = currentMode === 'me';

  const isOtherCreator = !!(initialVal.creator && me && initialVal.creator.id !== me.id);
  const creatorName = (initialVal.creator && initialVal.creator.name) || 'creator';

  const meContent = document.createElement('div');
  meContent.className = 'recipient-card-content';

  const meTitle = document.createElement('label');
  meTitle.className = 'recipient-title';
  meTitle.textContent = isOtherCreator ? `Only ${creatorName}` : 'Me only';

  const meSub = document.createElement('span');
  meSub.className = 'recipient-subtitle';
  meSub.textContent = isOtherCreator ? `Receive alerts at ${creatorName}'s email.` : 'Receive alerts at your email.';

  const meErrorContainer = document.createElement('div');
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
  specRadio.name = radioName;
  specRadio.value = 'specific';
  specRadio.className = 'recipient-radio';
  specRadio.checked = currentMode === 'specific';

  const specContent = document.createElement('div');
  specContent.className = 'recipient-card-content';

  const specTitle = document.createElement('label');
  specTitle.className = 'recipient-title';
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
  membersListEl.className = 'members-list-scrollable';
  panel.appendChild(membersListEl);

  // Members error container
  const membersErrorContainer = document.createElement('div');
  panel.appendChild(membersErrorContainer);

  expandedArea.appendChild(panel);

  // Validation error element
  const specValidationError = document.createElement('span');
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
  allRadio.name = radioName;
  allRadio.value = 'all';
  allRadio.className = 'recipient-radio';
  allRadio.checked = currentMode === 'all';

  const allContent = document.createElement('div');
  allContent.className = 'recipient-card-content';

  const allTitle = document.createElement('label');
  allTitle.className = 'recipient-title';
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

  container.appendChild(radioGroup);

  // Helper to render members list securely
  function renderMembersList() {
    membersListEl.innerHTML = '';
    membersErrorContainer.innerHTML = '';

    if (members === null) {
      const errorBox = document.createElement('div');
      errorBox.className = 'retry-error-box';

      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-message visible';
      errorMsg.textContent = 'Failed to load board members';

      errorBox.appendChild(errorMsg);
      if (onRetryMembers) {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'btn-retry';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', async () => {
          await onRetryMembers();
        });
        errorBox.appendChild(retryBtn);
      }
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

  function renderMeError() {
    meErrorContainer.innerHTML = '';
    if (!me) {
      const errorBox = document.createElement('div');
      errorBox.className = 'retry-error-box';

      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-message visible';
      errorMsg.textContent = 'Couldn’t identify your Trello account';

      errorBox.appendChild(errorMsg);
      if (onRetryMembers) {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'btn-retry';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', async () => {
          await onRetryMembers();
        });
        errorBox.appendChild(retryBtn);
      }
      meErrorContainer.appendChild(errorBox);
    }
  }

  renderMembersList();
  renderMeError();

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderMembersList();
  });

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
      searchInput.focus();
    } else if (mode === 'all') {
      meCard.classList.remove('selected');
      specCard.classList.remove('selected');
      allCard.classList.add('selected');
      expandedArea.classList.remove('open');
      specValidationError.classList.remove('visible');
    }
  }

  meRow.addEventListener('click', () => setMode('me'));
  meRadio.addEventListener('change', () => setMode('me'));

  specRow.addEventListener('click', () => setMode('specific'));
  specRadio.addEventListener('change', () => setMode('specific'));

  allRow.addEventListener('click', () => setMode('all'));
  allRadio.addEventListener('change', () => setMode('all'));

  // Extra emails state (prefill from initialVal.extraEmails, trimmed, lowercased, deduplicated, max 10)
  const extraEmails = [];
  if (Array.isArray(initialVal.extraEmails)) {
    initialVal.extraEmails.forEach((email) => {
      if (typeof email === 'string') {
        const cleaned = email.trim().toLowerCase();
        if (cleaned && !extraEmails.includes(cleaned) && extraEmails.length < 10) {
          extraEmails.push(cleaned);
        }
      }
    });
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Additional email addresses (optional) Section
  const extraEmailsSection = document.createElement('div');
  extraEmailsSection.className = 'extra-emails-section';

  const extraHeader = document.createElement('div');
  extraHeader.className = 'extra-emails-header';

  const extraLabel = document.createElement('label');
  extraLabel.className = 'form-label extra-emails-label';
  extraLabel.textContent = 'Additional email addresses (optional)';
  extraLabel.htmlFor = 'extra-email-input';
  extraHeader.appendChild(extraLabel);

  const extraHelper = document.createElement('p');
  extraHelper.className = 'extra-emails-helper';
  extraHelper.textContent = 'These addresses will also receive this alert. They don’t need a Trello account.';
  extraHeader.appendChild(extraHelper);

  extraEmailsSection.appendChild(extraHeader);

  const inputRow = document.createElement('div');
  inputRow.className = 'extra-emails-input-row';

  const emailInput = document.createElement('input');
  emailInput.type = 'text';
  emailInput.id = 'extra-email-input';
  emailInput.className = 'form-input extra-emails-input';
  emailInput.placeholder = 'name@example.com';
  inputRow.appendChild(emailInput);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-add-email';
  addBtn.textContent = 'Add';
  inputRow.appendChild(addBtn);

  extraEmailsSection.appendChild(inputRow);

  const inlineError = document.createElement('div');
  inlineError.className = 'error-message';
  extraEmailsSection.appendChild(inlineError);

  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'extra-emails-chips';
  extraEmailsSection.appendChild(chipsContainer);

  function showEmailError(msg) {
    inlineError.textContent = msg;
    inlineError.classList.add('visible');
    emailInput.classList.add('has-error');
  }

  function clearEmailError() {
    inlineError.textContent = '';
    inlineError.classList.remove('visible');
    emailInput.classList.remove('has-error');
  }

  function renderChips() {
    chipsContainer.innerHTML = '';
    if (extraEmails.length === 0) {
      chipsContainer.style.display = 'none';
      return;
    }
    chipsContainer.style.display = 'flex';

    extraEmails.forEach((email) => {
      const chip = document.createElement('span');
      chip.className = 'extra-email-chip';

      const textSpan = document.createElement('span');
      textSpan.className = 'chip-email-text';
      textSpan.textContent = email;
      chip.appendChild(textSpan);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-remove-btn';
      removeBtn.setAttribute('aria-label', `Remove ${email}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = extraEmails.indexOf(email);
        if (idx !== -1) {
          extraEmails.splice(idx, 1);
          renderChips();
          clearEmailError();
        }
      });
      chip.appendChild(removeBtn);

      chipsContainer.appendChild(chip);
    });
  }

  function addSingleEmail(rawAddress) {
    const address = (rawAddress || '').trim().toLowerCase();
    if (!address) {
      return { ok: false };
    }

    if (!EMAIL_REGEX.test(address)) {
      return { ok: false, error: 'Enter a valid email address' };
    }

    if (extraEmails.includes(address)) {
      return { ok: false, error: 'Already added' };
    }

    if (extraEmails.length >= 10) {
      return { ok: false, error: 'You can add up to 10 addresses' };
    }

    extraEmails.push(address);
    return { ok: true };
  }

  function processTokens(tokens) {
    let lastError = null;
    let addedCount = 0;

    for (const token of tokens) {
      const res = addSingleEmail(token);
      if (res.ok) {
        addedCount++;
      } else if (res.error) {
        lastError = res.error;
        if (res.error === 'You can add up to 10 addresses') {
          break;
        }
      }
    }

    renderChips();

    if (lastError) {
      showEmailError(lastError);
    } else {
      clearEmailError();
    }

    return { addedCount, lastError };
  }

  function commitInputText() {
    const val = emailInput.value.trim();
    if (!val) return;

    const tokens = val.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length > 1) {
      const { lastError } = processTokens(tokens);
      if (!lastError) {
        emailInput.value = '';
      }
    } else if (tokens.length === 1) {
      const res = addSingleEmail(tokens[0]);
      if (res.ok) {
        renderChips();
        clearEmailError();
        emailInput.value = '';
      } else {
        showEmailError(res.error);
      }
    }
  }

  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') {
      const val = emailInput.value.trim();
      if (e.key === 'Tab' && !val) {
        return;
      }
      e.preventDefault();
      commitInputText();
    }
  });

  emailInput.addEventListener('input', () => {
    clearEmailError();
  });

  emailInput.addEventListener('paste', (e) => {
    const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
    if (!pastedText) return;

    const tokens = pastedText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length > 0) {
      e.preventDefault();
      const { lastError } = processTokens(tokens);
      if (!lastError) {
        emailInput.value = '';
      }
    }
  });

  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    commitInputText();
    emailInput.focus();
  });

  renderChips();
  container.appendChild(extraEmailsSection);

  return {
    getValue() {
      const effectiveCreator = isOtherCreator
        ? initialVal.creator
        : (me ? { id: me.id, name: me.fullName || me.username || 'Creator' } : (initialVal.creator || null));

      return {
        mode: currentMode,
        creator: effectiveCreator,
        members: currentMode === 'specific'
          ? Array.from(selectedMemberIds).map((id) => {
              const found = (members || []).find((m) => m.id === id);
              return {
                id,
                name: found ? found.fullName || found.username || id : id
              };
            })
          : [],
        extraEmails: [...extraEmails]
      };
    },

    validate() {
      let isValid = true;
      if (currentMode === 'specific') {
        if (selectedMemberIds.size === 0) {
          specValidationError.classList.add('visible');
          isValid = false;
        } else {
          specValidationError.classList.remove('visible');
        }
      } else if (currentMode === 'me') {
        if (!isOtherCreator && !me) {
          renderMeError();
          isValid = false;
        }
      }

      // Check for un-added email text
      if (emailInput.value.trim().length > 0) {
        showEmailError('Press Add to include this address');
        emailInput.focus();
        isValid = false;
      }

      return isValid;
    },

    destroy() {
      container.innerHTML = '';
    }
  };
}
