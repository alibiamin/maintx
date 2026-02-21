/**
 * Service d'alertes par email et SMS — xmaint
 * Déclenchement : création OT, affectation, clôture, plans en retard, stock
 */

require('dotenv').config();
const db = require('../database/db');

let nodemailer = null;
let twilioClient = null;
try {
  nodemailer = require('nodemailer');
} catch (_) {}
try {
  const twilio = require('twilio');
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token) twilioClient = twilio(sid, token);
} catch (_) {}

const EVENT_LABELS = {
  work_order_created: 'Nouvelle panne / OT créé',
  work_order_assigned: 'OT affecté',
  work_order_closed: 'OT clôturé',
  plan_overdue: 'Plan de maintenance en retard',
  stock_alert: 'Alerte stock'
};

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || ''
    } : undefined
  });
}

async function sendEmail(to, subject, text, html) {
  const transport = getTransporter();
  if (!transport || !to) return;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@xmaint.org';
  try {
    await transport.sendMail({
      from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject || 'Notification xmaint',
      text: text || '',
      html: html || (text ? text.replace(/\n/g, '<br>') : '')
    });
  } catch (err) {
    console.warn('[notificationService] Email error:', err.message);
  }
}

async function sendSMS(to, message) {
  if (!twilioClient || !to || !message) return;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return;
  const normalized = to.replace(/\s/g, '');
  if (!/^\+?[0-9]{10,15}$/.test(normalized)) return;
  try {
    await twilioClient.messages.create({
      body: message.substring(0, 1600),
      from,
      to: normalized.startsWith('+') ? normalized : `+${normalized}`
    });
  } catch (err) {
    console.warn('[notificationService] SMS error:', err.message);
  }
}

/**
 * Récupère les utilisateurs à notifier pour un événement (ceux qui ont la préférence activée)
 */
function getRecipients(eventType, channel) {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.email, u.phone, u.first_name, u.last_name
      FROM users u
      JOIN notification_preferences np ON np.user_id = u.id AND np.enabled = 1
      WHERE np.event_type = ? AND np.channel = ?
      AND u.is_active = 1
    `).all(eventType, channel);
    return rows;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return [];
    throw e;
  }
}

/**
 * Construit le texte selon le type d'événement
 */
function buildMessage(eventType, data) {
  const appName = process.env.APP_NAME || 'xmaint';
  switch (eventType) {
    case 'work_order_created':
      return `[${appName}] Nouvelle panne : ${data.number || ''} — ${data.title || ''}${data.equipment_name ? ` (${data.equipment_name})` : ''}. Priorité : ${data.priority || 'medium'}.`;
    case 'work_order_assigned':
      return `[${appName}] OT ${data.number || ''} vous a été affecté : ${data.title || ''}.`;
    case 'work_order_closed':
      return `[${appName}] OT ${data.number || ''} a été clôturé : ${data.title || ''}.`;
    case 'plan_overdue':
      return `[${appName}] Plan en retard : ${data.plan_name || ''} (${data.equipment_code || ''}) — échéance ${data.next_due_date || ''}.`;
    case 'stock_alert':
      return `[${appName}] Alerte stock : ${data.part_name || data.code || ''} — stock actuel sous le minimum.`;
    default:
      return `[${appName}] Notification : ${data.title || eventType}`;
  }
}

function buildSubject(eventType, data) {
  switch (eventType) {
    case 'work_order_created':
      return `[xmaint] Nouvelle panne — ${data.number || ''}`;
    case 'work_order_assigned':
      return `[xmaint] OT affecté — ${data.number || ''}`;
    case 'work_order_closed':
      return `[xmaint] OT clôturé — ${data.number || ''}`;
    case 'plan_overdue':
      return `[xmaint] Plan en retard — ${data.plan_name || ''}`;
    case 'stock_alert':
      return `[xmaint] Alerte stock`;
    default:
      return `[xmaint] Notification`;
  }
}

/**
 * Envoie les notifications (email + SMS) pour un événement aux utilisateurs concernés
 * @param {string} eventType - work_order_created | work_order_assigned | work_order_closed | plan_overdue | stock_alert
 * @param {number[]} [userIds] - si fourni, on ne notifie que ces utilisateurs (et on respecte leurs préférences)
 * @param {object} data - données pour le message (number, title, equipment_name, etc.)
 */
async function notify(eventType, userIds, data = {}) {
  const run = (channel) => {
    let recipients;
    if (userIds && userIds.length > 0) {
      try {
        const placeholders = userIds.map(() => '?').join(',');
        const prefs = db.prepare(`
          SELECT u.id, u.email, u.phone, u.first_name, u.last_name
          FROM users u
          JOIN notification_preferences np ON np.user_id = u.id AND np.enabled = 1
          WHERE np.event_type = ? AND np.channel = ? AND u.id IN (${placeholders}) AND u.is_active = 1
        `).all(eventType, channel, ...userIds);
        recipients = prefs;
      } catch (e) {
        if (e.message && e.message.includes('no such table')) recipients = [];
        else throw e;
      }
    } else {
      recipients = getRecipients(eventType, channel);
    }
    const text = buildMessage(eventType, data);
    const subject = buildSubject(eventType, data);
    recipients.forEach((r) => {
      if (channel === 'email' && r.email) {
        sendEmail(r.email, subject, text).catch(() => {});
      }
      if (channel === 'sms' && r.phone) {
        sendSMS(r.phone, text).catch(() => {});
      }
    });
  };
  run('email');
  run('sms');
}

module.exports = {
  sendEmail,
  sendSMS,
  getRecipients,
  notify,
  EVENT_LABELS,
  buildMessage,
  buildSubject
};
