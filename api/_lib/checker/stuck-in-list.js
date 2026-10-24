import { trelloGet } from './trello.js';

const ENTRY_FILTER = 'createCard,copyCard,moveCardToBoard,convertToCardFromCheckItem,updateCard:idList';

/**
 * Calculates the entry time of a card into a list using action history,
 * falling back to card creation time encoded in its ObjectId.
 */
function entryTime(card, listId, actions) {
  for (const a of actions) {
    const target = a.data?.listAfter?.id ?? a.data?.list?.id;
    if (target === listId) return new Date(a.date);
  }
  // No entry action found: fall back to the card's creation time, which is encoded in its id.
  return new Date(parseInt(card.id.substring(0, 8), 16) * 1000);
}

/**
 * Checks whether a card matches the saved filters.
 * A card must match all enabled filters. Within one filter, any selected value matches.
 */
function matchesFilters(card, filters) {
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

/**
 * Finds cards that have been stuck in the configured list longer than the configured days.
 *
 * @param {object} alert - The Alert record from database
 * @param {string} token - Creator's Trello token
 * @param {object} options - { daysOverride, dryRun }
 * @returns {Promise<{ ok: boolean, listName?: string, cardsChecked?: number, stuckCards?: Array, error?: string, status?: number }>}
 */
export async function findStuckCards(alert, token, { daysOverride, dryRun = false } = {}) {
  const listId = alert.conditions?.listId;
  if (!listId) {
    return { ok: false, error: 'No list configured for this alert' };
  }

  // 1. GET /1/lists/{listId}?fields=name,closed,idBoard
  const listRes = await trelloGet(`/1/lists/${listId}`, { fields: 'name,closed,idBoard' }, token);
  if (listRes.status === 401) {
    return { ok: false, status: 401, error: 'Creator needs to reconnect Trello' };
  }

  if (!listRes.ok || listRes.status === 404 || listRes.data?.closed || listRes.data?.idBoard !== alert.boardId) {
    return { ok: false, error: 'The list was archived or deleted' };
  }

  const listName = listRes.data.name || 'List';

  // 2. GET /1/lists/{listId}/cards?fields=id,name,shortUrl,idLabels,idMembers,dateLastActivity&customFieldItems=true
  const cardsRes = await trelloGet(
    `/1/lists/${listId}/cards`,
    {
      fields: 'id,name,shortUrl,idLabels,idMembers,dateLastActivity',
      customFieldItems: 'true'
    },
    token
  );

  if (cardsRes.status === 401) {
    return { ok: false, status: 401, error: 'Creator needs to reconnect Trello' };
  }

  if (!cardsRes.ok) {
    return { ok: false, error: `Failed to fetch cards: ${cardsRes.data?.message || cardsRes.status}` };
  }

  let cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
  if (cards.length > 200) {
    console.log(`Alert ${alert.id}: list ${listId} has ${cards.length} cards; processing first 200.`);
    cards = cards.slice(0, 200);
  }

  // 3. Apply filters
  const matchingCards = cards.filter((card) => matchesFilters(card, alert.conditions?.filters));

  // 4. Determine entry time and stuck status
  const days = daysOverride !== undefined ? Number(daysOverride) : Number(alert.conditions?.days ?? 3);
  const now = new Date();
  const cutoffTime = now.getTime() - days * 24 * 60 * 60 * 1000;

  let loggedOneDryRunAction = false;
  const stuckCards = [];

  await Promise.all(
    matchingCards.map(async (card) => {
      const actionsRes = await trelloGet(
        `/1/cards/${card.id}/actions`,
        {
          filter: ENTRY_FILTER,
          limit: 50
        },
        token
      );

      const actions = actionsRes.ok && Array.isArray(actionsRes.data) ? actionsRes.data : [];

      if (dryRun && !loggedOneDryRunAction && actions.length > 0) {
        loggedOneDryRunAction = true;
        console.log('[dry-run] Sample entry action payload:', JSON.stringify(actions[0], null, 2));
      }

      const stuckSince = entryTime(card, listId, actions);
      if (stuckSince.getTime() <= cutoffTime) {
        const daysInList = Math.max(0, Math.floor((now.getTime() - stuckSince.getTime()) / (24 * 60 * 60 * 1000)));
        stuckCards.push({
          cardId: card.id,
          name: card.name || 'Untitled Card',
          url: card.shortUrl || `https://trello.com/c/${card.id}`,
          stuckSince,
          daysInList
        });
      }
    })
  );

  // Sort stuck cards by longest stuck first
  stuckCards.sort((a, b) => a.stuckSince.getTime() - b.stuckSince.getTime());

  return {
    ok: true,
    listName,
    cardsChecked: matchingCards.length,
    stuckCards,
    days
  };
}
