/**
 * End-to-end API tests against a real MongoDB.
 *   - Set MONGODB_URI_TEST to use an existing database (it will be DROPPED), or
 *   - leave it unset to use mongodb-memory-server (downloads a mongod binary on first run).
 * Run with: npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.GLOBAL_RATE_LIMIT = '100000';
process.env.UPLOAD_DIR = new URL('./.uploads', import.meta.url).pathname;

let server, base, mongod;
const PW = 'correct-horse-battery';

// Minimal cookie-jar client so each "user" keeps its own session.
function client() {
  let cookie = '';
  const call = async (method, path, body, extraHeaders = {}) => {
    const isForm = body instanceof FormData;
    const res = await fetch(base + path, {
      method,
      headers: { ...(body && !isForm ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...extraHeaders },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b), put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p) };
}

const form = (fields, file) => {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  if (file) f.append('proofFile', new Blob([file.buffer], { type: file.type }), file.name);
  return f;
};
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

let User, CreditPolicy;
async function makeUser(role, email, department = 'Misc') {
  await User.create({ name: `${role} user`, email, role, department, passwordHash: await bcrypt.hash(PW, 4) });
  const c = client();
  const r = await c.post('/api/auth/login', { email, password: PW });
  assert.equal(r.status, 200, `login ${email}`);
  return c;
}

before(async () => {
  let uri = process.env.MONGODB_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('cert_tracker_test');
  }
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  const { default: app } = await import('../src/app.js');
  User = (await import('../src/models/User.js')).default;
  CreditPolicy = (await import('../src/models/CreditPolicy.js')).default;
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await CreditPolicy.create({ name: 'test', weeksPerCredit: 4, minimumScore: 50, maxCreditsPerStudent: 5 });
  server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  await mongod?.stop();
});

test('registration only ever creates students', async () => {
  const c = client();
  const r = await c.post('/api/auth/register', { name: 'Eve', email: 'eve@x.io', password: PW, role: 'SUPER_ADMIN' });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, 'STUDENT');
  assert.equal((await c.post('/api/auth/register', { name: 'Eve', email: 'EVE@x.io', password: PW })).status, 409);
});

test('login: wrong password and unknown email look identical', async () => {
  const c = client();
  const a = await c.post('/api/auth/login', { email: 'eve@x.io', password: 'wrong-password-1' });
  const b = await c.post('/api/auth/login', { email: 'ghost@x.io', password: 'wrong-password-1' });
  assert.equal(a.status, 401);
  assert.deepEqual(a.data, b.data);
});

test('role boundaries are enforced', async () => {
  const student = await makeUser('STUDENT', 'rb-student@x.io', 'RB');
  const faculty = await makeUser('FACULTY', 'rb-faculty@x.io', 'RB');
  assert.equal((await student.get('/api/admin/users')).status, 403);
  assert.equal((await student.get('/api/certifications/review-queue')).status, 403);
  assert.equal((await faculty.get('/api/admin/users')).status, 403);
  assert.equal((await faculty.post('/api/certifications', { title: 'abc', platform: 'NPTEL', durationWeeks: 4, proofUrl: 'https://x.io' })).status, 403);
  assert.equal((await client().get('/api/certifications/my')).status, 401);
});

test('full lifecycle: submit with file → correction → resubmit → approve → credits', async () => {
  const student = await makeUser('STUDENT', 'life-student@x.io', 'Life');
  const faculty = await makeUser('FACULTY', 'life-faculty@x.io', 'Life');

  const created = await student.post('/api/certifications', form(
    { title: 'Deep Learning', platform: 'NPTEL', durationWeeks: 12, assessmentScore: 80, certificateId: 'NPTEL-123' },
    { buffer: PNG, type: 'image/png', name: 'cert.png' }
  ));
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.certification._id;
  assert.equal(created.data.certification.proofFile.key, undefined, 'storage key must not leak');

  // Same-department faculty is auto-assigned and can fetch the file; other students cannot.
  const proof = await faculty.get(`/api/certifications/${id}/proof`);
  assert.equal(proof.status, 200);
  assert.equal(proof.headers.get('content-type'), 'image/png');
  const other = await makeUser('STUDENT', 'life-other@x.io', 'Life');
  assert.equal((await other.get(`/api/certifications/${id}/proof`)).status, 404);
  assert.equal((await other.get(`/api/certifications/${id}`)).status, 404);

  // Rejection needs a reason; correction round-trips.
  assert.equal((await faculty.patch(`/api/certifications/${id}/review`, { decision: 'reject' })).status, 400);
  assert.equal((await faculty.patch(`/api/certifications/${id}/review`, { decision: 'correction', comment: 'Score is unreadable' })).status, 200);
  assert.equal((await faculty.patch(`/api/certifications/${id}/review`, { decision: 'approve' })).status, 409, 'cannot approve while waiting on student');

  const fixed = await student.put(`/api/certifications/${id}`, form({ title: 'Deep Learning', platform: 'NPTEL', durationWeeks: 12, assessmentScore: 85, certificateId: 'NPTEL-123' }));
  assert.equal(fixed.status, 200, JSON.stringify(fixed.data));
  assert.equal(fixed.data.certification.status, 'PENDING');

  const approved = await faculty.patch(`/api/certifications/${id}/review`, { decision: 'approve', comment: 'Verified' });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.certification.creditsAwarded, 3);
  assert.equal((await faculty.patch(`/api/certifications/${id}/review`, { decision: 'approve' })).status, 409, 'double approval blocked');

  const credits = await student.get('/api/certifications/credits');
  assert.equal(credits.data.total, 3);
  const notes = await student.get('/api/notifications');
  assert.ok(notes.data.unread >= 2);
  assert.equal((await student.del(`/api/certifications/${id}`)).status, 409, 'approved submissions cannot be withdrawn');
});

test('policy rules: low score approves the certificate but awards no credits, with a reason', async () => {
  const student = await makeUser('STUDENT', 'pol-student@x.io', 'Pol');
  const faculty = await makeUser('FACULTY', 'pol-faculty@x.io', 'Pol');
  const c = await student.post('/api/certifications', form({ title: 'Low score course', platform: 'NPTEL', durationWeeks: 8, assessmentScore: 20, proofUrl: 'https://nptel.ac.in/x' }));
  const r = await faculty.patch(`/api/certifications/${c.data.certification._id}/review`, { decision: 'approve' });
  assert.equal(r.data.certification.status, 'APPROVED');
  assert.equal(r.data.certification.creditsAwarded, 0);
  assert.match(r.data.certification.creditNote, /below the required 50%/);
});

test('credit cap is enforced across certificates', async () => {
  const student = await makeUser('STUDENT', 'cap-student@x.io', 'Cap');
  const faculty = await makeUser('FACULTY', 'cap-faculty@x.io', 'Cap');
  const totals = [];
  for (const n of [1, 2]) {
    const c = await student.post('/api/certifications', form({ title: `Course ${n}`, platform: 'NPTEL', durationWeeks: 16, assessmentScore: 90, proofUrl: 'https://nptel.ac.in/x' }));
    const r = await faculty.patch(`/api/certifications/${c.data.certification._id}/review`, { decision: 'approve' });
    totals.push(r.data.certification.creditsAwarded);
  }
  assert.deepEqual(totals, [4, 1]); // cap is 5
});

test('faculty cannot review another faculty member’s assignment; admin can reassign', async () => {
  const student = await makeUser('STUDENT', 'asg-student@x.io', 'Physics');
  const f1 = await makeUser('FACULTY', 'asg-f1@x.io', 'Physics');
  const f2 = await makeUser('FACULTY', 'asg-f2@x.io', 'Chemistry');
  const admin = await makeUser('ADMIN', 'asg-admin@x.io');
  const c = await student.post('/api/certifications', form({ title: 'Quantum 101', platform: 'edX', durationWeeks: 8, proofUrl: 'https://edx.org/x' }));
  const id = c.data.certification._id;
  assert.equal((await f2.patch(`/api/certifications/${id}/review`, { decision: 'approve' })).status, 403);
  const f2id = (await User.findOne({ email: 'asg-f2@x.io' }))._id.toString();
  assert.equal((await admin.patch(`/api/certifications/${id}/assign`, { facultyId: f2id })).status, 200);
  assert.equal((await f2.patch(`/api/certifications/${id}/review`, { decision: 'review' })).status, 200);
  assert.equal((await f1.patch(`/api/certifications/${id}/review`, { decision: 'approve' })).status, 403);
});

test('uploads: disguised files are rejected; duplicate files are flagged for reviewers', async () => {
  const s1 = await makeUser('STUDENT', 'up-s1@x.io');
  const s2 = await makeUser('STUDENT', 'up-s2@x.io');
  const bad = await s1.post('/api/certifications', form({ title: 'Bad upload', platform: 'NPTEL', durationWeeks: 4 }, { buffer: Buffer.from('<script>alert(1)</script>'), type: 'image/png', name: 'x.png' }));
  assert.equal(bad.status, 400);
  assert.equal((await s1.post('/api/certifications', form({ title: 'No proof', platform: 'NPTEL', durationWeeks: 4 }))).status, 400);
  assert.equal((await s1.post('/api/certifications', form({ title: 'XSS link', platform: 'NPTEL', durationWeeks: 4, proofUrl: 'javascript:alert(1)' }))).status, 400);

  const file = { buffer: PNG, type: 'image/png', name: 'same.png' };
  await s1.post('/api/certifications', form({ title: 'Original', platform: 'NPTEL', durationWeeks: 4 }, file));
  const dup = await s2.post('/api/certifications', form({ title: 'Copycat', platform: 'NPTEL', durationWeeks: 4 }, file));
  assert.equal(dup.status, 201);
  assert.deepEqual(dup.data.certification.flags, ['DUPLICATE_FILE']);
});

test('admin: user management guards', async () => {
  const admin = await makeUser('ADMIN', 'adm-admin@x.io');
  const sup = await makeUser('SUPER_ADMIN', 'adm-super@x.io');
  const mk = (c, role, email) => c.post('/api/admin/users', { name: 'New Person', email, password: PW, role, department: 'CS' });
  assert.equal((await mk(admin, 'FACULTY', 'adm-new-f@x.io')).status, 201);
  assert.equal((await mk(admin, 'ADMIN', 'adm-new-a@x.io')).status, 403, 'admin cannot create admins');
  assert.equal((await mk(sup, 'ADMIN', 'adm-new-a@x.io')).status, 201);

  const target = await User.findOne({ email: 'adm-new-a@x.io' });
  assert.equal((await admin.patch(`/api/admin/users/${target._id}`, { isActive: false })).status, 403);
  assert.equal((await sup.patch(`/api/admin/users/${target._id}`, { isActive: false })).status, 200);
  assert.equal((await client().post('/api/auth/login', { email: 'adm-new-a@x.io', password: PW })).status, 401, 'deactivated users cannot sign in');

  const self = await User.findOne({ email: 'adm-super@x.io' });
  assert.equal((await sup.patch(`/api/admin/users/${self._id}`, { isActive: false })).status, 400, 'cannot deactivate self');
});

test('password change invalidates other sessions', async () => {
  const a = await makeUser('STUDENT', 'pw-user@x.io');
  const b = client();
  await b.post('/api/auth/login', { email: 'pw-user@x.io', password: PW });
  assert.equal((await b.get('/api/auth/me')).status, 200);
  await new Promise((r) => setTimeout(r, 1200)); // JWT iat has 1s resolution
  assert.equal((await a.patch('/api/auth/password', { currentPassword: PW, newPassword: 'a-brand-new-password' })).status, 200);
  assert.equal((await a.get('/api/auth/me')).status, 200, 'current session stays signed in');
  assert.equal((await b.get('/api/auth/me')).status, 401, 'other session is revoked');
});

test('policy save creates a new version and deactivates the old one', async () => {
  const admin = await makeUser('ADMIN', 'ver-admin@x.io');
  const r = await admin.post('/api/admin/credit-policy', { name: 'v2', weeksPerCredit: 2, minimumScore: 0, maxCreditsPerStudent: 50, eligiblePlatforms: ['NPTEL'] });
  assert.equal(r.status, 201);
  assert.equal(await CreditPolicy.countDocuments({ active: true }), 1);
  assert.equal((await admin.get('/api/admin/credit-policy')).data.policy.name, 'v2');
});

test('reports, CSV export (formula-safe) and audit log', async () => {
  const admin = await makeUser('ADMIN', 'rep-admin@x.io');
  const rep = await admin.get('/api/admin/reports');
  assert.equal(rep.status, 200);
  assert.equal(rep.data.byMonth.length, 12);
  const csv = await admin.get('/api/admin/reports/credits.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok(!/(^|,)"[=+@-]/m.test(csv.data.toString()), 'no cell may start with a formula character');
  const logs = await admin.get('/api/admin/audit-logs');
  assert.ok(logs.data.total > 0);
});

test('invalid ids return 400, not 500', async () => {
  const student = await makeUser('STUDENT', 'id-student@x.io');
  assert.equal((await student.get('/api/certifications/not-an-id')).status, 400);
});
