import { prisma } from '../_lib/db.js';
import { decrypt } from '../_lib/crypto.js';
import * as stuckInList from '../_lib/checker/stuck-in-list.js';
import * as overdueInList from '../_lib/checker/overdue-in-list.js';
import * as noActivity from '../_lib/checker/no-activity.js';
import { resolveRecipients } from '../_lib/checker/recipients.js';
import { sendAlertEmail } from '../_lib/checker/email.js';

// Registry for extensible checker support
const checkers = {
  'stuck-in-list': stuckInList,
  'overdue-in-list': overdueInList,
  'no-activity': noActivity
};

/**
 * Checks a single alert regardless of its type.
 */
async function checkAlert(alert, { dryRun = false, daysOverride = undefined } = {}) {
  const isDaysOverrideTest = (alert.alertType === 'stuck-in-list' || alert.alertType === 'no-activity') && daysOverride !== undefined;
  const skipDatabaseWrites = dryRun || isDaysOverrideTest;
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
      alertType: alert.alertType,
      status: 'error',
      cardsChecked: 0,
      itemCount: 0,
      newlyDetected: 0,
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
      alertType: alert.alertType,
      status: 'error',
      cardsChecked: 0,
      itemCount: 0,
      newlyDetected: 0,
      emailsSent: 0,
      unreachable: 0,
      message: 'Creator needs to reconnect Trello'
    };
  }

  // 2. Run the checker
  const checker = checkers[alert.alertType];
  if (!checker || typeof checker.check !== 'function') {
    return {
      alertId: alert.id,
      alertType: alert.alertType,
      status: 'error',
      cardsChecked: 0,
      itemCount: 0,
      newlyDetected: 0,
      emailsSent: 0,
      unreachable: 0,
      message: `Unknown alert type: ${alert.alertType}`
    };
  }

  const checkResult = await checker.check(alert, creatorToken, {
    daysOverride: (alert.alertType === 'stuck-in-list' || alert.alertType === 'no-activity') ? daysOverride : undefined,
    dryRun
  });

  if (checkResult.status === 401) {
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
      alertType: alert.alertType,
      status: 'error',
      cardsChecked: 0,
      itemCount: 0,
      newlyDetected: 0,
      emailsSent: 0,
      unreachable: 0,
      message: 'Creator needs to reconnect Trello'
    };
  }

  if (!checkResult.ok) {
    const errorMsg = checkResult.message || checkResult.error || 'Check failed';
    if (!skipDatabaseWrites) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: 'error',
          lastCheckMessage: errorMsg
        }
      });
    }
    return {
      alertId: alert.id,
      alertType: alert.alertType,
      status: 'error',
      cardsChecked: checkResult.cardsChecked || 0,
      itemCount: 0,
      newlyDetected: 0,
      emailsSent: 0,
      unreachable: 0,
      message: errorMsg
    };
  }

  const items = checkResult.items || [];
  const cardsChecked = checkResult.cardsChecked || 0;

  let newlyDetected = 0;
  let unsentRows = [];

  if (!skipDatabaseWrites) {
    // Delete unsent rows for cards that no longer match
    const currentCardIds = items.map((c) => c.cardId);
    await prisma.alertNotification.deleteMany({
      where: {
        alertId: alert.id,
        sentAt: null,
        cardId: { notIn: currentCardIds }
      }
    });

    // Create AlertNotification rows for matching cards, skipping any existing for same (alertId, cardId, episodeAt)
    for (const item of items) {
      const existing = await prisma.alertNotification.findUnique({
        where: {
          alertId_cardId_episodeAt: {
            alertId: alert.id,
            cardId: item.cardId,
            episodeAt: item.episodeAt
          }
        }
      });

      if (!existing) {
        await prisma.alertNotification.create({
          data: {
            alertId: alert.id,
            cardId: item.cardId,
            cardName: item.name,
            cardUrl: item.url,
            episodeAt: item.episodeAt
          }
        });
        newlyDetected++;
      }
    }

    unsentRows = await prisma.alertNotification.findMany({
      where: {
        alertId: alert.id,
        sentAt: null
      },
      orderBy: { episodeAt: 'asc' }
    });
  } else {
    // In dryRun or isStuckTest, compute newlyDetected without writing to database
    for (const item of items) {
      const existing = await prisma.alertNotification.findUnique({
        where: {
          alertId_cardId_episodeAt: {
            alertId: alert.id,
            cardId: item.cardId,
            episodeAt: item.episodeAt
          }
        }
      });
      if (!existing) {
        newlyDetected++;
      }
    }
  }

  // 3. Work out whether to send
  let shouldSend = false;

  if (isDaysOverrideTest) {
    // In daysOverride test mode for stuck-in-list and no-activity, send immediately if there are matching cards
    if (items.length === 0) {
      return {
        alertId: alert.id,
        alertType: alert.alertType,
        status: 'ok',
        cardsChecked,
        itemCount: 0,
        newlyDetected: 0,
        emailsSent: 0,
        unreachable: 0,
        message: 'No matching cards'
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
        alertType: alert.alertType,
        status: 'ok',
        cardsChecked,
        itemCount: items.length,
        newlyDetected: 0,
        emailsSent: 0,
        unreachable: 0,
        message: checkResult.message || null
      };
    }

    const frequency = alert.recipients?.frequency || 'immediate';
    if (frequency === 'immediate') {
      shouldSend = unsentRows.length > 0 || (dryRun && items.length > 0);
    } else if (frequency === 'daily') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (!alert.lastDigestSentAt || new Date(alert.lastDigestSentAt) < oneDayAgo) {
        shouldSend = unsentRows.length > 0 || (dryRun && items.length > 0);
      }
    } else if (frequency === 'weekly') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (!alert.lastDigestSentAt || new Date(alert.lastDigestSentAt) < sevenDaysAgo) {
        shouldSend = unsentRows.length > 0 || (dryRun && items.length > 0);
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
        alertType: alert.alertType,
        status: 'ok',
        cardsChecked,
        itemCount: items.length,
        newlyDetected,
        emailsSent: 0,
        unreachable: 0,
        message: checkResult.message || null
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
      alertType: alert.alertType,
      status: 'no_recipients',
      cardsChecked,
      itemCount: items.length,
      newlyDetected,
      emailsSent: 0,
      unreachable,
      message
    };
  }

  // 5. Send emails
  if (dryRun) {
    const dryRunMsg = `[dry-run] Would send alert to ${emails.length} recipient(s)`;
    return {
      alertId: alert.id,
      alertType: alert.alertType,
      status: 'ok',
      cardsChecked,
      itemCount: items.length,
      newlyDetected,
      emailsSent: 0,
      unreachable,
      message: checkResult.message ? `${checkResult.message}; ${dryRunMsg}` : dryRunMsg
    };
  }

  let cardsToSend = [];
  let notificationIds = [];

  if (isDaysOverrideTest) {
    cardsToSend = items;
    notificationIds = items.map((c) => c.cardId);
  } else {
    notificationIds = unsentRows.map((r) => r.id);
    cardsToSend = unsentRows.map((r) => ({
      cardId: r.cardId,
      name: r.cardName,
      url: r.cardUrl,
      episodeAt: r.episodeAt,
      daysInList: Math.max(0, Math.floor((Date.now() - new Date(r.episodeAt).getTime()) / (24 * 60 * 60 * 1000)))
    }));
  }

  const sendResult = await sendAlertEmail({
    alert,
    boardName: checkResult.boardName || alert.boardName,
    listName: checkResult.listName,
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
      alertType: alert.alertType,
      status: 'error',
      cardsChecked,
      itemCount: items.length,
      newlyDetected,
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
    alertType: alert.alertType,
    status: 'ok',
    cardsChecked,
    itemCount: items.length,
    newlyDetected,
    emailsSent: sendResult.sentCount || emails.length,
    unreachable,
    message: checkResult.message || null
  };
}

/**
 * Scheduled check-alerts endpoint.
 * GET only, protected by CRON_SECRET.
 * Query params:
 * - ?dryRun=1: Simulate check and email resolution without writing to database or sending email.
 * - ?alertId=<id>: Test a specific alert.
 * - ?daysOverride=<n>: Test mode for 'stuck-in-list' and 'no-activity' alerts; sends immediately if cards match. With daysOverride=0, all cards match as inactive. Ignored for 'overdue-in-list'.
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
    const supportedTypes = Object.keys(checkers);
    const where = {
      status: 'active',
      alertType: { in: supportedTypes }
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
        const result = await checkAlert(alert, { dryRun, daysOverride });
        results.push(result);
      } catch (err) {
        console.error(`Error checking alert ${alert.id}:`, err.message || err);
        results.push({
          alertId: alert.id,
          alertType: alert.alertType,
          status: 'error',
          cardsChecked: 0,
          itemCount: 0,
          newlyDetected: 0,
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
