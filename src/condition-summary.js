import { alertTypes } from './alert-types.js';

/**
 * Generates a one-line human-readable summary of the saved conditions in an alert draft.
 * Used for the banner in the Recipients step.
 *
 * @param {object} draft - The current alert draft.
 * @returns {string} The summary description string.
 */
export function summarizeConditions(draft) {
  if (!draft) return '';

  const cond = draft.conditions;
  const alertType = cond && cond.alertType ? cond.alertType : draft.triggerType;
  const typeObj = alertTypes.find((t) => t.id === alertType);
  const fallbackDescription = typeObj ? typeObj.description : '';

  if (!cond || !cond.alertType) {
    return fallbackDescription;
  }

  switch (cond.alertType) {
    case 'stuck-in-list': {
      const days = cond.days;
      if (typeof days === 'number' && days > 0) {
        return `Notify when a card stays in the same list for more than ${days} ${days === 1 ? 'day' : 'days'}.`;
      }
      return fallbackDescription;
    }

    case 'no-activity': {
      const days = cond.days;
      if (typeof days === 'number' && days > 0) {
        return `Notify when a card has no activity for more than ${days} ${days === 1 ? 'day' : 'days'}.`;
      }
      return fallbackDescription;
    }

    case 'overdue-in-list': {
      const timing = cond.timing || cond.condition;
      const days = cond.overdueDays != null ? cond.overdueDays : cond.days;
      if (timing === 'overdue-by-days' && typeof days === 'number' && days > 0) {
        return `Notify when a card is overdue by more than ${days} ${days === 1 ? 'day' : 'days'}.`;
      } else if (timing === 'on-due-date') {
        return 'Notify when a card is overdue on its due date.';
      }
      return fallbackDescription;
    }

    case 'due-soon-unassigned': {
      const mode = cond.mode || (cond.dueDateCondition === 'on-due-date' || cond.timing === 'on-due-date' || cond.condition === 'on-due-date' ? 'on' : 'before');
      const isBefore = mode === 'before';
      const days = cond.days != null ? cond.days : (cond.dueSoonDays != null ? cond.dueSoonDays : 2);
      const timeStr = isBefore ? `due within ${days} ${days === 1 ? 'day' : 'days'}` : 'due today';
      const listStr = cond.listId && cond.listName && cond.listName !== 'Any list'
        ? `(${cond.listName})`
        : '(any list)';
      let text = `Unassigned cards ${timeStr} ${listStr}`;

      const filterParts = [];
      if (cond.filters) {
        if (Array.isArray(cond.filters.labels) && cond.filters.labels.length > 0) {
          const labelNames = cond.filters.labels.map((l) => l.name || 'unnamed').join(', ');
          filterParts.push(`label: ${labelNames}`);
        }
        if (cond.filters.customField && cond.filters.customField.fieldName && cond.filters.customField.valueLabel) {
          filterParts.push(`${cond.filters.customField.fieldName} = "${cond.filters.customField.valueLabel}"`);
        }
      }
      if (filterParts.length > 0) {
        text += `, filtered by ${filterParts.join(', ')}`;
      }
      return `${text}.`;
    }

    default:
      return fallbackDescription;
  }
}
