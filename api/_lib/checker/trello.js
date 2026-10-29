/**
 * Trello REST API client with concurrency limiting and retry backoff.
 * Never logs URLs or tokens.
 */

class ConcurrencyLimiter {
  constructor(limit = 4) {
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }

  async run(fn) {
    if (this.active >= this.limit) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}

const limiter = new ConcurrencyLimiter(4);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs a GET request to the Trello API with retries for 429 and 5xx.
 *
 * @param {string} path - API endpoint path (e.g. '/1/lists/123/cards')
 * @param {object} params - Query parameters
 * @param {string} token - Trello member access token
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
export async function trelloGet(path, params = {}, token) {
  return limiter.run(async () => {
    const appKey = process.env.TRELLO_APP_KEY;
    if (!appKey) {
      throw new Error('TRELLO_APP_KEY is not configured');
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`https://api.trello.com${cleanPath}`);

    url.searchParams.set('key', appKey);
    url.searchParams.set('token', token);

    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' }
        });

        // Retry on 429 Rate Limit or 5xx Server Error
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          attempt++;
          const retryAfter = res.headers.get('retry-after');
          const delay = retryAfter
            ? Math.max(1000, parseInt(retryAfter, 10) * 1000)
            : 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);

          await sleep(delay);
          continue;
        }

        let data = null;
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }

        return {
          ok: res.ok,
          status: res.status,
          data
        };
      } catch (err) {
        if (attempt < maxRetries) {
          attempt++;
          const delay = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
          await sleep(delay);
          continue;
        }
        return {
          ok: false,
          status: 0,
          data: err.message || 'Network error'
        };
      }
    }
  });
}

/**
 * Verifies that a list exists, is not closed/archived, and belongs to the given board.
 * Returns { ok: true, list, listName } or { ok: false, message, status }.
 *
 * @param {string} listId - Trello list ID
 * @param {string} boardId - Expected Trello board ID
 * @param {string} token - Member's Trello token
 * @returns {Promise<{ ok: boolean, list?: object, listName?: string, message?: string, status?: number }>}
 */
export async function getListInfo(listId, boardId, token) {
  const listRes = await trelloGet(`/1/lists/${listId}`, { fields: 'name,closed,idBoard' }, token);
  if (listRes.status === 401) {
    return { ok: false, status: 401, message: 'Creator needs to reconnect Trello' };
  }

  if (!listRes.ok || listRes.status === 404 || listRes.data?.closed || listRes.data?.idBoard !== boardId) {
    return { ok: false, message: 'The list was archived or deleted' };
  }

  return { ok: true, list: listRes.data, listName: listRes.data?.name || 'List' };
}
