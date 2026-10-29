import { Resend } from 'resend';
import crypto from 'node:crypto';
import { unsubscribeUrl } from '../unsubscribe.js';

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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatUtcDate(date) {
  const d = new Date(date);
  const mon = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${mon} ${day}, ${year} UTC`;
}

function getOverdueText(episodeAt) {
  const dueTime = new Date(episodeAt).getTime();
  const diffDays = Math.max(0, Math.floor((Date.now() - dueTime) / (24 * 60 * 60 * 1000)));
  if (diffDays === 0) {
    return 'less than a day overdue';
  }
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} overdue`;
}

export const templates = {
  'stuck-in-list': {
    heading: 'Stuck Card Alert',
    subject: ({ alert, listName, cards }) => {
      const days = alert?.conditions?.days ?? 3;
      return `Stuck card alert: ${cards.length} card(s) in "${listName}" for more than ${days} days.`;
    },
    intro: {
      html: ({ listName, days }) => {
        const escapedListName = escapeHtml(listName);
        return `The following card(s) have been in <strong>${escapedListName}</strong> for more than ${days} days:`;
      },
      text: ({ listName, days }) => {
        return `The following card(s) have been in "${listName}" for more than ${days} days:`;
      }
    },
    line: {
      html: (c) => {
        const daysInList =
          c.daysInList != null
            ? c.daysInList
            : Math.max(
                0,
                Math.floor((Date.now() - new Date(c.episodeAt || c.stuckSince).getTime()) / (24 * 60 * 60 * 1000))
              );
        return `<a href="${escapeHtml(c.url)}" style="color: #0284c7; text-decoration: none; font-weight: 500;" target="_blank" rel="noopener noreferrer">${escapeHtml(c.name)}</a>\n          <span style="color: #6b7280;"> &mdash; in this list for ${daysInList} ${daysInList === 1 ? 'day' : 'days'}</span>`;
      },
      text: (c) => {
        const daysInList =
          c.daysInList != null
            ? c.daysInList
            : Math.max(
                0,
                Math.floor((Date.now() - new Date(c.episodeAt || c.stuckSince).getTime()) / (24 * 60 * 60 * 1000))
              );
        return `- ${c.name} (${c.url}) - in this list for ${daysInList} ${daysInList === 1 ? 'day' : 'days'}`;
      }
    }
  },
  'overdue-in-list': {
    heading: 'Overdue Card Alert',
    subject: ({ listName, cards }) => {
      return `Overdue card alert: ${cards.length} overdue card(s) in "${listName}".`;
    },
    intro: {
      html: ({ listName, boardName }) => {
        const escapedListName = escapeHtml(listName);
        const escapedBoardName = escapeHtml(boardName);
        return `These cards are past their due date and still in the list &quot;${escapedListName}&quot; on the board &quot;${escapedBoardName}&quot;.`;
      },
      text: ({ listName, boardName }) => {
        return `These cards are past their due date and still in the list "${listName}" on the board "${boardName}".`;
      }
    },
    line: {
      html: (c) => {
        const episodeAt = c.episodeAt || c.due;
        const dateStr = formatUtcDate(episodeAt);
        const overdueStr = getOverdueText(episodeAt);
        return `<a href="${escapeHtml(c.url)}" style="color: #0284c7; text-decoration: none; font-weight: 500;" target="_blank" rel="noopener noreferrer">${escapeHtml(c.name)}</a>\n          <span style="color: #6b7280;"> &mdash; due ${dateStr}, ${overdueStr}</span>`;
      },
      text: (c) => {
        const episodeAt = c.episodeAt || c.due;
        const dateStr = formatUtcDate(episodeAt);
        const overdueStr = getOverdueText(episodeAt);
        return `- ${c.name} (${c.url}) - due ${dateStr}, ${overdueStr}`;
      }
    }
  }
};

/**
 * Builds the inline-styled HTML and plain text bodies for an alert notification.
 */
