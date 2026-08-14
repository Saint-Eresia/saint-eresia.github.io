process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-with-more-than-thirty-two-characters';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('health and catalog endpoints are available', async () => {
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.service, 'Saint Eresia');
  const novels = await request(app).get('/api/novels?limit=3').expect(200);
  assert.equal(novels.body.items.length, 3);
  assert.equal(novels.body.pagination.total, 3);
  await request(app).get('/api/patches?limit=6').expect(200).expect((response) => assert.equal(response.body.items.length, 2));
});

test('admin endpoints are protected server-side', async () => {
  await request(app).get('/api/admin/dashboard').expect(401);
  const user = request.agent(app);
  await user.post('/api/auth/login').send({ email:'lecteur@saint-eresia.local', password:'LecteurEresia!2026' }).expect(200);
  await user.get('/api/admin/dashboard').expect(403);
});

test('admin can create a sanitized chapter with a CSRF token', async () => {
  const admin = request.agent(app);
  const login = await admin.post('/api/auth/login').send({ email:'admin@saint-eresia.local', password:'AdminEresia!2026' }).expect(200);
  const novel = await admin.get('/api/novels/rakudai-kishi-no-cavalry').expect(200);
  const volumeId = novel.body.volumes[0].id;
  const created = await admin.post(`/api/volumes/${volumeId}/chapters`).set('x-csrf-token', login.body.csrfToken).send({ title:'Chapitre de sécurité', content:'<p>Texte sûr</p><script>alert(1)</script>', number:99 }).expect(201);
  assert.doesNotMatch(created.body.content, /script/i);
});

test('mutations reject a missing CSRF token', async () => {
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ email:'admin@saint-eresia.local', password:'AdminEresia!2026' }).expect(200);
  await admin.post('/api/novels').send({ title:'Refus attendu' }).expect(403);
});
