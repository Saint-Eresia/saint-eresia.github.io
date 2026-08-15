process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-with-more-than-thirty-two-characters';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

const signIn = async () => {
  const admin = request.agent(app);
  const login = await admin.post('/api/auth/login').send({ email: 'admin@saint-eresia.local', password: 'AdminEresia!2026' }).expect(200);
  return { admin, csrf: login.body.csrfToken };
};

test('la création d’un patch conserve tous les champs de la fiche', async () => {
  const { admin, csrf } = await signIn();
  const created = await admin.post('/api/patches').set('x-csrf-token', csrf).send({
    rightsConfirmed: true, title: 'Projet de vérification', developer: 'Studio test', engine: 'Ren\'Py',
    platform: 'Windows / Linux', status: 'Bêta', type: 'Traduction partielle',
    translation: 80, images: 40, technical: 60, proofreading: 20,
    requirements: 'Posséder le jeu\nVersion 1.2', instructions: 'Sauvegarder\nExtraire\nLancer'
  }).expect(201);

  assert.equal(created.body.developer, 'Studio test');
  assert.equal(created.body.status, 'Bêta');
  assert.deepEqual(created.body.systems, ['Windows', 'Linux']);
  assert.deepEqual(created.body.requirements, ['Posséder le jeu', 'Version 1.2']);
  assert.equal(created.body.instructions.length, 3);
  assert.equal(created.body.slug, 'projet-de-verification');
  assert.equal(created.body.progress, 50, 'la progression globale est la moyenne des quatre axes');
});

test('les axes d’avancement bornent et recalculent la progression globale', async () => {
  const { admin, csrf } = await signIn();
  const created = await admin.post('/api/patches').set('x-csrf-token', csrf)
    .send({ rightsConfirmed: true, title: 'Bornes des axes' }).expect(201);
  assert.equal(created.body.progress, 0);

  const updated = await admin.patch(`/api/patches/${created.body.id}`).set('x-csrf-token', csrf)
    .send({ translation: 140, images: -20, technical: 100, proofreading: 50 }).expect(200);
  assert.equal(updated.body.axes.translation, 100, 'valeur au-dessus de 100 ramenée à 100');
  assert.equal(updated.body.axes.images, 0, 'valeur négative ramenée à 0');
  assert.equal(updated.body.progress, 63, 'moyenne de 100, 0, 100 et 50, arrondie au supérieur');
});

test('un axe sans objet sort de la moyenne au lieu de plafonner la progression', async () => {
  const { admin, csrf } = await signIn();
  const created = await admin.post('/api/patches').set('x-csrf-token', csrf)
    .send({ rightsConfirmed: true, title: 'Patch sans image' }).expect(201);

  const updated = await admin.patch(`/api/patches/${created.body.id}`).set('x-csrf-token', csrf)
    .send({ translation: 100, images: null, technical: 100, proofreading: 100 }).expect(200);
  assert.equal(updated.body.axes.images, null, 'l’axe déclaré sans objet reste null');
  assert.equal(updated.body.progress, 100, 'la moyenne ne porte que sur les trois axes applicables');

  // L'axe redevient chiffrable dès qu'on lui donne une valeur.
  const back = await admin.patch(`/api/patches/${created.body.id}`).set('x-csrf-token', csrf)
    .send({ images: 0 }).expect(200);
  assert.equal(back.body.axes.images, 0);
  assert.equal(back.body.progress, 75, 'moyenne de 100, 0, 100 et 100');
});

test('un statut invalide est refusé sans altérer la fiche', async () => {
  const { admin, csrf } = await signIn();
  const created = await admin.post('/api/patches').set('x-csrf-token', csrf)
    .send({ rightsConfirmed: true, title: 'Fiche protégée', developer: 'Studio initial' }).expect(201);

  await admin.patch(`/api/patches/${created.body.id}`).set('x-csrf-token', csrf)
    .send({ developer: 'Studio écrasé', status: 'Statut inexistant' }).expect(422);

  const after = await admin.get(`/api/patches/${created.body.slug}`).expect(200);
  assert.equal(after.body.developer, 'Studio initial', 'aucun champ ne doit être écrit quand la validation échoue');
});

