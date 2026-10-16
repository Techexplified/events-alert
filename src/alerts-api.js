const STORAGE_KEY = 'alertsList';

// Seed initial alerts matching the design screenshot if none exist
const DEFAULT_ALERTS = [
  {
    id: 'alert-1',
    alertType: 'stuck-in-list',
    status: 'active',
    boardId: 'board-mock-1',
    boardName: 'Product Development',
    conditions: {
      alertType: 'stuck-in-list',
      listId: 'list-2',
      listName: 'In Progress',
      days: 3,
      filters: null
    },
    recipients: {
      mode: 'me',
      creator: { id: 'mem-1', name: 'Sanya Arora' },
      members: [],
      frequency: 'immediate'
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'alert-2',
    alertType: 'no-activity',
    status: 'active',
    boardId: 'board-mock-2',
    boardName: 'Marketing',
    conditions: {
      alertType: 'no-activity',
      listId: null,
      listName: 'Any list',
      days: 5,
      filters: null
    },
    recipients: {
      mode: 'me',
      creator: { id: 'mem-1', name: 'Sanya Arora' },
      members: [],
      frequency: 'immediate'
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'alert-3',
    alertType: 'overdue-in-list',
    status: 'active',
    boardId: 'board-mock-3',
    boardName: 'Client Projects',
    conditions: {
      alertType: 'overdue-in-list',
      listId: 'list-on-hold',
      listName: 'On Hold',
      condition: 'on-due-date',
      timing: 'on-due-date',
      days: 0,
      filters: null
    },
    recipients: {
      mode: 'specific',
      members: [
        { id: 'mem-1', name: 'Sanya Arora' },
        { id: 'mem-2', name: 'Rahul Kapoor' }
      ],
      frequency: 'immediate'
    },
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'alert-4',
    alertType: 'due-soon-unassigned',
    status: 'paused',
    boardId: 'board-mock-1',
    boardName: 'Product Development',
    conditions: {
      alertType: 'due-soon-unassigned',
      listId: null,
      listName: 'Any list',
      dueDateCondition: 'before-due-date',
      timing: 'before-due-date',
      days: 2,
      dueSoonDays: 2,
      filters: null
    },
    recipients: {
      mode: 'me',
      creator: { id: 'mem-1', name: 'Sanya Arora' },
      members: [],
      frequency: 'immediate'
    },
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
  }
];

// Helper to load alerts array from storage
async function loadStoredAlerts(t) {
  let list = null;

  if (t && typeof t.get === 'function') {
    try {
      list = await t.get('board', 'shared', STORAGE_KEY);
    } catch (err) {
      console.warn('Error reading alerts from Trello storage:', err);
    }
  }

  if (!list) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        list = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Error reading alerts from localStorage:', err);
    }
  }

  if (!Array.isArray(list)) {
    list = [...DEFAULT_ALERTS];
    await persistStoredAlerts(list, t);
  }

  return list;
}

// Helper to persist alerts array to storage
async function persistStoredAlerts(list, t) {
  if (t && typeof t.set === 'function') {
    try {
      await t.set('board', 'shared', STORAGE_KEY, list);
    } catch (err) {
      console.warn('Error saving alerts to Trello storage:', err);
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error saving alerts to localStorage:', err);
  }
}

/**
 * Fetch all alerts
 */
export async function getAlerts(t = null) {
  return await loadStoredAlerts(t);
}

/**
 * Create a new alert
 */
export async function createAlert(payload, t = null) {
  console.log('createAlert payload:', payload);
  await new Promise((r) => setTimeout(r, 600));

  const list = await loadStoredAlerts(t);
  const newId = 'alert-' + Date.now();
  const newAlert = {
    ...payload,
    id: newId,
    status: payload.status || 'active',
    createdAt: payload.createdAt || new Date().toISOString()
  };

  list.unshift(newAlert);
  await persistStoredAlerts(list, t);

  return { id: newId };
}

/**
 * Update an existing alert
 */
export async function updateAlert(id, payload, t = null) {
  console.log('updateAlert', id, payload);
  await new Promise((r) => setTimeout(r, 600));

  const list = await loadStoredAlerts(t);
  const index = list.findIndex((a) => a.id === id);
  if (index !== -1) {
    list[index] = {
      ...list[index],
      ...payload,
      id,
      updatedAt: new Date().toISOString()
    };
    await persistStoredAlerts(list, t);
  }

  return { id };
}

/**
 * Delete an alert
 */
export async function deleteAlert(id, t = null) {
  console.log('deleteAlert', id);
  await new Promise((r) => setTimeout(r, 600));

  const list = await loadStoredAlerts(t);
  const updatedList = list.filter((a) => a.id !== id);
  await persistStoredAlerts(updatedList, t);

  return { id };
}

/**
 * Toggle an alert's status between 'active' and 'paused'
 */
export async function toggleAlertStatus(id, t = null) {
  const list = await loadStoredAlerts(t);
  const item = list.find((a) => a.id === id);
  if (!item) return null;

  item.status = item.status === 'active' ? 'paused' : 'active';
  item.updatedAt = new Date().toISOString();
  await persistStoredAlerts(list, t);

  return item.status;
}
