import { prisma } from '../_lib/db.js';
import { requireMember, getBoardAccess, AuthError } from '../_lib/auth.js';
import { updateAlertSchema, checkForbiddenFields } from '../_lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid alert id' });
    }

    const member = await requireMember(req);

    // 1. Load the alert by id only. If it doesn't exist, return 404.
    const alert = await prisma.alert.findUnique({
      where: { id }
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // 2. Call getBoardAccess for alert.boardId. If caller isn't a member, also return 404 so non-members can't tell an alert exists.
    const access = await getBoardAccess(member.id, alert.boardId, member.token);
    if (!access.isMember) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // 3. Compute canManage on every request and never store it.
    const canManage = alert.createdByMemberId === member.id || access.isAdmin;

    // GET: returns { alert } with canManage
    if (req.method === 'GET') {
      return res.status(200).json({
        alert: {
          ...alert,
          canManage
        }
      });
    }

    // PATCH: requires canManage
    if (req.method === 'PATCH') {
      if (!canManage) {
        return res.status(403).json({
          error: "Only the alert's creator or a board admin can change this alert"
        });
      }

      const forbiddenError = checkForbiddenFields(req.body, { isCreate: false });
      if (forbiddenError) {
        return res.status(400).json({ error: forbiddenError });
      }

      const parseResult = updateAlertSchema.safeParse(req.body);
      if (!parseResult.success) {
        const shortError = parseResult.error.errors[0]?.message || 'Invalid update payload';
        return res.status(400).json({ error: shortError });
      }

      const { status, conditions, recipients } = parseResult.data;
      const dataToUpdate = {};

      if (status !== undefined) {
        dataToUpdate.status = status;
      }

      if (conditions !== undefined) {
        // Ensure conditions.alertType matches alertType if specified
        if (conditions.alertType && conditions.alertType !== alert.alertType) {
          return res.status(400).json({
            error: `conditions.alertType must match alertType '${alert.alertType}'`
          });
        }
        dataToUpdate.conditions = conditions;
      }

      if (recipients !== undefined) {
        // Always keeps the stored recipients.creator, ignoring any creator in the request
        const existingRecipients = alert.recipients || {};
        const storedCreator = existingRecipients.creator || {
          id: alert.createdByMemberId,
          name: alert.createdByName || 'Creator'
        };

        dataToUpdate.recipients = {
          ...recipients,
          creator: storedCreator
        };
      }

      const updatedAlert = await prisma.alert.update({
        where: { id },
        data: dataToUpdate
      });

      return res.status(200).json({
        alert: {
          ...updatedAlert,
          canManage: true
        }
      });
    }

    // DELETE: requires canManage
    if (req.method === 'DELETE') {
      if (!canManage) {
        return res.status(403).json({
          error: "Only the alert's creator or a board admin can change this alert"
        });
      }

      await prisma.alert.delete({
        where: { id }
      });

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('api/alerts/[id] error:', err.message || 'Unknown error');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
