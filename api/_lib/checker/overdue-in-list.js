import { trelloGet, getListInfo } from './trello.js';
import { matchesFilters } from './filters.js';

/**
 * Checks for cards in the configured list that are overdue and not marked complete.
 *
 * @param {object} alert - The Alert record from database
 * @param {string} token - Creator's Trello token
 * @param {object} [_opts={}] - Options (unused for overdue)
 * @returns {Promise<{ ok: true, items: Array<{ cardId: string, name: string, url: string, episodeAt: Date }>, listName?: string, cardsChecked?: number } | { ok: false, message: string, status?: number }>}
 */
export async function check(alert, token, _opts = {}) {
  const listId = alert.conditions?.listId;
  if (!listId) {
    return { ok: false, message: 'Alert is missing its list' };
  }

  // 1. Verify list
  const listInfo = await getListInfo(listId, alert.boardId, token);
  if (!listInfo.ok) {
    return listInfo;
  }

  const listName = listInfo.listName;

  // 2. GET /1/lists/{listId}/cards?fields=id,name,shortUrl,idLabels,idMembers,due,dueComplete&customFieldItems=true
  const cardsRes = await trelloGet(
    `/1/lists/${listId}/cards`,
    {
      fields: 'id,name,shortUrl,idLabels,idMembers,due,dueComplete',
      customFieldItems: 'true'
    },
    token
  );

  if (cardsRes.status === 401) {
    return { ok: false, status: 401, message: 'Creator needs to reconnect Trello' };
  }

  if (!cardsRes.ok) {
    return { ok: false, message: `Failed to fetch cards: ${cardsRes.data?.message || cardsRes.status}` };
  }

  let cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
  if (cards.length > 200) {
    console.log(`Alert ${alert.id}: list ${listId} has ${cards.length} cards; processing first 200.`);
    cards = cards.slice(0, 200);
  }

  // 3. Apply filters
  const matchingCards = cards.filter((card) => matchesFilters(card, alert.conditions?.filters));

  // 4. Determine overdue condition and optional threshold
  const conditions = alert.conditions || {};
  const timing = conditions.timing || conditions.condition || 'on-due-date';
  const overdueDays =
    conditions.overdueDays != null
      ? Number(conditions.overdueDays)
      : conditions.days != null
      ? Number(conditions.days)
      : 0;

  const now = new Date();
  const nowMs = now.getTime();

  let thresholdMs = 0;
  if (timing === 'overdue-by-days' && overdueDays > 0) {
    thresholdMs = overdueDays * 24 * 60 * 60 * 1000;
  }

  const items = [];

  for (const card of matchingCards) {
    if (!card.due) continue;
    if (card.dueComplete === true) continue;

    const dueAt = new Date(card.due);
    const dueMs = dueAt.getTime();
    if (isNaN(dueMs)) continue;

    if (thresholdMs > 0) {
      if (dueMs <= nowMs - thresholdMs) {
        items.push({
          cardId: card.id,
          name: card.name || 'Untitled Card',
          url: card.shortUrl || `https://trello.com/c/${card.id}`,
          episodeAt: dueAt
        });
      }
    } else {
      if (dueMs < nowMs) {
        items.push({
          cardId: card.id,
          name: card.name || 'Untitled Card',
          url: card.shortUrl || `https://trello.com/c/${card.id}`,
          episodeAt: dueAt
        });
      }
    }
  }

  // Sort with the most overdue first (earliest due date)
  items.sort((a, b) => a.episodeAt.getTime() - b.episodeAt.getTime());

  return {
    ok: true,
    items,
    listName,
    cardsChecked: matchingCards.length
  };
}