export function buildEmailContent({
  alert,
  alertType,
  listName,
  boardName,
  creatorName,
  days,
  cards,
  unsubscribeUrl: unsubUrl
}) {
  const typeKey = alertType || alert?.alertType || 'stuck-in-list';
  const template = templates[typeKey] || templates['stuck-in-list'];

  const escapedBoardName = escapeHtml(boardName);
  const escapedCreatorName = escapeHtml(creatorName || 'Alert creator');

  // Sort: most overdue first / longest stuck first (earliest episodeAt first)
  const sortedCards = [...cards].sort((a, b) => {
    const timeA = new Date(a.episodeAt || a.stuckSince).getTime();
    const timeB = new Date(b.episodeAt || b.stuckSince).getTime();
    return timeA - timeB;
  });

  const visibleCards = sortedCards.slice(0, 20);
  const remaining = sortedCards.length - visibleCards.length;

  const effectiveDays = days ?? alert?.conditions?.days ?? 3;

  const unsubscribeHtml = unsubUrl
    ? `<p style="margin: 0;"><a href="${escapeHtml(unsubUrl)}" style="color: #6b7280; text-decoration: underline;">Stop receiving these emails</a></p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; background-color: #f9fafb; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <h2 style="margin-top: 0; margin-bottom: 12px; font-size: 18px; color: #111827;">${template.heading}</h2>
    <p style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #4b5563;">
      ${template.intro.html({ alert, listName, boardName, days: effectiveDays })}
    </p>
    <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 14px;">
      ${visibleCards
        .map(
          (c) => `
        <li style="margin-bottom: 8px;">
          ${template.line.html(c)}
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
      <p style="margin: 0 0 8px 0;">${escapedCreatorName} set up this alert on the Trello board &quot;${escapedBoardName}&quot;.</p>
      <p style="margin: 0 0 8px 0;">You’re receiving this because you’re a recipient of this alert. Manage it in the Event Alerts Power-Up on the board.</p>
      ${unsubscribeHtml}
    </div>
  </div>
</body>
</html>`;

  const textLines = [
    template.heading,
    '',
    template.intro.text({ alert, listName, boardName, days: effectiveDays }),
    '',
    ...visibleCards.map((c) => template.line.text(c))
  ];

  if (remaining > 0) {
    textLines.push(`+${remaining} more`);
  }

  const effectiveCreatorName = creatorName || 'Alert creator';
  textLines.push(
    '',
    '---',
    boardName,
    `${effectiveCreatorName} set up this alert on the Trello board "${boardName}".`,
    'You’re receiving this because you’re a recipient of this alert. Manage it in the Event Alerts Power-Up on the board.'
  );

  if (unsubUrl) {
    textLines.push('', `Stop receiving these emails: ${unsubUrl}`);
  }

  const text = textLines.join('\n');

  return { html, text };
}

/**
 * Sends alert emails to recipients via Resend batch endpoint.
 *
 * @param {object} params
 * @param {object} params.alert - Alert database record
 * @param {string} params.listName - Name of the list
 * @param {Array} params.cards - Cards array [{ cardId, name, url, episodeAt }]
 * @param {Array<string>} params.recipients - Email addresses of recipients
 * @param {Array<string>} params.notificationIds - AlertNotification row IDs
 * @returns {Promise<{ ok: boolean, sentCount?: number, error?: string }>}
 */
export async function sendAlertEmail({
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

  const typeKey = alert.alertType || 'stuck-in-list';
  const template = templates[typeKey] || templates['stuck-in-list'];

  const days = alert.conditions?.days ?? 3;
  const boardName = alert.boardName || 'Trello Board';
  const creatorName = alert.createdByName || alert.recipients?.creator?.name || 'Alert creator';

  const subject = template.subject({ alert, listName, boardName, cards });

  const emailPayloads = recipients.map((email) => {
    const unsubUrl = unsubscribeUrl(email);
    const { html, text } = buildEmailContent({
      alert,
      alertType: typeKey,
      listName,
      boardName,
      creatorName,
      days,
      cards,
      unsubscribeUrl: unsubUrl
    });
    const idempotencyKey = computeRecipientIdempotencyKey(alert.id, email, notificationIds);
    return {
      from,
      to: [email],
      subject,
      html,
      text,
      headers: {
        'Idempotency-Key': idempotencyKey,
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
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

export const sendStuckCardsAlertEmail = sendAlertEmail;
