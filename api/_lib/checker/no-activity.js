import { trelloGet } from './trello.js';
import { matchesFilters } from './filters.js';

/**
 * Checks for cards on the configured board (or optional list) with no activity
 * for more than the configured number of days.
 *
 * @param {object} alert - The Alert record from database
 * @param {string} token - Creator's Trello token
 * @param {object} [opts={}] - Options { daysOverride, dryRun }
 * @returns {Promise<{ ok: true, items: Array<{ cardId: string, name: string, url: string, episodeAt: Date }>, boardName?: string, cardsChecked?: number, message?: string } | { ok: false, message: string, status?: number }>}
 */
export async function check(alert, token, opts = {}) {
  // 1. Read and validate inactivity period
  const rawDays = alert.conditions?.days;
  const parsedDays = Number(rawDays);
  if (rawDays === undefined || rawDays === null || rawDays === '' || !Number.isInteger(parsedDays) || parsedDays <= 0) {
    return { ok: false, message: 'Alert is missing its inactivity period' };
  }

  const hasOverride = opts.daysOverride !== undefined && opts.daysOverride !== null && opts.daysOverride !== '';
  const days = hasOverride ? Number(opts.daysOverride) : parsedDays;

  // 2. Fetch and verify board
  const boardRes = await trelloGet(`/1/boards/${alert.boardId}`, { fields: 'name,closed' }, token);
  if (boardRes.status === 401) {
    return { ok: false, status: 401, message: 'Creator needs to reconnect Trello' };
  }
  if (boardRes.status === 404) {
    return { ok: false, status: 404, message: 'The board was not found or is no longer accessible' };
  }
  if (!boardRes.ok) {
    return { ok: false, message: boardRes.data?.message || 'Failed to fetch board' };
  }
  if (boardRes.data?.closed) {
    return { ok: false, message: 'The board is archived' };
  }

  const boardName = boardRes.data?.name || alert.boardName || 'Board';

  // 3. Fetch cards using visible filter (excludes archived cards and cards in archived lists)
  const hasCustomFieldFilter = Boolean(alert.conditions?.filters?.customField?.fieldId);
  const params = {
    fields: 'id,name,shortUrl,idList,idLabels,idMembers,dateLastActivity,dueComplete'
  };
  if (hasCustomFieldFilter) {
    params.customFieldItems = 'true';
  }

  const cardsRes = await trelloGet(`/1/boards/${alert.boardId}/cards/visible`, params, token);
  if (cardsRes.status === 401) {
    return { ok: false, status: 401, message: 'Creator needs to reconnect Trello' };
  }
  if (!cardsRes.ok) {
    return { ok: false, message: `Failed to fetch cards: ${cardsRes.data?.message || cardsRes.status}` };
  }

  let cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
  let resultMessage = null;
  if (cards.length > 1000) {
    resultMessage = `Board has ${cards.length} cards; checked the first 1000`;
    console.log(`Alert ${alert.id}: board ${alert.boardId} has ${cards.length} cards; processing first 1000.`);
    cards = cards.slice(0, 1000);
  }

  // 4. Optional list scope
  const targetListId = alert.conditions?.listId;
  const scopedCards =
    targetListId && typeof targetListId === 'string' && targetListId.trim() !== ''
      ? cards.filter((c) => c.idList === targetListId.trim())
      : cards;

  // 5. Evaluate inactivity and filters
  const now = new Date();
  const cutoffTime = now.getTime() - days * 24 * 60 * 60 * 1000;
  const items = [];

  for (const card of scopedCards) {
    if (card.dueComplete === true) {
      continue;
    }
    if (!card.dateLastActivity) {
      continue;
    }
    const lastActivity = new Date(card.dateLastActivity);
    if (isNaN(lastActivity.getTime())) {
      continue;
    }
    if (lastActivity.getTime() > cutoffTime) {
      continue;
    }
    if (!matchesFilters(card, alert.conditions?.filters)) {
      continue;
    }

    items.push({
      cardId: card.id,
      name: card.name || 'Untitled Card',
      url: card.shortUrl || `https://trello.com/c/${card.id}`,
      episodeAt: lastActivity
    });
  }

  // Sort the most inactive first (oldest episodeAt first)
  items.sort((a, b) => a.episodeAt.getTime() - b.episodeAt.getTime());

  return {
    ok: true,
    items,
    boardName,
    cardsChecked: scopedCards.length,
    ...(resultMessage ? { message: resultMessage } : {})
  };
}

