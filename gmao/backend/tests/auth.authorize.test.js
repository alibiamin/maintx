/**
 * Tests unitaires : middleware authorize (rôles)
 */

const { authorize, ROLES } = require('../src/middleware/auth');

describe('ROLES', () => {
  it('expose les rôles attendus', () => {
    expect(ROLES.ADMIN).toBe('administrateur');
    expect(ROLES.RESPONSABLE).toBe('responsable_maintenance');
    expect(ROLES.PLANIFICATEUR).toBe('planificateur');
    expect(ROLES.TECHNICIEN).toBe('technicien');
    expect(ROLES.UTILISATEUR).toBe('utilisateur');
  });
});

describe('authorize(...allowedRoles)', () => {
  it('retourne 401 si req.user absent', () => {
    const middleware = authorize(ROLES.ADMIN);
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Non authentifié' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retourne 403 si le rôle de l\'utilisateur n\'est pas autorisé', () => {
    const middleware = authorize(ROLES.ADMIN, ROLES.RESPONSABLE);
    const req = { user: { role_name: ROLES.TECHNICIEN } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Accès refusé - permissions insuffisantes' });
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next() si le rôle est autorisé', () => {
    const middleware = authorize(ROLES.ADMIN, ROLES.RESPONSABLE);
    const req = { user: { role_name: ROLES.RESPONSABLE } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('autorise le rôle planificateur quand inclus', () => {
    const middleware = authorize(ROLES.PLANIFICATEUR, ROLES.RESPONSABLE);
    const req = { user: { role_name: ROLES.PLANIFICATEUR } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
