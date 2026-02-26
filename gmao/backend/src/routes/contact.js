/**
 * API publique : formulaire de demande de démo (sans authentification)
 * Envoie les données par email à l'admin (admin@maintx.org).
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');

const router = express.Router();
const DEMO_RECIPIENT = process.env.DEMO_REQUEST_EMAIL || 'admin@maintx.org';

/**
 * POST /api/contact/demo
 * Body: { firstName, lastName, email, company?, phone?, message? }
 */
router.post(
  '/demo',
  [
    body('firstName').trim().notEmpty().withMessage('Prénom requis').isLength({ max: 100 }),
    body('lastName').trim().notEmpty().withMessage('Nom requis').isLength({ max: 100 }),
    body('email').trim().isEmail().normalizeEmail().withMessage('Email invalide'),
    body('company').optional().trim().isLength({ max: 200 }),
    body('phone').optional().trim().isLength({ max: 30 }),
    body('message').optional().trim().isLength({ max: 2000 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides', errors: errors.array() });
    }
    const { firstName, lastName, email, company, phone, message } = req.body;
    const subject = `[MAINTX] Demande de démo — ${firstName} ${lastName}`;
    const text = [
      `Demande de démo reçue depuis le site MAINTX.`,
      '',
      `Prénom : ${firstName || '—'}`,
      `Nom : ${lastName || '—'}`,
      `Email : ${email || '—'}`,
      `Société : ${company || '—'}`,
      `Téléphone : ${phone || '—'}`,
      '',
      message ? `Message :\n${message}` : ''
    ].filter(Boolean).join('\n');
    const html = [
      '<p>Demande de démo reçue depuis le site MAINTX.</p>',
      '<table style="border-collapse:collapse">',
      `<tr><td style="padding:4px 8px;border:1px solid #ddd">Prénom</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(firstName || '—')}</td></tr>`,
      `<tr><td style="padding:4px 8px;border:1px solid #ddd">Nom</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(lastName || '—')}</td></tr>`,
      `<tr><td style="padding:4px 8px;border:1px solid #ddd">Email</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(email || '—')}</td></tr>`,
      `<tr><td style="padding:4px 8px;border:1px solid #ddd">Société</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(company || '—')}</td></tr>`,
      `<tr><td style="padding:4px 8px;border:1px solid #ddd">Téléphone</td><td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(phone || '—')}</td></tr>`,
      '</table>',
      message ? `<p><strong>Message :</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : ''
    ].join('');
    if (!process.env.SMTP_HOST) {
      // Mode développement : pas d'email envoyé, on log et on renvoie succès
      console.log('[contact/demo] Demande de démo (SMTP non configuré, email non envoyé):', { firstName, lastName, email, company: company || '—', phone: phone || '—', message: message || '—' });
      return res.json({ success: true, message: 'Demande envoyée' });
    }
    try {
      console.log('[contact/demo] Envoi demande de démo vers', DEMO_RECIPIENT);
      await notificationService.sendEmail(DEMO_RECIPIENT, subject, text, html);
      console.log('[contact/demo] Email envoyé avec succès vers', DEMO_RECIPIENT);
      res.json({ success: true, message: 'Demande envoyée' });
    } catch (err) {
      console.warn('[contact] Demo email error:', err.message);
      res.status(503).json({ error: 'Envoi temporairement indisponible. Réessayez plus tard ou contactez-nous par email.' });
    }
  }
);

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
