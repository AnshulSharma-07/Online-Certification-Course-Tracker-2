import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCredits } from '../src/services/credit.service.js';
import { detectType } from '../src/services/storage.service.js';
import { certificationSchema, reviewSchema, registerSchema, policySchema } from '../src/validators/schemas.js';

const policy = { weeksPerCredit: 4, minimumScore: 0, maxCreditsPerStudent: 20, eligiblePlatforms: [] };
const cert = (o = {}) => ({ platform: 'NPTEL', durationWeeks: 12, assessmentScore: 80, ...o });

test('credits = floor(weeks / weeksPerCredit)', () => {
  assert.equal(calculateCredits(cert({ durationWeeks: 12 }), policy).credits, 3);
  assert.equal(calculateCredits(cert({ durationWeeks: 11 }), policy).credits, 2);
});

test('too-short course earns nothing and says why', () => {
  const r = calculateCredits(cert({ durationWeeks: 3 }), policy);
  assert.equal(r.credits, 0);
  assert.match(r.reason, /below the 4 weeks/);
});

test('platform check is case-insensitive and enforced', () => {
  const p = { ...policy, eligiblePlatforms: ['NPTEL'] };
  assert.equal(calculateCredits(cert({ platform: 'nptel' }), p).credits, 3);
  assert.equal(calculateCredits(cert({ platform: 'Udemy' }), p).credits, 0);
});

test('minimum score: below fails, missing fails, equal passes', () => {
  const p = { ...policy, minimumScore: 60 };
  assert.equal(calculateCredits(cert({ assessmentScore: 59 }), p).credits, 0);
  assert.equal(calculateCredits(cert({ assessmentScore: null }), p).credits, 0);
  assert.equal(calculateCredits(cert({ assessmentScore: 60 }), p).credits, 3);
});

test('per-student cap trims or blocks the award', () => {
  const p = { ...policy, maxCreditsPerStudent: 10 };
  assert.equal(calculateCredits(cert({ durationWeeks: 12 }), p, 8).credits, 2);
  assert.equal(calculateCredits(cert({ durationWeeks: 12 }), p, 10).credits, 0);
});

test('falls back to sane defaults with no policy', () => {
  assert.equal(calculateCredits(cert({ durationWeeks: 8 }), null).credits, 2);
});

test('file type detection uses magic bytes, not the file name', () => {
  assert.equal(detectType(Buffer.from('%PDF-1.7\n...')).mime, 'application/pdf');
  assert.equal(detectType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])).mime, 'image/png');
  assert.equal(detectType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).mime, 'image/jpeg');
  assert.equal(detectType(Buffer.from('<html><script>alert(1)</script>')), null);
  assert.equal(detectType(Buffer.from('MZ\x90\x00')), null);
});

test('proof URL must be http(s); javascript: and data: are rejected', () => {
  const base = { title: 'Intro to ML', platform: 'NPTEL', durationWeeks: '12' };
  assert.ok(certificationSchema.safeParse({ ...base, proofUrl: 'https://nptel.ac.in/c/1' }).success);
  assert.ok(!certificationSchema.safeParse({ ...base, proofUrl: 'javascript:alert(1)' }).success);
  assert.ok(!certificationSchema.safeParse({ ...base, proofUrl: 'data:text/html,hi' }).success);
});

test('multipart-style strings are coerced; empty optionals become null/undefined', () => {
  const r = certificationSchema.parse({ title: 'Intro to ML', platform: 'NPTEL', durationWeeks: '12', assessmentScore: '', issueDate: '', proofUrl: '' });
  assert.equal(r.durationWeeks, 12);
  assert.equal(r.assessmentScore, null);
  assert.equal(r.issueDate, null);
  assert.equal(r.proofUrl, undefined);
});

test('score and duration bounds are enforced', () => {
  const base = { title: 'Intro to ML', platform: 'NPTEL' };
  assert.ok(!certificationSchema.safeParse({ ...base, durationWeeks: 0 }).success);
  assert.ok(!certificationSchema.safeParse({ ...base, durationWeeks: 105 }).success);
  assert.ok(!certificationSchema.safeParse({ ...base, durationWeeks: 4, assessmentScore: 101 }).success);
});

test('reject / correction require a reason, approve does not', () => {
  assert.ok(reviewSchema.safeParse({ decision: 'approve' }).success);
  assert.ok(!reviewSchema.safeParse({ decision: 'reject' }).success);
  assert.ok(!reviewSchema.safeParse({ decision: 'correction', comment: 'no' }).success);
  assert.ok(reviewSchema.safeParse({ decision: 'reject', comment: 'Certificate is unreadable' }).success);
});

test('registration normalises email and ignores a client-supplied role', () => {
  const r = registerSchema.parse({ name: 'Asha K', email: '  Asha@Example.COM ', password: 'correct-horse-1', role: 'SUPER_ADMIN' });
  assert.equal(r.email, 'asha@example.com');
  assert.equal(r.role, undefined);
});

test('policy rejects out-of-range values', () => {
  assert.ok(!policySchema.safeParse({ name: 'p', weeksPerCredit: 0, minimumScore: 0, maxCreditsPerStudent: 5 }).success);
  assert.ok(!policySchema.safeParse({ name: 'p', weeksPerCredit: 4, minimumScore: 120, maxCreditsPerStudent: 5 }).success);
});
