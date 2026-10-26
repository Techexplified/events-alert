import { prisma } from './_lib/db.js';
import { verifyToken } from './_lib/unsubscribe.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderErrorPage(res) {
  res.status(400);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid link - Event Alerts</title>
  <style>
    body {
      margin: 0;
      padding: 40px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      color: #0F172A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 32px 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    h1 {
      font-size: 19px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 12px;
      color: #0F172A;
    }
    p {
      font-size: 14px;
      color: #64748B;
      margin-top: 0;
      margin-bottom: 0;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Invalid or expired link</h1>
    <p>This unsubscribe link is invalid or has expired.</p>
  </div>
</body>
</html>`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method Not Allowed');
  }

  const rawEmail = req.query?.e || req.body?.e;
  const token = req.query?.t || req.body?.t;

  if (!rawEmail || typeof rawEmail !== 'string' || !token || typeof token !== 'string') {
    return renderErrorPage(res);
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (!verifyToken(normalizedEmail, token)) {
    return renderErrorPage(res);
  }

  try {
    if (req.method === 'GET') {
      const escapedEmail = escapeHtml(normalizedEmail);
      const actionUrl = `/api/unsubscribe?e=${encodeURIComponent(normalizedEmail)}&t=${encodeURIComponent(token)}`;

      res.status(200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - Event Alerts</title>
  <style>
    body {
      margin: 0;
      padding: 40px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      color: #0F172A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 32px 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    h1 {
      font-size: 19px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 12px;
      color: #0F172A;
      line-height: 1.35;
    }
    p {
      font-size: 14px;
      color: #64748B;
      margin-top: 0;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 12px 20px;
      background-color: #DC2626;
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-sizing: border-box;
      transition: background-color 0.15s ease;
    }
    .btn:hover {
      background-color: #B91C1C;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Stop receiving Event Alerts emails at ${escapedEmail}?</h1>
    <p>You will no longer receive any alert emails from Event Alerts for boards you are on.</p>
    <form method="POST" action="${actionUrl}">
      <input type="hidden" name="e" value="${escapedEmail}">
      <input type="hidden" name="t" value="${escapeHtml(token)}">
      <button type="submit" class="btn">Stop receiving emails</button>
    </form>
  </div>
</body>
</html>`);
    }

    if (req.method === 'POST') {
      await prisma.emailSuppression.upsert({
        where: { email: normalizedEmail },
        create: { email: normalizedEmail },
        update: {}
      });

      const escapedEmail = escapeHtml(normalizedEmail);
      res.status(200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - Event Alerts</title>
  <style>
    body {
      margin: 0;
      padding: 40px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      color: #0F172A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 32px 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    .icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: #DCFCE7;
      color: #15803D;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px auto;
    }
    .icon svg {
      width: 24px;
      height: 24px;
    }
    h1 {
      font-size: 19px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 8px;
      color: #0F172A;
    }
    p {
      font-size: 14px;
      color: #64748B;
      margin-top: 0;
      margin-bottom: 0;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h1>You’ve been unsubscribed</h1>
    <p>You will no longer receive alert emails from Event Alerts at <strong>${escapedEmail}</strong>.</p>
  </div>
</body>
</html>`);
    }
  } catch (err) {
    console.error('api/unsubscribe error:', err?.message || 'Unknown error');
    return renderErrorPage(res);
  }
}
