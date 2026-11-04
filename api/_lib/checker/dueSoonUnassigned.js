import { trelloGet } from './trello.js';
import { matchesFilters } from './filters.js';

/**
 * Checks for cards that are due soon (or due today) and have no members assigned.
 *
 * @param {object} alert - The Alert record from database
 * @param {string} token - Creator's Trello token
 * @param {object} [opts={}] - Options { dryRun, daysOverride, nowOverride }
 * @returns {Promise<{ ok: true, items: Array<{ cardId: string, name: string, url: string, listName: string, episodeAt: Date }>, cardsChecked?: number } | { ok: false, message: string, status?: number }>}
 */
export async function check(alert, token, opts = {}) {
  const conditions = alert.conditions || {};
  const mode =
    conditions.mode ||
    (conditions.timing === 'on-due-date' || conditions.dueDateCondition === 'on-due-date' ? 'on' : 'before');

  // daysOverride overrides conditions.days in 'before' mode
  const days =
    opts.daysOverride !== undefined && opts.daysOverride !== null && opts.daysOverride !== ''
      ? Number(opts.daysOverride)
      : Number(conditions.days ?? conditions.dueSoonDays ?? 2);

  // nowOverride is supported for dry-run testing
  const now = opts.dryRun && opts.nowOverride ? new Date(opts.nowOverride) : new Date();

  // 1. Fetch open lists on board: GET /1/boards/{boardId}/lists?filter=open&fields=id,name
  const listsRes = await trelloGet(`/1/boards/${alert.boardId}/lists`, { filter: 'open', fields: 'id,name' }, token);
  if (listsRes.status === 401) {
    return { ok: false, status: 401, message: 'Creator needs to reconnect Trello' };
  }
  if (listsRes.status === 404) {
    return { ok: false, status: 404, message: 'The board was not found or is no longer accessible' };
  }
  if (!listsRes.ok) {
    return { ok: false, message: listsRes.data?.message || 'Failed to fetch lists' };
  }

  const openLists = Array.isArray(listsRes.data) ? listsRes.data : [];
  const openListsMap = new Map(openLists.map((l) => [l.id, l.name]));

  // 2. Fetch open cards: GET /1/boards/{boardId}/cards?filter=open&fields=id,name,shortUrl,due,dueComplete,idMembers,idList,idLabels
  // Add &customFieldItems=true ONLY if a custom field filter is set
  const hasCustomFieldFilter = Boolean(conditions.filters?.customField?.fieldId);
  const cardParams = {
    filter: 'open',
    fields: 'id,name,shortUrl,due,dueComplete,idMembers,idList,idLabels'
  };
  if (hasCustomFieldFilter) {
    cardParams.customFieldItems = 'true';
  }

  const cardsRes = await trelloGet(`/1/boards/${alert.boardId}/cards`, cardParams, token);
  if (cardsRes.status === 401) {
    return { ok: false, status: 401, message: 'Creator needs to reconnect Trello' };
  }
  if (cardsRes.status === 404) {
    return { ok: false, status: 404, message: 'The board was not found or is no longer accessible' };
  }
  if (!cardsRes.ok) {
    return { ok: false, message: cardsRes.data?.message || 'Failed to fetch cards' };
  }

  const cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
  const items = [];

  for (const card of cards) {
    // Drop any card whose idList is not an open list
    if (!openListsMap.has(card.idList)) {
      continue;
    }

    // card.due is set and card.dueComplete === false
    if (!card.due || card.dueComplete === true) {
      continue;
    }

    // card.idMembers is empty
    if (Array.isArray(card.idMembers) && card.idMembers.length > 0) {
      continue;
    }

    // if conditions.listId is set, card.idList === listId
    if (conditions.listId && card.idList !== conditions.listId) {
      continue;
    }

    const due = new Date(card.due);
    if (isNaN(due.getTime())) {
      continue;
    }

    if (mode === 'before') {
      // mode 'before': now <= due <= now + days*24h
      // Already-overdue cards in 'before' mode are excluded (they belong to the overdue alert).
      const nowMs = now.getTime();
      const dueMs = due.getTime();
      const windowEndMs = nowMs + days * 24 * 60 * 60 * 1000;
      if (dueMs < nowMs || dueMs > windowEndMs) {
        continue;
      }
    } else if (mode === 'on') {
      // TODO: "on" mode uses UTC because no member timezone is stored.
      // mode 'on': due falls on the same UTC calendar date as now (include due times earlier today that have already passed)
      const sameUtcDay =
        due.getUTCFullYear() === now.getUTCFullYear() &&
        due.getUTCMonth() === now.getUTCMonth() &&
        due.getUTCDate() === now.getUTCDate();
      if (!sameUtcDay) {
        continue;
      }
    } else {
      continue;
    }

    // Label & custom field filters (AND across types, OR within type)
    if (!matchesFilters(card, conditions.filters)) {
      continue;
    }

    items.push({
      cardId: card.id,
      name: card.name || 'Untitled Card',
      url: card.shortUrl || `https://trello.com/c/${card.id}`,
      listName: openListsMap.get(card.idList) || 'List',
      episodeAt: due
    });
  }

  // Sort earliest due date first
  items.sort((a, b) => a.episodeAt.getTime() - b.episodeAt.getTime());

  return {
    ok: true,
    items,
    cardsChecked: cards.length
  };
}

