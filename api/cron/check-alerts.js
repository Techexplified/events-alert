import { prisma } from '../_lib/db.js';
import { decrypt } from '../_lib/crypto.js';
import { findStuckCards } from '../_lib/checker/stuck-in-list.js';
import { resolveRecipients } from '../_lib/checker/recipients.js';
import { sendStuckCardsAlertEmail } from '../_lib/checker/email.js';

/**
 * Checks a single 'stuck-in-list' alert.
 */
async function checkStuckInListAlert(alert, { dryRun = false, daysOverride = undefined } = {}) {
  const skipDatabaseWrites = dryRun || daysOverride !== undefined;
  const creatorMemberId = alert.createdByMemberId || alert.recipients?.creator?.id;

  // 1. Load creator credential
  const cred = await prisma.trelloCredential.findUnique({
    where: { memberId: creatorMemberId }
  });

  if (!cred || !cred.tokenEnc) {
    if (!skipDatabaseWrites) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: 'error',
          lastCheckMessage: 'Creator needs to reconnect Trello'
        }
      });
    }
    return {
      alertId: alert.id,
      status: 'error',
      cardsChecked: 0,
      stuckCount: 0,
      newlyStuck: 0,
      emailsSent: 0,
      unreachable: 0,
      message: 'Creator needs to reconnect Trello'
    };
  }

  let creatorToken = null;
  try {
    creatorToken = decrypt(cred.tokenEnc);
  } catch (err) {
    // Decryption failed (e.g. invalid key)
  }

  if (!creatorToken || cred.invalidAt !== null) {
    if (!skipDatabaseWrites) {
      if (!cred.invalidAt) {
        await prisma.trelloCredential.update({
          where: { memberId: cred.memberId },
          data: { invalidAt: new Date() }
        });
      }
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: 'error',
          lastCheckMessage: 'Creator needs to reconnect Trello'
        }
      });
    }
    return {
      alertId: alert.id,
      status: 'error',
      cardsChecked: 0,
      stuckCount: 0,
      newlyStuck: 0,
      emailsSent: 0,
      unreachable: 0,
      message: 'Creator needs to reconnect Trello'
    };
  }

  // 2. Find stuck cards
  const stuckResult = await findStuckCards(alert, creatorToken, { daysOverride, dryRun });

  if (stuckResult.status === 401) {
    if (!skipDatabaseWrites) {
      await prisma.trelloCredential.update({
        where: { memberId: cred.memberId },
        data: { invalidAt: new Date() }
      });
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: 'error',
          lastCheckMessage: 'Creator needs to reconnect Trello'
        }
      });
    }
    return {
      alertId: alert.id,
      status: 'error',
      cardsChecked: 0,
      stuckCount: 0,
      newlyStuck: 0,
      emailsSent: 0,
      unreachable: 0,
      message: 'Creator needs to reconnect Trello'
    };
  }

  if (!stuckResult.ok) {
    if (!skipDatabaseWrites) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: 'error',
          lastCheckMessage: stuckResult.error
        }
      });
    }
    return {
      alertId: alert.id,
      status: 'error',
      cardsChecked: stuckResult.cardsChecked || 0,
      stuckCount: 0,
      newlyStuck: 0,
      emailsSent: 0,
      unreachable: 0,
      message: stuckResult.error
    };
  }

  const stuckCards = stuckResult.stuckCards || [];
  const cardsChecked = stuckResult.cardsChecked || 0;

  let newlyStuck = 0;
  let unsentRows = [];

  if (!skipDatabaseWrites) {
    // Delete unsent rows for cards that are no longer stuck
    const currentStuckCardIds = stuckCards.map((c) => c.cardId);
    await prisma.alertNotification.deleteMany({
      where: {
        alertId: alert.id,
        sentAt: null,
        cardId: { notIn: currentStuckCardIds }
      }
    });

    // Create AlertNotification rows for stuck cards, skipping any existing for same (alertId, cardId, stuckSince)
    for (const card of stuckCards) {
      const existing = await prisma.alertNotification.findUnique({
        where: {
          alertId_cardId_stuckSince: {
            alertId: alert.id,
            cardId: card.cardId,
            stuckSince: card.stuckSince
          }
        }
      });

      if (!existing) {
        await prisma.alertNotification.create({
          data: {
            alertId: alert.id,
            cardId: card.cardId,
            cardName: card.name,
            cardUrl: card.url,
            stuckSince: card.stuckSince
          }
        });
        newlyStuck++;
      }
    }

    unsentRows = await prisma.alertNotification.findMany({
      where: {
        alertId: alert.id,
        sentAt: null
      },
      orderBy: { stuckSince: 'asc' }
    });
  } else {
    // In dryRun or daysOverride, compute newlyStuck without writing to database
    for (const card of stuckCards) {
      const existing = await prisma.alertNotification.findUnique({
        where: {
          alertId_cardId_stuckSince: {
            alertId: alert.id,
            cardId: card.cardId,
            stuckSince: card.stuckSince
          }
        }
      });
      if (!existing) {
        newlyStuck++;
      }
    }
  }

  // 3. Work out whether to send
  let shouldSend = false;

  if (daysOverride !== undefined) {
    // In daysOverride test mode, send immediately if there are stuck cards
    if (stuckCards.length === 0) {
      return {
        alertId: alert.id,
        status: 'ok',
        cardsChecked,
        stuckCount: 0,
        newlyStuck: 0,
        emailsSent: 0,
        unreachable: 0,
        message: 'No stuck cards'
      };
    }
    shouldSend = true;
  } else {
    if (unsentRows.length === 0 && !dryRun) {
      if (!skipDatabaseWrites) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            lastCheckedAt: new Date(),
            lastCheckStatus: 'ok',
            lastCheckMessage: null
          }
        });
      }
      return {
        alertId: alert.id,
        status: 'ok',
        cardsChecked,
        stuckCount: stuckCards.length,
        newlyStuck: 0,
        emailsSent: 0,
        unreachable: 0,
        message: null
      };
    }

    const frequency = alert.recipients?.frequency || 'immediate';
    if (frequency === 'immediate') {
      shouldSend = unsentRows.length > 0 || (dryRun && stuckCards.length > 0);
    } else if (frequency === 'daily') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (!alert.lastDigestSentAt || new Date(alert.lastDigestSentAt) < oneDayAgo) {
        shouldSend = unsentRows.length > 0 || (dryRun && stuckCards.length > 0);
      }
    } else if (frequency === 'weekly') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (!alert.lastDigestSentAt || new Date(alert.lastDigestSentAt) < sevenDaysAgo) {
        shouldSend = unsentRows.length > 0 || (dryRun && stuckCards.length > 0);
      }
    }

    if (!shouldSend) {
      if (!skipDatabaseWrites) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            lastCheckedAt: new Date(),
            lastCheckStatus: 'ok',
            lastCheckMessage: null
          }
        });
      }
      return {
        alertId: alert.id,
        status: 'ok',
        cardsChecked,
        stuckCount: stuckCards.length,
        newlyStuck,
        emailsSent: 0,
        unreachable: 0,
        message: null
      };
    }
  }

  // 4. Resolve recipients
  const { emails, unreachable } = await resolveRecipients(alert, creatorToken);

  if (emails.length === 0) {
    const message = `No reachable recipients (${unreachable} unreachable)`;
    if (!skipDatabaseWrites) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: 'no_recipients',
          lastCheckMessage: message
        }
      });
    }
    return {
      alertId: alert.id,
      status: 'no_recipients',
      cardsChecked,
      stuckCount: stuckCards.length,
      newlyStuck,
      emailsSent: 0,
      unreachable,
      message
    };
  }

  // 5. Send emails
  if (dryRun) {
    return {
      alertId: alert.id,
      status: 'ok',
      cardsChecked,
      stuckCount: stuckCards.length,
      newlyStuck,
      emailsSent: 0,
      unreachable,
      message: `[dry-run] Would send alert to ${emails.length} recipient(s)`
    };
  }

  let cardsToSend = [];
  let notificationIds = [];

  if (daysOverride !== undefined) {
    cardsToSend = stuckCards;
    notificationIds = stuckCards.map((c) => c.cardId);
  } else {
    notificationIds = unsentRows.map((r) => r.id);
    cardsToSend = unsentRows.map((r) => ({
      cardId: r.cardId,
      name: r.cardName,
      url: r.cardUrl,
      stuckSince: r.stuckSince,
      daysInList: Math.max(0, Math.floor((Date.now() - new Date(r.stuckSince).getTime()) / (24 * 60 * 60 * 1000)))
    }));
  }

  const sendResult = await sendStuckCardsAlertEmail({
    alert,
    listName: stuckResult.listName,
    cards: cardsToSend,
    recipients: emails,
    notificationIds
  });

  if (!sendResult.ok) {
    if (!skipDatabaseWrites) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: 'error',
          lastCheckMessage: sendResult.error
        }
      });
    }
    return {
      alertId: alert.id,
      status: 'error',
      cardsChecked,
      stuckCount: stuckCards.length,
      newlyStuck,
      emailsSent: 0,
      unreachable,
      message: sendResult.error
    };
  }

  // Success
  if (!skipDatabaseWrites) {
    const now = new Date();
    await prisma.alertNotification.updateMany({
      where: { id: { in: notificationIds } },
      data: { sentAt: now }
    });
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        lastCheckedAt: now,
        lastCheckStatus: 'ok',
        lastCheckMessage: null,
        lastDigestSentAt: now
      }
    });
  }

  return {
    alertId: alert.id,
    status: 'ok',
    cardsChecked,
    stuckCount: stuckCards.length,
    newlyStuck,
    emailsSent: sendResult.sentCount || emails.length,
    unreachable,
    message: null
  };
}

