/**
 * Checks whether a card matches the saved filters.
 * A card must match all enabled filters. Within one filter, any selected value matches.
 *
 * @param {object} card - Trello card object
 * @param {object} filters - { labels?: Array, members?: Array, customField?: object }
 * @returns {boolean}
 */
export function matchesFilters(card, filters) {
  if (!filters || typeof filters !== 'object') return true;

  // 1. Labels filter
  if (Array.isArray(filters.labels) && filters.labels.length > 0) {
    const allowedLabelIds = new Set(filters.labels.map((l) => l.id));
    const cardLabelIds = card.idLabels || [];
    const matchesLabel = cardLabelIds.some((id) => allowedLabelIds.has(id));
    if (!matchesLabel) return false;
  }

  // 2. Members filter
  if (Array.isArray(filters.members) && filters.members.length > 0) {
    const allowedMemberIds = new Set(filters.members.map((m) => m.id));
    const cardMemberIds = card.idMembers || [];
    const matchesMember = cardMemberIds.some((id) => allowedMemberIds.has(id));
    if (!matchesMember) return false;
  }

  // 3. Custom field filter
  if (filters.customField && filters.customField.fieldId) {
    const { fieldId, valueId } = filters.customField;
    const customFieldItems = card.customFieldItems || [];
    const item = customFieldItems.find((cf) => cf.idCustomField === fieldId);

    if (valueId === 'true') {
      // Checkbox: must be checked
      const isChecked = item && (item.value?.checked === 'true' || item.value?.checked === true);
      if (!isChecked) return false;
    } else if (valueId === 'false') {
      // Checkbox: must be unchecked or missing
      const isChecked = item && (item.value?.checked === 'true' || item.value?.checked === true);
      if (isChecked) return false;
    } else {
      // List type custom field: match idValue or value.id
      if (!item) return false;
      const matchesValue = item.idValue === valueId || item.value?.id === valueId;
      if (!matchesValue) return false;
    }
  }

  return true;
}

