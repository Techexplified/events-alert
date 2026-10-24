import { Resend } from 'resend';
import crypto from 'node:crypto';

/**
 * Escapes characters for safe inclusion in HTML.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Computes a deterministic idempotency key for an alert run and recipient.
 */
export function computeRecipientIdempotencyKey(alertId, recipientEmail, notificationIds = []) {
  const sortedIds = [...notificationIds].sort().join(',');
  const input = `${alertId}:${recipientEmail.toLowerCase()}:${sortedIds}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Builds the inline-styled HTML and plain text bodies for stuck card notification.
 */
export function buildEmailContent({ listName, boardName, days, cards }) {
  const escapedListName = escapeHtml(listName);
  const escapedBoardName = escapeHtml(boardName);

  const visibleCards = cards.slice(0, 20);
  const remaining = cards.length - visibleCards.length;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; background-color: #f9fafb; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <h2 style="margin-top: 0; margin-bottom: 12px; font-size: 18px; color: #111827;">Stuck Card Alert</h2>
    <p style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #4b5563;">
      The following card(s) have been in <strong>${escapedListName}</strong> for more than ${days} days:
    </p>
    <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 14px;">
      ${visibleCards
        .map(
          (c) => `
        <li style="margin-bottom: 8px;">
          <a href="${escapeHtml(c.url)}" style="color: #0284c7; text-decoration: none; font-weight: 500;" target="_blank" rel="noopener noreferrer">${escapeHtml(c.name)}</a>
          <span style="color: #6b7280;"> &mdash; in this list for ${c.daysInList} ${c.daysInList === 1 ? 'day' : 'days'}</span>
        </li>
      `
        )
        .join('')}
    </ul>
    ${
      remaining > 0
        ? `<p style="margin-top: -10px; margin-bottom: 20px; font-size: 13px; color: #6b7280; font-style: italic;">+${remaining} more</p>`
        : ''
    }
    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #6b7280;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">${escapedBoardName}</p>
      <p style="margin: 0;">You’re receiving this because you’re a recipient of this alert. Manage it in the Event Alerts Power-Up on the board.</p>
    </div>
  </div>
</body>
</html>`;

  const textLines = [
    'Stuck Card Alert',
    '',
    `The following card(s) have been in "${listName}" for more than ${days} days:`,
    '',
    ...visibleCards.map(
      (c) => `- ${c.name} (${c.url}) - in this list for ${c.daysInList} ${c.daysInList === 1 ? 'day' : 'days'}`
    )
  ];

  if (remaining > 0) {
    textLines.push(`+${remaining} more`);
  }

  textLines.push(
    '',
    '---',
    boardName,
    'You’re receiving this because you’re a recipient of this alert. Manage it in the Event Alerts Power-Up on the board.'
  );

  const text = textLines.join('\n');

  return { html, text };
}

/**
 * Sends stuck card alert emails to recipients via Resend batch endpoint.
 *
 * @param {object} params
 * @param {object} params.alert - Alert database record
 * @param {string} params.listName - Name of the list
 * @param {Array} params.cards - Stuck cards array [{ cardId, name, url, stuckSince, daysInList }]
 * @param {Array<string>} params.recipients - Email addresses of recipients
 * @param {Array<string>} params.notificationIds - AlertNotification row IDs
 * @returns {Promise<{ ok: boolean, sentCount?: number, error?: string }>}
 */
export async function sendStuckCardsAlertEmail({
  alert,
  listName,
  cards,
  recipients,
  notificationIds = []
}) {
  if (!recipients || recipients.length === 0) {
    return { ok: true, sentCount: 0 };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'PASTE_RESEND_API_KEY_HERE') {
    return { ok: false, error: 'RESEND_API_KEY is not configured' };
  }

  const from = process.env.EMAIL_FROM || 'Event Alerts <onboarding@resend.dev>';
  const resend = new Resend(apiKey);

  const days = alert.conditions?.days ?? 3;
  const boardName = alert.boardName || 'Trello Board';

  const subject = `Stuck card alert: ${cards.length} card(s) in "${listName}" for more than ${days} days.`;
  const { html, text } = buildEmailContent({ listName, boardName, days, cards });

  const emailPayloads = recipients.map((email) => {
    const idempotencyKey = computeRecipientIdempotencyKey(alert.id, email, notificationIds);
    return {
      from,
      to: [email],
      subject,
      html,
      text,
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    };
  });

  const CHUNK_SIZE = 100;
  let totalSent = 0;

  for (let i = 0; i < emailPayloads.length; i += CHUNK_SIZE) {
    const chunk = emailPayloads.slice(i, i + CHUNK_SIZE);
    const chunkKeys = chunk.map((e) => e.headers['Idempotency-Key']);
    const batchKey = crypto.createHash('sha256').update(chunkKeys.join(':')).digest('hex');

    const res = await resend.batch.send(chunk, {
      headers: {
        'Idempotency-Key': batchKey
      }
    });

    if (res.error) {
      const errorMsg =
        res.error.message || (typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
      return { ok: false, error: errorMsg, sentCount: totalSent };
    }

    totalSent += chunk.length;
  }

  return { ok: true, sentCount: totalSent };
}
