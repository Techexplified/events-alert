import { prisma } from '../_lib/db.js';
import { requireMember, getBoardAccess, AuthError } from '../_lib/auth.js';
import { createAlertSchema, checkForbiddenFields } from '../_lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const boardId = req.query.boardId;
      if (!boardId || typeof boardId !== 'string' || !boardId.trim()) {
        return res.status(400).json({ error: 'Missing boardId query parameter' });
      }

      const member = await requireMember(req);
      const access = await getBoardAccess(member.id, boardId.trim(), member.token);

      if (!access.isMember) {
        return res.status(403).json({ error: 'Access denied: not a member of this board' });
      }

      const alerts = await prisma.alert.findMany({
        where: { boardId: boardId.trim() },
        orderBy: { createdAt: 'desc' }
      });

      const alertsWithCanManage = alerts.map((alert) => ({
        ...alert,
        canManage: alert.createdByMemberId === member.id || access.isAdmin
      }));

      return res.status(200).json({ alerts: alertsWithCanManage });
    }

    if (req.method === 'POST') {
      const member = await requireMember(req);

      const forbiddenError = checkForbiddenFields(req.body, { isCreate: true });
      if (forbiddenError) {
        return res.status(400).json({ error: forbiddenError });
      }

      const parseResult = createAlertSchema.safeParse(req.body);
      if (!parseResult.success) {
        const shortError = parseResult.error.issues?.[0]?.message || parseResult.error.errors?.[0]?.message || 'Invalid alert payload';
        return res.status(400).json({ error: shortError });
      }

      const { alertType, boardId, boardName, conditions, recipients } = parseResult.data;

      if (recipients.extraEmails && recipients.extraEmails.length > 0) {
        const suppressed = await prisma.emailSuppression.findMany({
          where: {
            email: { in: recipients.extraEmails }
          }
        });
        if (suppressed.length > 0) {
          const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));
          const blockedEmail = recipients.extraEmails.find((e) => suppressedSet.has(e.toLowerCase()));
          return res.status(400).json({ error: `${blockedEmail} has opted out of Event Alerts emails` });
        }
      }

      const access = await getBoardAccess(member.id, boardId, member.token);
      if (!access.isMember) {
        return res.status(403).json({ error: 'Access denied: not a member of this board' });
      }

      // Always stamp creator in recipients object for consistency
      const finalRecipients = {
        ...recipients,
        creator: {
          id: member.id,
          name: member.fullName || member.username || 'Creator'
        }
      };

      const newAlert = await prisma.alert.create({
        data: {
          boardId,
          boardName,
          alertType,
          conditions,
          recipients: finalRecipients,
          status: 'active',
          createdByMemberId: member.id,
          createdByName: member.fullName || member.username || null
        }
      });

      return res.status(201).json({
        alert: {
          ...newAlert,
          canManage: true
        }
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('api/alerts error:', err.message || 'Unknown error');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
