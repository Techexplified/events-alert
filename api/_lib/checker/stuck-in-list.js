import { trelloGet, getListInfo } from './trello.js';
import { matchesFilters } from './filters.js';

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
 * Checks for cards stuck in the configured list longer than the configured days.
 *
 * @param {object} alert - The Alert record from database
 * @param {string} token - Creator's Trello token
 * @param {object} [opts={}] - Options { daysOverride, dryRun }
 * @returns {Promise<{ ok: true, items: Array<{ cardId: string, name: string, url: string, episodeAt: Date }>, listName?: string, cardsChecked?: number } | { ok: false, message: string, status?: number }>}
 */
export async function check(alert, token, opts = {}) {
  const { daysOverride, dryRun = false } = opts;
  const listId = alert.conditions?.listId;
  if (!listId) {
    return { ok: false, message: 'No list configured for this alert' };
  }

  // 1. Verify list
  const listInfo = await getListInfo(listId, alert.boardId, token);
  if (!listInfo.ok) {
    return listInfo;
  }

  const listName = listInfo.listName;

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

  // 4. Determine entry time and stuck status
  const days = daysOverride !== undefined ? Number(daysOverride) : Number(alert.conditions?.days ?? 3);
  const now = new Date();
  const cutoffTime = now.getTime() - days * 24 * 60 * 60 * 1000;

  let loggedOneDryRunAction = false;
  const items = [];

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

      const episodeAt = entryTime(card, listId, actions);
      if (episodeAt.getTime() <= cutoffTime) {
        const daysInList = Math.max(0, Math.floor((now.getTime() - episodeAt.getTime()) / (24 * 60 * 60 * 1000)));
        items.push({
          cardId: card.id,
          name: card.name || 'Untitled Card',
          url: card.shortUrl || `https://trello.com/c/${card.id}`,
          episodeAt,
          stuckSince: episodeAt,
          daysInList
        });
      }
    })
  );

  // Sort stuck cards by longest stuck first (earliest episodeAt)
  items.sort((a, b) => a.episodeAt.getTime() - b.episodeAt.getTime());

  return {
    ok: true,
    items,
    stuckCards: items,
    listName,
    cardsChecked: matchingCards.length,
    days
  };
}

export const findStuckCards = check;