test('le slug reste unique entre deux patchs', async () => {
  const { admin, csrf } = await signIn();
  await admin.post('/api/patches').set('x-csrf-token', csrf).send({ rightsConfirmed: true, title: 'Doublon' }).expect(201);
  await admin.post('/api/patches').set('x-csrf-token', csrf).send({ rightsConfirmed: true, title: 'Doublon' }).expect(422);
});

test('les versions pilotent la publication courante du patch', async () => {
  const { admin, csrf } = await signIn();
  const created = await admin.post('/api/patches').set('x-csrf-token', csrf)
    .send({ rightsConfirmed: true, title: 'Cycle de versions' }).expect(201);
  const id = created.body.id;
  assert.deepEqual(created.body.versions, []);

  const first = await admin.post(`/api/patches/${id}/versions`).set('x-csrf-token', csrf)
    .send({ version: '1.0.0', size: '120 Mo', releasedAt: '2026-05-01' }).expect(201);
  await admin.post(`/api/patches/${id}/versions`).set('x-csrf-token', csrf)
    .send({ version: '1.0.0' }).expect(409);

  await admin.post(`/api/patches/${id}/versions`).set('x-csrf-token', csrf)
    .send({ version: '1.1.0', size: '130 Mo', changelog: 'Relecture complète' }).expect(201);

  const withTwo = await admin.get(`/api/patches/${created.body.slug}`).expect(200);
  assert.equal(withTwo.body.versions.length, 2);
  assert.equal(withTwo.body.currentVersion, '1.1.0', 'la dernière version publiée devient la version courante');
  assert.equal(withTwo.body.fileSize, '130 Mo');
  assert.deepEqual(withTwo.body.changelog, ['Relecture complète']);

  await admin.delete(`/api/patches/${id}/versions/${withTwo.body.versions[0].id}`).set('x-csrf-token', csrf).expect(204);
  const afterDelete = await admin.get(`/api/patches/${created.body.slug}`).expect(200);
  assert.equal(afterDelete.body.versions.length, 1);
  assert.equal(afterDelete.body.currentVersion, '1.0.0', 'la version courante retombe sur celle qui reste');
  assert.equal(afterDelete.body.versions[0].id, first.body.id);
});

test('les identifiants de version ne se chevauchent pas entre patchs', async () => {
  const { admin, csrf } = await signIn();
  const a = await admin.post('/api/patches').set('x-csrf-token', csrf).send({ rightsConfirmed: true, title: 'Patch A versions' }).expect(201);
  const b = await admin.post('/api/patches').set('x-csrf-token', csrf).send({ rightsConfirmed: true, title: 'Patch B versions' }).expect(201);
  const va = await admin.post(`/api/patches/${a.body.id}/versions`).set('x-csrf-token', csrf).send({ version: '1.0.0' }).expect(201);
  const vb = await admin.post(`/api/patches/${b.body.id}/versions`).set('x-csrf-token', csrf).send({ version: '1.0.0' }).expect(201);
  assert.notEqual(va.body.id, vb.body.id, 'le téléchargement retrouve un fichier par son identifiant global');
});

test('les modifications de patch restent réservées aux rôles autorisés', async () => {
  const reader = request.agent(app);
  const login = await reader.post('/api/auth/login').send({ email: 'lecteur@saint-eresia.local', password: 'LecteurEresia!2026' }).expect(200);
  await reader.post('/api/patches').set('x-csrf-token', login.body.csrfToken).send({ rightsConfirmed: true, title: 'Interdit' }).expect(403);
  await reader.post('/api/patches/1/versions').set('x-csrf-token', login.body.csrfToken).send({ version: '9.9.9' }).expect(403);
});
