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
  'overdue-in-list': {
    fields: [
      { key: 'listId', type: 'list-select', label: 'List', required: true, placeholder: 'Select a list' },
      {
        key: 'condition',
        type: 'radio-overdue',
        label: 'Condition',
        default: 'on-due-date',
        options: [
          { value: 'on-due-date', label: 'On due date (overdue)' },
          { value: 'overdue-by-days', label: 'Overdue by more than', unit: 'day(s)', defaultDays: 1, minDays: 1, maxDays: 365 }
        ]
      }
    ],
    filters: ['label', 'member', 'customField']
  },
  'due-soon-unassigned': {
    fields: [
      { key: 'listId', type: 'list-select', label: 'List (optional)', required: false, placeholder: 'Any list' },
      {
        key: 'dueDateCondition',
        type: 'radio-due-soon',
        label: 'Due date condition',
        default: 'before-due-date',
        options: [
          { value: 'before-due-date', label: 'Before due date', unit: 'day(s)', defaultDays: 2, minDays: 1, maxDays: 365 },
          { value: 'on-due-date', label: 'On due date' }
        ]
      }
    ],
    filters: ['label', 'member', 'customField']
  },
  'custom-condition': null      // TODO
};
