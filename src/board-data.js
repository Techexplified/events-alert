// In-memory cache for Trello board resources
let cachedBoardInfo = null;
let cachedLists = null;
let cachedLabels = null;
let cachedMembers = null;
let cachedCustomFields = null;
let cachedCurrentMember = null;

// Mock fallbacks for running outside the Trello iframe
const MOCK_BOARD = {
  id: 'board-mock-1',
  name: 'Product Development'
};

const MOCK_LISTS = [
  { id: 'list-1', name: 'Product Development' },
  { id: 'list-2', name: 'In Progress' },
  { id: 'list-3', name: 'Code Review' },
  { id: 'list-4', name: 'Done' }
];

const MOCK_LABELS = [
  { id: 'lbl-1', name: 'In Progress', color: 'yellow' },
  { id: 'lbl-2', name: 'Bug', color: 'red' },
  { id: 'lbl-3', name: 'Feature', color: 'blue' },
  { id: 'lbl-4', name: 'Design', color: 'purple' },
  { id: 'lbl-5', name: '', color: 'green' }
];

const MOCK_MEMBERS = [
  { id: 'mem-1', fullName: 'Sanya Arora', username: 'sanya' },
  { id: 'mem-2', fullName: 'Rahul Kapoor', username: 'rahul' },
  { id: 'mem-3', fullName: 'Meera Patel', username: 'meera' },
  { id: 'mem-4', fullName: 'Dev Tak', username: 'dev' },
  { id: 'mem-5', fullName: 'Alex Rivera', username: 'alexr' },
  { id: 'mem-6', fullName: 'Sarah Chen', username: 'sarahc' }
];

const MOCK_CURRENT_MEMBER = {
  id: 'mem-1',
  fullName: 'Sanya Arora',
  username: 'sanya'
};

const MOCK_CUSTOM_FIELDS = [
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

export function clearBoardDataCache(key) {
  if (!key) {
    cachedBoardInfo = null;
    cachedLists = null;
    cachedLabels = null;
    cachedMembers = null;
    cachedCustomFields = null;
    cachedCurrentMember = null;
    return;
  }
  if (key === 'lists') cachedLists = null;
  if (key === 'labels') cachedLabels = null;
  if (key === 'members') cachedMembers = null;
  if (key === 'customFields') cachedCustomFields = null;
  if (key === 'board' || key === 'boardInfo') cachedBoardInfo = null;
  if (key === 'me' || key === 'currentMember') cachedCurrentMember = null;
}

export async function fetchBoardInfo(t, { forceRefresh = false } = {}) {
  if (!forceRefresh && cachedBoardInfo !== null) {
    return cachedBoardInfo;
  }

  if (t && typeof t.board === 'function') {
    try {
      const b = await t.board('id', 'name');
      cachedBoardInfo = {
        id: b && b.id ? b.id : '',
        name: b && b.name ? b.name : 'Current Board'
      };
      return cachedBoardInfo;
    } catch (err) {
      console.warn('Failed to load board info:', err);
      cachedBoardInfo = { id: '', name: 'Current Board' };
      return cachedBoardInfo;
    }
  }

  cachedBoardInfo = { ...MOCK_BOARD };
  return cachedBoardInfo;
}

export async function fetchLists(t, { forceRefresh = false } = {}) {
  if (!forceRefresh && cachedLists !== null) {
    return cachedLists;
  }

  if (t && typeof t.lists === 'function') {
    try {
      const listsRes = await t.lists('id', 'name');
      cachedLists = Array.isArray(listsRes) ? listsRes : [];
      return cachedLists;
    } catch (err) {
      console.warn('Failed to load lists:', err);
      cachedLists = null;
      return null;
    }
  }

  cachedLists = [...MOCK_LISTS];
  return cachedLists;
}

export async function fetchLabels(t, { forceRefresh = false } = {}) {
  if (!forceRefresh && cachedLabels !== null) {
    return cachedLabels;
  }

  if (t && typeof t.board === 'function') {
    try {
      const boardRes = await t.board('labels');
      cachedLabels = boardRes && Array.isArray(boardRes.labels) ? boardRes.labels : null;
      return cachedLabels;
    } catch (err) {
      console.warn('Failed to load labels:', err);
      cachedLabels = null;
      return null;
    }
  }

  cachedLabels = [...MOCK_LABELS];
  return cachedLabels;
}

export async function fetchMembers(t, { forceRefresh = false } = {}) {
  if (!forceRefresh && cachedMembers !== null) {
    return cachedMembers;
  }

  if (t && typeof t.board === 'function') {
    try {
      const boardRes = await t.board('members');
      cachedMembers = boardRes && Array.isArray(boardRes.members) ? boardRes.members : null;
      return cachedMembers;
    } catch (err) {
      console.warn('Failed to load members:', err);
      cachedMembers = null;
      return null;
    }
  }

  cachedMembers = [...MOCK_MEMBERS];
  return cachedMembers;
}

export async function fetchCustomFields(t, { forceRefresh = false } = {}) {
  if (!forceRefresh && cachedCustomFields !== null) {
    return cachedCustomFields;
  }

  if (t && typeof t.board === 'function') {
    try {
      const b = await t.board('customFields');
      cachedCustomFields = b && Array.isArray(b.customFields) ? b.customFields : [];
      console.log('Raw customFields response:', cachedCustomFields);
      return cachedCustomFields;
    } catch (err) {
      console.log('Custom Fields Power-Up not available on this board:', err);
      cachedCustomFields = null;
      return null;
    }
  }

  cachedCustomFields = [...MOCK_CUSTOM_FIELDS];
  return cachedCustomFields;
}

export async function fetchCurrentMember(t, { forceRefresh = false } = {}) {
  if (!forceRefresh && cachedCurrentMember !== null) {
    return cachedCurrentMember;
  }

  if (t && typeof t.member === 'function') {
    try {
      const meRes = await t.member('id', 'fullName', 'username');
      cachedCurrentMember = meRes && meRes.id ? meRes : null;
      return cachedCurrentMember;
    } catch (err) {
      console.warn('Failed to load current member info:', err);
      cachedCurrentMember = null;
      return null;
    }
  }

  cachedCurrentMember = { ...MOCK_CURRENT_MEMBER };
  return cachedCurrentMember;
}

/**
 * Convenience loader for all board data needed by Conditions and Review steps.
 * In-memory caching ensures each is fetched only once.
 */
export async function fetchBoardData(t, { forceRefresh = false } = {}) {
  const [lists, labels, members, customFields] = await Promise.all([
    fetchLists(t, { forceRefresh }),
    fetchLabels(t, { forceRefresh }),
    fetchMembers(t, { forceRefresh }),
    fetchCustomFields(t, { forceRefresh })
  ]);

  return { lists, labels, members, customFields };
}

/**
 * Convenience loader for Recipients data.
 */
export async function fetchRecipientData(t, { forceRefresh = false } = {}) {
  const [members, me] = await Promise.all([
    fetchMembers(t, { forceRefresh }),
    fetchCurrentMember(t, { forceRefresh })
  ]);

  const membersError = members === null;
  const meError = me === null;

  return { members, me, membersError, meError };
}
