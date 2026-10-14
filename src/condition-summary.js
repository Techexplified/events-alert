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
      const timing = cond.dueDateCondition || cond.timing || cond.condition;
      const days = cond.dueSoonDays != null ? cond.dueSoonDays : cond.days;
      if (timing === 'before-due-date' && typeof days === 'number' && days > 0) {
        return `Notify when a card is due in ${days} ${days === 1 ? 'day' : 'days'} and has no assignee.`;
      } else if (timing === 'on-due-date') {
        return 'Notify when a card is due today and has no assignee.';
      }
      return fallbackDescription;
    }

    default:
      return fallbackDescription;
  }
}
