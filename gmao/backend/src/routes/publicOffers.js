/**
 * API publique : offres d'abonnement pour la landing (sans authentification)
 * Lit la table subscription_plans de la base admin MAINTX.
 */

const express = require('express');
const dbModule = require('../database/db');

const router = express.Router();

/**
 * GET /api/public/offers
 * Liste des offres (code, name, price, period, displayOrder) pour affichage sur la landing.
 */
router.get('/offers', (req, res) => {
  try {
    const adminDb = dbModule.getAdminDb();
    const rows = adminDb.prepare(`
      SELECT code, name, price, period, display_order AS displayOrder
      FROM subscription_plans
      ORDER BY display_order ASC
    `).all();
    res.json({ plans: rows });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.json({ plans: [] });
    }
    console.error('[public offers]', e);
    res.status(500).json({ error: 'Impossible de charger les offres', plans: [] });
  }
});

module.exports = router;