// Registry for extensible checker support
const checkers = {
  'stuck-in-list': checkStuckInListAlert
};

/**
 * Scheduled check-alerts endpoint.
 * GET only, protected by CRON_SECRET.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Validate Authorization: Bearer CRON_SECRET
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  const hasDaysOverride = req.query.daysOverride !== undefined && req.query.daysOverride !== '';
  const daysOverride = hasDaysOverride ? Number(req.query.daysOverride) : undefined;
  const alertIdFilter = typeof req.query.alertId === 'string' && req.query.alertId.trim()
    ? req.query.alertId.trim()
    : undefined;

  try {
    const where = {
      status: 'active',
      alertType: 'stuck-in-list'
    };

    if (alertIdFilter) {
      where.id = alertIdFilter;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });

    const results = [];

    // Process alerts sequentially one at a time
    for (const alert of alerts) {
      const checker = checkers[alert.alertType];
      if (!checker) {
        continue;
      }

      try {
        const result = await checker(alert, { dryRun, daysOverride });
        results.push(result);
      } catch (err) {
        console.error(`Error checking alert ${alert.id}:`, err.message || err);
        results.push({
          alertId: alert.id,
          status: 'error',
          cardsChecked: 0,
          stuckCount: 0,
          newlyStuck: 0,
          emailsSent: 0,
          unreachable: 0,
          message: err.message || 'Internal check error'
        });
      }
    }

    // Clean up notifications older than 90 days once per run (not during dryRun)
    if (!dryRun) {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await prisma.alertNotification
        .deleteMany({
          where: {
            sentAt: {
              not: null,
              lt: ninetyDaysAgo
            }
          }
        })
        .catch((err) => {
          console.error('Failed to cleanup 90-day old notifications:', err.message || err);
        });
    }

    return res.status(200).json(results);
  } catch (err) {
    console.error('check-alerts route error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
