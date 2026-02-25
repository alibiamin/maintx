/**
 * Test d'intégration : endpoint santé (sans initialisation DB)
 * Le serveur exporte app sans appeler start() quand requis comme module.
 */

process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../src/server.js');

describe('API Health', () => {
  it('GET /api/health retourne 200 et status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});
