export const conditionSchemas = {
  'stuck-in-list': {
    fields: [
      { key: 'listId', type: 'list-select', label: 'List', required: true, placeholder: 'Select a list' },
      { key: 'days', type: 'number', label: 'Number of days', unit: 'days', min: 1, max: 365, default: 3, required: true }
    ],
    filters: ['label', 'member', 'customField']
  },
  'no-activity': null,          // TODO: build when its screen is provided
  'overdue-in-list': null,      // TODO
  'due-soon-unassigned': null,  // TODO
  'custom-condition': null      // TODO
};
