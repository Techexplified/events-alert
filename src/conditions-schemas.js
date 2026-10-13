export const conditionSchemas = {
  'stuck-in-list': {
    fields: [
      { key: 'listId', type: 'list-select', label: 'List', required: true, placeholder: 'Select a list' },
      { key: 'days', type: 'number', label: 'Number of days', unit: 'days', min: 1, max: 365, default: 3, required: true }
    ],
    filters: ['label', 'member', 'customField']
  },
  'no-activity': {
    fields: [
      { key: 'listId', type: 'list-select', label: 'List (optional)', required: false, placeholder: 'Any list' },
      { key: 'days', type: 'number', label: 'Number of days', unit: 'days', min: 1, max: 365, default: 5, required: true }
    ],
    filters: ['label', 'member', 'customField']
  },
  'overdue-in-list': null,      // TODO
  'due-soon-unassigned': null,  // TODO
  'custom-condition': null      // TODO
};
