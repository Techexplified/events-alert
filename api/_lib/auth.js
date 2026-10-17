export class AuthError extends Error {
  constructor(message = 'Unauthorized', status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Reads Authorization: Bearer <token> and verifies identity with Trello.
 * Never logs tokens or URLs that contain tokens.
 */
export async function requireMember(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    throw new AuthError('Missing Authorization header', 401);
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new AuthError('Invalid Authorization format, Bearer token required', 401);
  }

  const token = parts[1];
  if (!token) {
    throw new AuthError('Missing token', 401);
  }

  const appKey = process.env.TRELLO_APP_KEY;
  if (!appKey) {
    console.error('TRELLO_APP_KEY environment variable is not configured');
    throw new Error('Server configuration error');
  }

  try {
    const url = new URL('https://api.trello.com/1/members/me');
    url.searchParams.set('key', appKey);
    url.searchParams.set('token', token);
    url.searchParams.set('fields', 'id,fullName,username');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) {
      throw new AuthError('Invalid or expired Trello token', 401);
    }

    const data = await res.json();
    return {
      id: data.id,
      fullName: data.fullName || '',
      username: data.username || '',
      token
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Failed to verify Trello member identity', 401);
  }
}

/**
 * Checks if the caller is a member and/or admin of the specified board.
 * GET /1/boards/{boardId}/memberships?key=...&token=...
 * Finds the entry where idMember === memberId && !deactivated.
 * Returns { isMember, isAdmin } where isAdmin means memberType === 'admin'.
 * Never logs tokens or URLs that contain tokens.
 */
export async function getBoardAccess(memberId, boardId, token) {
  if (!boardId || !memberId || !token) {
    return { isMember: false, isAdmin: false };
  }

  const appKey = process.env.TRELLO_APP_KEY;
  if (!appKey) {
    console.error('TRELLO_APP_KEY environment variable is not configured');
    return { isMember: false, isAdmin: false };
  }

  try {
    const url = new URL(`https://api.trello.com/1/boards/${encodeURIComponent(boardId)}/memberships`);
    url.searchParams.set('key', appKey);
    url.searchParams.set('token', token);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) {
      return { isMember: false, isAdmin: false };
    }

    const memberships = await res.json();
    if (!Array.isArray(memberships)) {
      return { isMember: false, isAdmin: false };
    }

    const entry = memberships.find((m) => m.idMember === memberId && !m.deactivated);
    if (!entry) {
      return { isMember: false, isAdmin: false };
    }

    const isMember = true;
    const isAdmin = entry.memberType === 'admin';

    return { isMember, isAdmin };
  } catch (err) {
    return { isMember: false, isAdmin: false };
  }
}
