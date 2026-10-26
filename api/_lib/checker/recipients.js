import { prisma } from '../db.js';
import { trelloGet } from './trello.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves the recipient email addresses for an alert based on recipients mode:
 * - 'me': alert creator's credential
 * - 'specific': configured members' credentials
 * - 'all': all board members' credentials
 *
 * Skips credentials without email or with invalidAt set, counting them as unreachable.
 * Deduplicates and lowercases emails.
 *
 * @param {object} alert - Alert record
 * @param {string} creatorToken - Creator's Trello token
 * @returns {Promise<{ emails: string[], unreachable: number }>}
 */
export async function resolveRecipients(alert, creatorToken) {
  const mode = alert.recipients?.mode || 'me';
  let memberIds = [];

  if (mode === 'me') {
    const creatorId = alert.recipients?.creator?.id || alert.createdByMemberId;
    if (creatorId) {
      memberIds = [creatorId];
    }
  } else if (mode === 'specific') {
    const members = alert.recipients?.members || [];
    memberIds = members.map((m) => m?.id).filter(Boolean);
  } else if (mode === 'all') {
    const boardRes = await trelloGet(`/1/boards/${alert.boardId}/members`, { fields: 'id' }, creatorToken);
    if (boardRes.ok && Array.isArray(boardRes.data)) {
      memberIds = boardRes.data.map((m) => m.id).filter(Boolean);
    } else {
      console.error(`Failed to fetch board members for board ${alert.boardId}`);
    }
  }

  const uniqueMemberIds = [...new Set(memberIds)];
  const memberEmails = new Set();
  let unreachable = 0;

  if (uniqueMemberIds.length > 0) {
    const credentials = await prisma.trelloCredential.findMany({
      where: {
        memberId: { in: uniqueMemberIds }
      }
    });

    const credMap = new Map();
    for (const c of credentials) {
      credMap.set(c.memberId, c);
    }

    for (const memberId of uniqueMemberIds) {
      const cred = credMap.get(memberId);
      if (!cred || !cred.email || !cred.email.trim() || cred.invalidAt !== null) {
        unreachable++;
        continue;
      }

      const email = cred.email.trim().toLowerCase();
      if (EMAIL_REGEX.test(email)) {
        memberEmails.add(email);
      } else {
        unreachable++;
      }
    }
  }

  // Extra emails from alert recipients configuration
  const rawExtraEmails = Array.isArray(alert.recipients?.extraEmails) ? alert.recipients.extraEmails : [];
  const validExtraEmails = rawExtraEmails
    .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
    .filter((e) => EMAIL_REGEX.test(e));

  // Merge emails from Trello members and extraEmails, deduplicating across both
  const candidateEmails = Array.from(new Set([...memberEmails, ...validExtraEmails]));

  if (candidateEmails.length === 0) {
    return {
      emails: [],
      unreachable
    };
  }

  // Drop any address in EmailSuppression
  const suppressed = await prisma.emailSuppression.findMany({
    where: {
      email: { in: candidateEmails }
    }
  });
  const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));
  const finalEmails = candidateEmails.filter((email) => !suppressedSet.has(email));

  return {
    emails: finalEmails,
    unreachable
  };
}
