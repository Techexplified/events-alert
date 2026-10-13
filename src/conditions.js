/* global TrelloPowerUp */
import { alertTypes, getIconSvg } from './alert-types.js';
import { renderStepper } from './stepper.js';
import { conditionSchemas } from './conditions-schemas.js';
import { createMultiSelect } from './multi-select.js';

// Initialize the Trello Power-Up iframe connector safely
const t = typeof window.TrelloPowerUp !== 'undefined' ? window.TrelloPowerUp.iframe() : null;

// Trello color palette mapping for label swatches
const TRELLO_LABEL_COLORS = {
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

// Navigation helpers
function openHome() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./home.html') : './home.html';
  window.location.href = targetUrl;
}

function openStep1() {
  const targetUrl = t && typeof t.signUrl === 'function' ? t.signUrl('./create-alert.html') : './create-alert.html';
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

// Fetch live board data in parallel with failure handling per source
async function fetchBoardData() {
  let lists = null;
  let labels = null;
  let members = null;
  let customFields = null;

  if (t && typeof t.lists === 'function') {
    try {
      const [listsRes, boardRes] = await Promise.all([
        t.lists('id', 'name').catch((err) => {
          console.warn('Failed to load lists:', err);
          return null;
        }),
        t.board('labels', 'members').catch((err) => {
          console.warn('Failed to load board labels/members:', err);
          return { labels: null, members: null };
        })
      ]);

      lists = Array.isArray(listsRes) ? listsRes : [];
      labels = boardRes && Array.isArray(boardRes.labels) ? boardRes.labels : null;
      members = boardRes && Array.isArray(boardRes.members) ? boardRes.members : null;
    } catch (err) {
      console.warn('Error fetching board data:', err);
    }

    try {
      const b = await t.board('customFields');
      customFields = b && Array.isArray(b.customFields) ? b.customFields : [];
      // During development, log the raw customFields response once to confirm its shape
      console.log('Raw customFields response:', customFields);
    } catch (e) {
      customFields = null; // Custom Fields Power-Up not available on this board
      console.log('Custom Fields Power-Up not available on this board');
    }
  } else {
    // Standalone fallback mock data for testing outside Trello
    console.log('Running outside Trello iframe — using mock board data');
    lists = [
      { id: 'list-1', name: 'Product Development' },
      { id: 'list-2', name: 'In Progress' },
      { id: 'list-3', name: 'Code Review' },
      { id: 'list-4', name: 'Done' }
    ];
    labels = [
      { id: 'lbl-1', name: 'Bug', color: 'red' },
      { id: 'lbl-2', name: 'Feature', color: 'blue' },
      { id: 'lbl-3', name: 'Design', color: 'purple' },
      { id: 'lbl-4', name: '', color: 'green' }
    ];
    members = [
      { id: 'mem-1', fullName: 'Alex Rivera', username: 'alexr' },
      { id: 'mem-2', fullName: 'Sarah Chen', username: 'sarahc' },
      { id: 'mem-3', fullName: 'David Kim', username: 'davidk' }
    ];
    customFields = [
      {
        id: 'cf-1',
        name: 'Priority',
        type: 'list',
        options: [
          { id: 'opt-high', value: { text: 'High' } },
          { id: 'opt-medium', value: { text: 'Medium' } },
          { id: 'opt-low', value: { text: 'Low' } }
        ]
      },
      {
        id: 'cf-2',
        name: 'Blocked',
        type: 'checkbox'
      },
      {
        id: 'cf-3',
        name: 'Story Points',
        type: 'number'
      }
    ];
    // During development, log the raw customFields response once to confirm its shape
    console.log('Raw customFields response:', customFields);
  }

  return { lists, labels, members, customFields };
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
  const { lists, labels, members, customFields } = await fetchBoardData();

  // Build the form
  container.innerHTML = '';
  container.appendChild(renderAlertBanner(alertTypeObj));

  const formSection = document.createElement('div');
  formSection.className = 'form-section';

  // State handles
  let listSelectEl = null;
  let daysInputEl = null;
  let labelsMultiSelect = null;
  let membersMultiSelect = null;
  let customFieldSelectEl = null;
  let customFieldValueSelectEl = null;

  let labelCheckboxEl = null;
  let memberCheckboxEl = null;
  let customFieldCheckboxEl = null;

  const listField = (schema.fields || []).find((f) => f.key === 'listId');
  const daysField = (schema.fields || []).find((f) => f.key === 'days');

  // 1. List field (if present in schema)
  if (listField) {
    const listGroup = document.createElement('div');
    listGroup.className = 'form-group';
    const listLabel = document.createElement('label');
    listLabel.className = 'form-label';
    listLabel.htmlFor = 'conditions-list-select';
    listLabel.textContent = listField.label || 'List';
    listGroup.appendChild(listLabel);

    const listWrapper = document.createElement('div');
    listWrapper.className = 'select-wrapper';

    listSelectEl = document.createElement('select');
    listSelectEl.id = 'conditions-list-select';
    listSelectEl.className = 'form-select';

    const defaultListOpt = document.createElement('option');
    defaultListOpt.value = '';

    if (!lists || lists.length === 0) {
      defaultListOpt.textContent = 'No lists on this board';
      listSelectEl.appendChild(defaultListOpt);
      listSelectEl.disabled = true;
    } else {
      defaultListOpt.textContent = listField.placeholder || (listField.required ? 'Select a list' : 'Any list');
      defaultListOpt.disabled = !!listField.required;
      defaultListOpt.selected = true;
      listSelectEl.appendChild(defaultListOpt);

      lists.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        // Security: render text with textContent
        opt.textContent = item.name;
        listSelectEl.appendChild(opt);
      });
    }

    listWrapper.appendChild(listSelectEl);

    const listChevron = document.createElement('span');
    listChevron.className = 'select-chevron';
    listChevron.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    listWrapper.appendChild(listChevron);
    listGroup.appendChild(listWrapper);

    const listError = document.createElement('span');
    listError.id = 'list-error';
    listError.className = 'error-message';
    listError.textContent = 'Please select a list';
    listGroup.appendChild(listError);

    formSection.appendChild(listGroup);
  }

  // 2. Number of days field (if present in schema)
  if (daysField) {
    const daysGroup = document.createElement('div');
    daysGroup.className = 'form-group';
    const daysLabel = document.createElement('label');
    daysLabel.className = 'form-label';
    daysLabel.htmlFor = 'conditions-days-input';
    daysLabel.textContent = daysField.label || 'Number of days';
    daysGroup.appendChild(daysLabel);

    const daysSuffixGroup = document.createElement('div');
    daysSuffixGroup.className = 'input-group-suffix';

    daysInputEl = document.createElement('input');
    daysInputEl.type = 'number';
    daysInputEl.id = 'conditions-days-input';
    daysInputEl.className = 'suffix-input';
    daysInputEl.min = String(daysField.min != null ? daysField.min : 1);
    daysInputEl.max = String(daysField.max != null ? daysField.max : 365);
    daysInputEl.value = String(daysField.default != null ? daysField.default : 3);
    daysSuffixGroup.appendChild(daysInputEl);

    const daysBadge = document.createElement('span');
    daysBadge.className = 'suffix-badge';
    daysBadge.textContent = daysField.unit || 'days';
    daysSuffixGroup.appendChild(daysBadge);

    daysGroup.appendChild(daysSuffixGroup);

    const daysError = document.createElement('span');
    daysError.id = 'days-error';
    daysError.className = 'error-message';
    daysError.textContent = 'Please enter a whole number of days between 1 and 365';
    daysGroup.appendChild(daysError);

    formSection.appendChild(daysGroup);
  }

  // 3. Additional filters section
  const filtersSection = document.createElement('div');
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

  // Filter Row 1: Labels
  const labelCard = document.createElement('div');
  labelCard.className = 'filter-card disabled';

  const labelHeader = document.createElement('div');
  labelHeader.className = 'filter-card-header';

  const labelLabelWrap = document.createElement('label');
  labelLabelWrap.className = 'filter-card-label-wrap';

  labelCheckboxEl = document.createElement('input');
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
  labelError.id = 'labels-filter-error';
  labelError.className = 'error-message';
  labelError.style.paddingLeft = '28px';
  labelError.textContent = 'Select at least one label';
  labelCard.appendChild(labelError);

  if (labels === null) {
    labelCheckboxEl.disabled = true;
    const note = document.createElement('div');
    note.className = 'filter-notice';
    note.textContent = 'Labels unavailable on this board';
    labelCard.appendChild(note);
  }

  filtersSection.appendChild(labelCard);

  // Populate label options
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

  labelsMultiSelect = createMultiSelect({
    container: labelMultiContainer,
    placeholder: 'Select labels',
    options: labelOptions,
    selectedIds: [],
    onChange: () => {
      labelError.classList.remove('visible');
    }
  });
  labelsMultiSelect.setDisabled(true);

  labelCheckboxEl.addEventListener('change', () => {
    if (labelCheckboxEl.checked) {
      labelCard.classList.remove('disabled');
      labelsMultiSelect.setDisabled(false);
    } else {
      labelCard.classList.add('disabled');
      labelsMultiSelect.setDisabled(true);
      labelError.classList.remove('visible');
    }
  });

  // Filter Row 2: Members
  const memberCard = document.createElement('div');
  memberCard.className = 'filter-card disabled';

  const memberHeader = document.createElement('div');
  memberHeader.className = 'filter-card-header';

  const memberLabelWrap = document.createElement('label');
  memberLabelWrap.className = 'filter-card-label-wrap';

  memberCheckboxEl = document.createElement('input');
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
  memberError.id = 'members-filter-error';
  memberError.className = 'error-message';
  memberError.style.paddingLeft = '28px';
  memberError.textContent = 'Select at least one member';
  memberCard.appendChild(memberError);

  if (members === null) {
    memberCheckboxEl.disabled = true;
    const note = document.createElement('div');
    note.className = 'filter-notice';
    note.textContent = 'Members unavailable on this board';
    memberCard.appendChild(note);
  }

  filtersSection.appendChild(memberCard);

  const memberOptions = (members || []).map((m) => ({
    id: m.id,
    label: m.fullName || m.name || m.username || 'Member',
    swatch: null
  }));

  membersMultiSelect = createMultiSelect({
    container: memberMultiContainer,
    placeholder: 'Select members',
    options: memberOptions,
    selectedIds: [],
    onChange: () => {
      memberError.classList.remove('visible');
    }
  });
  membersMultiSelect.setDisabled(true);

  memberCheckboxEl.addEventListener('change', () => {
    if (memberCheckboxEl.checked) {
      memberCard.classList.remove('disabled');
      membersMultiSelect.setDisabled(false);
    } else {
      memberCard.classList.add('disabled');
      membersMultiSelect.setDisabled(true);
      memberError.classList.remove('visible');
    }
  });

  // Filter Row 3: Custom Field
  const cfCard = document.createElement('div');
  cfCard.className = 'filter-card disabled';

  const cfHeader = document.createElement('div');
  cfHeader.className = 'filter-card-header';

  const cfLabelWrap = document.createElement('label');
  cfLabelWrap.className = 'filter-card-label-wrap';

  customFieldCheckboxEl = document.createElement('input');
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

  // Two dropdowns below header: Field and Value
  const cfRow = document.createElement('div');
  cfRow.className = 'filter-custom-fields-row';

  // Field Select
  const cfFieldWrap = document.createElement('div');
  cfFieldWrap.className = 'select-wrapper';

  customFieldSelectEl = document.createElement('select');
  customFieldSelectEl.id = 'conditions-cf-select';
  customFieldSelectEl.className = 'form-select';
  customFieldSelectEl.disabled = true;

  const defaultCfOpt = document.createElement('option');
  defaultCfOpt.value = '';
  defaultCfOpt.textContent = 'Select custom field';
  defaultCfOpt.disabled = true;
  defaultCfOpt.selected = true;
  customFieldSelectEl.appendChild(defaultCfOpt);

  // Filter supported custom fields (list and checkbox)
  const supportedCustomFields = (customFields || []).filter((f) => {
    if (f.type === 'list' || f.type === 'checkbox') {
      return true;
    }
    // TODO: support more custom field types
    return false;
  });

  supportedCustomFields.forEach((cf) => {
    const opt = document.createElement('option');
    opt.value = cf.id;
    // Security: render text with textContent
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

  customFieldValueSelectEl = document.createElement('select');
  customFieldValueSelectEl.id = 'conditions-cf-value-select';
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
  cfError.id = 'customfield-filter-error';
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

  filtersSection.appendChild(cfCard);
  formSection.appendChild(filtersSection);
  container.appendChild(formSection);

  // Helper to populate custom field value options
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
        // Security: textContent
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

  // Input change listeners to clear error messages
  if (listSelectEl) {
    listSelectEl.addEventListener('change', () => {
      listSelectEl.classList.remove('has-error');
      const listError = document.getElementById('list-error');
      if (listError) listError.classList.remove('visible');
    });
  }

  if (daysInputEl) {
    daysInputEl.addEventListener('input', () => {
      const daysSuffixGroup = daysInputEl.closest('.input-group-suffix');
      if (daysSuffixGroup) daysSuffixGroup.classList.remove('has-error');
      const daysError = document.getElementById('days-error');
      if (daysError) daysError.classList.remove('visible');
    });
  }

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

  // Prefill from draft.conditions if present and matching alertType
  if (draft.conditions && draft.conditions.alertType === draft.triggerType) {
    const cond = draft.conditions;
    if (listSelectEl) {
      if (cond.listId) {
        listSelectEl.value = cond.listId;
      } else if (listField && !listField.required) {
        listSelectEl.value = '';
      }
    }
    if (typeof cond.days === 'number' && daysInputEl) {
      daysInputEl.value = String(cond.days);
    }
    if (cond.filters) {
      if (Array.isArray(cond.filters.labels) && cond.filters.labels.length > 0 && labelCheckboxEl) {
        labelCheckboxEl.checked = true;
        labelCard.classList.remove('disabled');
        labelsMultiSelect.setDisabled(false);
        labelsMultiSelect.setSelectedIds(cond.filters.labels.map((l) => l.id));
      }
      if (Array.isArray(cond.filters.members) && cond.filters.members.length > 0 && memberCheckboxEl) {
        memberCheckboxEl.checked = true;
        memberCard.classList.remove('disabled');
        membersMultiSelect.setDisabled(false);
        membersMultiSelect.setSelectedIds(cond.filters.members.map((m) => m.id));
      }
      if (cond.filters.customField && cond.filters.customField.fieldId && customFieldCheckboxEl) {
        customFieldCheckboxEl.checked = true;
        cfCard.classList.remove('disabled');
        customFieldSelectEl.disabled = false;
        customFieldSelectEl.value = cond.filters.customField.fieldId;
        updateCustomFieldValueOptions(cond.filters.customField.fieldId, cond.filters.customField.valueId);
      }
    }
  }

  // Collect form state helper
  function collectFormState() {
    const listId = listSelectEl ? listSelectEl.value : '';
    const selectedListOpt = listSelectEl ? listSelectEl.options[listSelectEl.selectedIndex] : null;
    let listName = '';
    if (selectedListOpt) {
      listName = selectedListOpt.textContent;
    }

    const defaultDays = daysField && daysField.default != null ? daysField.default : 3;
    const daysNum = daysInputEl ? parseInt(daysInputEl.value, 10) : defaultDays;

    // Filters
    let filterLabels = null;
    if (labelCheckboxEl && labelCheckboxEl.checked) {
      const selectedIds = labelsMultiSelect.getSelectedIds();
      filterLabels = selectedIds.map((id) => {
        const found = (labels || []).find((l) => l.id === id);
        return {
          id,
          name: found ? found.name || found.color || 'Label' : id
        };
      });
    }

    let filterMembers = null;
    if (memberCheckboxEl && memberCheckboxEl.checked) {
      const selectedIds = membersMultiSelect.getSelectedIds();
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
      const fieldId = customFieldSelectEl ? customFieldSelectEl.value : '';
      const fieldOpt = customFieldSelectEl ? customFieldSelectEl.options[customFieldSelectEl.selectedIndex] : null;
      const fieldName = fieldOpt && fieldOpt.value ? fieldOpt.textContent : '';

      const valueId = customFieldValueSelectEl ? customFieldValueSelectEl.value : '';
      const valueOpt = customFieldValueSelectEl ? customFieldValueSelectEl.options[customFieldValueSelectEl.selectedIndex] : null;
      const valueLabel = valueOpt && valueOpt.value ? valueOpt.textContent : '';

      filterCustomField = {
        fieldId,
        fieldName,
        valueId,
        valueLabel
      };
    }

    return {
      alertType: draft.triggerType,
      listId: listId || null,
      listName: listName || (listField && !listField.required ? 'Any list' : ''),
      days: isNaN(daysNum) ? defaultDays : daysNum,
      filters: {
        labels: filterLabels,
        members: filterMembers,
        customField: filterCustomField
      }
    };
  }

  // Handle Back
  backBtn.addEventListener('click', async () => {
    // Save partial draft on Back
    draft.conditions = collectFormState();
    await persistDraft(draft);
    openStep1();
  });

  // Handle Next with validation
  nextBtn.addEventListener('click', async () => {
    let isValid = true;
    let firstErrorEl = null;

    // 1. Validate List (only if required)
    if (listField && listField.required) {
      const selectedListId = listSelectEl ? listSelectEl.value : '';
      if (!selectedListId) {
        listSelectEl.classList.add('has-error');
        const listError = document.getElementById('list-error');
        if (listError) listError.classList.add('visible');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = listSelectEl;
      } else {
        listSelectEl.classList.remove('has-error');
        const listError = document.getElementById('list-error');
        if (listError) listError.classList.remove('visible');
      }
    } else if (listSelectEl) {
      listSelectEl.classList.remove('has-error');
      const listError = document.getElementById('list-error');
      if (listError) listError.classList.remove('visible');
    }

    // 2. Validate Days
    if (daysField && daysField.required !== false) {
      const daysRaw = daysInputEl ? daysInputEl.value.trim() : '';
      const daysNum = Number(daysRaw);
      const minDays = daysField.min != null ? daysField.min : 1;
      const maxDays = daysField.max != null ? daysField.max : 365;
      const daysSuffixGroup = daysInputEl ? daysInputEl.closest('.input-group-suffix') : null;
      const daysError = document.getElementById('days-error');

      if (!daysRaw || !Number.isInteger(daysNum) || daysNum < minDays || daysNum > maxDays) {
        if (daysSuffixGroup) daysSuffixGroup.classList.add('has-error');
        if (daysError) daysError.classList.add('visible');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = daysInputEl;
      } else {
        if (daysSuffixGroup) daysSuffixGroup.classList.remove('has-error');
        if (daysError) daysError.classList.remove('visible');
      }
    }

    // 3. Validate Filters if checked
    if (labelCheckboxEl && labelCheckboxEl.checked) {
      const labelIds = labelsMultiSelect.getSelectedIds();
      if (!labelIds || labelIds.length === 0) {
        labelError.classList.add('visible');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = labelCard;
      } else {
        labelError.classList.remove('visible');
      }
    } else {
      labelError.classList.remove('visible');
    }

    if (memberCheckboxEl && memberCheckboxEl.checked) {
      const memberIds = membersMultiSelect.getSelectedIds();
      if (!memberIds || memberIds.length === 0) {
        memberError.classList.add('visible');
        isValid = false;
        if (!firstErrorEl) firstErrorEl = memberCard;
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
        if (!firstErrorEl) firstErrorEl = cfCard;
      } else {
        cfError.classList.remove('visible');
        customFieldSelectEl.classList.remove('has-error');
        customFieldValueSelectEl.classList.remove('has-error');
      }
    } else {
      cfError.classList.remove('visible');
    }

    // If validation fails, scroll to first error and do not proceed
    if (!isValid) {
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Backend contract: store IDs (the scheduled backend job matches on IDs), plus names for display only.
    // Filter semantics: a card must match ALL enabled filters; within one filter, ANY selected value matches.
    // TODO: confirm these semantics before building the backend.
    draft.conditions = collectFormState();

    await persistDraft(draft);

    // TODO: step 3 (Recipients) page not built yet
    console.log('proceeding to step 3 (Recipients) with draft:', draft);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initConditionsPage();
});
