const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const mongoose = require('mongoose');

const app = require('../../server');
const Feedback = require('../../models/Feedback');
const User = require('../../models/User');
const { COOKIE_NAME, signSession } = require('../../utils/auth');

const database = 'medikiosk_feedback_test_' + randomUUID().replaceAll('-', '');
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
process.env.JWT_SECRET = randomBytes(48).toString('hex');

let server;
let feedbackUrl;
let adminCookie;
let doctorCookie;

const sessionCookie = (user) => COOKIE_NAME + '=' + signSession(user._id);

function submit(body, key) {
  const headers = { 'Content-Type': 'application/json' };
  if (key !== undefined) headers['Idempotency-Key'] = key;
  return fetch(feedbackUrl, { method: 'POST', headers, body: JSON.stringify(body) });
}

function average(cookie) {
  const headers = cookie ? { Cookie: cookie } : {};
  return fetch(feedbackUrl + '/average', { headers });
}

before(async () => {
  await mongoose.connect(mongoUri, { dbName: database, serverSelectionTimeoutMS: 5000 });
  const [admin, doctor] = await User.create([
    { name: 'Feedback Test Administrator', email: 'feedback-admin@medikiosk.test', role: 'administrator', passwordHash: 'unused-test-hash' },
    { name: 'Feedback Test Doctor', email: 'feedback-doctor@medikiosk.test', role: 'doctor', passwordHash: 'unused-test-hash' },
  ]);
  adminCookie = sessionCookie(admin);
  doctorCookie = sessionCookie(doctor);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  feedbackUrl = 'http://127.0.0.1:' + server.address().port + '/api/feedback';
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

test('feedback validates anonymous writes, counts concurrent retries once, and protects averages', async () => {
  assert.equal((await average()).status, 401);
  assert.equal((await average(doctorCookie)).status, 403);
  const empty = await average(adminCookie);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { averageRating: null, count: 0 });

  for (const body of [{}, { rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: '5' }, { rating: 5, patientId: 'synthetic' }]) {
    const invalid = await submit(body);
    assert.equal(invalid.status, 400);
    assert.equal(typeof (await invalid.json()).error.message, 'string');
  }
  const malformedKey = await submit({ rating: 4 }, 'invalid-test-key');
  assert.equal(malformedKey.status, 400);
  assert.equal(typeof (await malformedKey.json()).error.message, 'string');
  assert.equal(await Feedback.countDocuments(), 0);

  const key = randomBytes(16).toString('hex');
  const ratings = [2, 5, 2, 5, 2, 5, 2, 5, 2, 5, 2, 5];
  const responses = await Promise.all(ratings.map((rating) => submit({ rating }, key)));
  const accepted = responses.map((response, index) => response.status === 201 ? ratings[index] : null)
    .filter((rating) => rating !== null);
  assert.equal(accepted.length, 1);
  assert.equal(responses.filter((response) => response.status === 200).length, ratings.length - 1);
  for (const response of responses) {
    assert.deepEqual(await response.json(), { message: 'Feedback received.' });
  }

  const feedback = await Feedback.findById(key).lean();
  assert.equal(feedback.rating, accepted[0]);
  assert(feedback.createdAt instanceof Date);
  assert.deepEqual(Object.keys(feedback).sort(), ['_id', 'createdAt', 'rating']);
  assert.equal(await Feedback.countDocuments(), 1);
  assert.equal((await submit({ rating: 1 })).status, 201);
  assert.equal((await submit({ rating: 5 })).status, 201);

  const summary = await average(adminCookie);
  assert.equal(summary.status, 200);
  assert.deepEqual(await summary.json(), { averageRating: (accepted[0] + 6) / 3, count: 3 });

  let limited;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await submit({ rating: 0 });
    if (response.status === 429) {
      limited = response;
      break;
    }
    assert.equal(response.status, 400);
    await response.json();
  }
  assert(limited);
  assert(limited.headers.has('retry-after'));
  assert(limited.headers.has('ratelimit'));
  assert.equal(typeof (await limited.json()).error.message, 'string');
  assert.equal(await Feedback.countDocuments(), 3);
  assert.equal((await average(adminCookie)).status, 200);
});
