import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Booking, User } from '../src/models.js';
import { bookingSlots, availableTimes, localDate } from '../src/schedule.js';

const origin = 'http://localhost:3000';
const app = createApp({
  origin,
  secret: 'integration-test-secret-at-least-32-characters',
  demo: true,
  production: false,
});
let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Booking.init(), User.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([Booking.deleteMany({}), User.deleteMany({})]);
});
function futureDate() {
  let date = new Date(Date.now() + 2 * 86400000);
  while (new Date(`${localDate(date)}T12:00:00-03:00`).getUTCDay() === 0)
    date = new Date(date.getTime() + 86400000);
  return localDate(date);
}
const payload = (time = '10:00', serviceId = 'corte') => ({
  serviceId,
  barberId: 'david',
  date: futureDate(),
  time,
});
async function demo(role = 'client') {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/demo')
    .set('Origin', origin)
    .send({ role })
    .expect(200);
  return agent;
}
async function register(email) {
  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .send({ name: 'Cliente teste', email, password: 'testing-password-123' })
    .expect(200);
  return agent;
}

test('atomic unique slot index admits exactly one concurrent booking', async () => {
  const client = await demo();
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      client.post('/api/bookings').set('Origin', origin).send(payload()),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
  assert.equal(await Booking.countDocuments(), 1);
});
test('60-minute combo blocks both half-hour slots; cancellation releases both', async () => {
  const client = await demo();
  const created = await client
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload('10:00', 'combo'))
    .expect(201);
  await client
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload('10:30'))
    .expect(409);
  const available = await client
    .get('/api/availability')
    .query({ serviceId: 'corte', barberId: 'david', date: futureDate() })
    .expect(200);
  assert.ok(!available.body.times.includes('10:00'));
  assert.ok(!available.body.times.includes('10:30'));
  await client
    .patch(`/api/bookings/${created.body.booking._id}/cancel`)
    .set('Origin', origin)
    .expect(200);
  await client
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload('10:30'))
    .expect(201);
});
test('demo sessions isolate bookings, including admin views', async () => {
  const first = await demo();
  const second = await demo();
  await first
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload())
    .expect(201);
  await second
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload())
    .expect(201);
  await first
    .post('/api/auth/demo')
    .set('Origin', origin)
    .send({ role: 'admin' })
    .expect(200);
  const result = await first.get('/api/bookings').expect(200);
  assert.equal(result.body.bookings.length, 1);
  assert.ok(result.body.bookings[0].expiresAt);
});
test('real clients cannot view or cancel another client booking', async () => {
  const first = await register('first@example.com');
  const second = await register('second@example.com');
  const created = await first
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload())
    .expect(201);
  assert.equal(
    (await second.get('/api/bookings').expect(200)).body.bookings.length,
    0,
  );
  await second
    .patch(`/api/bookings/${created.body.booking._id}/cancel`)
    .set('Origin', origin)
    .expect(404);
  await second
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload())
    .expect(409);
});
test('registration cannot promote a client to admin', async () => {
  const result = await request(app)
    .post('/api/auth/register')
    .set('Origin', origin)
    .send({
      name: 'Teste',
      email: 'client@example.com',
      password: 'testing-password-123',
      role: 'admin',
    })
    .expect(200);
  assert.equal(result.body.user.role, 'client');
  assert.ok(!result.body.user.password);
  assert.match(result.headers['set-cookie'][0], /HttpOnly/);
});
test('barber sees only own appointments; role forbids booking', async () => {
  const client = await demo();
  await client
    .post('/api/bookings')
    .set('Origin', origin)
    .send({ ...payload(), barberId: 'lucas' })
    .expect(201);
  await client
    .post('/api/auth/demo')
    .set('Origin', origin)
    .send({ role: 'barber' })
    .expect(200);
  assert.equal(
    (await client.get('/api/bookings').expect(200)).body.bookings.length,
    0,
  );
  await client
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload())
    .expect(403);
});
test('writes reject foreign origins and anonymous access', async () => {
  await request(app)
    .post('/api/auth/demo')
    .set('Origin', 'https://evil.example')
    .send({ role: 'admin' })
    .expect(403);
  await request(app)
    .post('/api/bookings')
    .set('Origin', origin)
    .send(payload())
    .expect(401);
  const client = await demo();
  await client.post('/api/auth/logout').set('Origin', origin).expect(204);
  await client.get('/api/bookings').expect(401);
});
test('invalid dates, past dates and off-grid schedules are rejected', () => {
  assert.throws(() => bookingSlots('corte', 'david', '2027-02-30', '10:00'));
  assert.throws(() => bookingSlots('corte', 'david', '2020-01-01', '10:00'));
  assert.throws(() => bookingSlots('corte', 'david', futureDate(), '10:15'));
  assert.throws(() => bookingSlots('combo', 'david', futureDate(), '18:30'));
  assert.throws(() => bookingSlots('corte', 'unknown', futureDate(), '10:00'));
  assert.equal(
    availableTimes('combo', 'david', futureDate(), []).includes('18:30'),
    false,
  );
});
