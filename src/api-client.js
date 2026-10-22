export class NotAuthorizedError extends Error {}
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

import { getTrello } from './trello-instance.js';

export async function getToken(t, { interactive = false } = {}) {
  let trello = t || getTrello();

  if (!trello || typeof trello.getRestApi !== 'function') {
    throw new Error('Trello Power-Up context is not available');
  }

  const restApi = await trello.getRestApi();
  if (!(await restApi.isAuthorized())) {
    if (!interactive) throw new NotAuthorizedError();
    // 'account' is requested now so the creator's email can be read later without a second consent prompt.
    const returnUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/authorized.html`
      : undefined;
    await restApi.authorize({ scope: 'read,account', returnUrl });
  }
  return restApi.getToken();
}

export async function apiFetch(t, path, { method = 'GET', body, interactive = false } = {}) {
  const token = await getToken(t, { interactive });
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    const restApi = await t.getRestApi();
    await restApi.clearToken(); // revoked or expired, so the next interactive call re-authorizes
    throw new NotAuthorizedError();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed');
  return data;
}
