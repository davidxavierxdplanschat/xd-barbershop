import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { User, Booking } from './models.js';
import { services, barbers } from './catalog.js';
import {
  availableTimes,
  bookingSlots,
  localDate,
  timezone,
} from './schedule.js';

const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
});
const registration = credentials.extend({
  name: z.string().trim().min(2).max(60),
});
const reservation = z.object({
  serviceId: z.string(),
  barberId: z.string(),
  date: z.string(),
  time: z.string(),
});
const safeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  role: user.role,
  barberId: user.barberId,
  demo: false,
});

export function createApp(settings) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: settings.origin, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Muitas requisições. Aguarde um minuto.' },
    }),
  );
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 25,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  });
  app.use('/api', (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.get('origin') !== settings.origin
    )
      return res.status(403).json({ error: 'Origem não autorizada.' });
    next();
  });
  const cookieOptions = {
    httpOnly: true,
    secure: settings.production,
    sameSite: 'lax',
    path: '/api',
    maxAge: 8 * 3600000,
  };
  function session(res, user) {
    res.cookie(
      'xd_session',
      jwt.sign(user, settings.secret, { expiresIn: '8h', algorithm: 'HS256' }),
      cookieOptions,
    );
    res.json({ user });
  }
  function auth(req, res, next) {
    try {
      req.user = jwt.verify(req.cookies.xd_session, settings.secret, {
        algorithms: ['HS256'],
      });
      next();
    } catch {
      res.status(401).json({ error: 'Entre para continuar.' });
    }
  }
  const scope = (user) => (user.demo ? user.scope : 'public');
  const visibility = (user) => ({
    scope: scope(user),
    ...(user.role === 'client'
      ? { clientId: user.id }
      : user.role === 'barber'
        ? { barberId: user.barberId }
        : {}),
  });

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', project: 'XD Barbershop' }),
  );
  app.get('/api/catalog', (req, res) =>
    res.json({
      services,
      barbers,
      timezone,
      today: localDate(),
      demoEnabled: settings.demo,
    }),
  );
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const data = registration.parse(req.body);
    const user = await User.create({
      ...data,
      password: await bcrypt.hash(data.password, 12),
    });
    session(res, safeUser(user));
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const data = credentials.parse(req.body);
    const user = await User.findOne({ email: data.email }).select('+password');
    if (!user || !(await bcrypt.compare(data.password, user.password)))
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    session(res, safeUser(user));
  });
  app.post('/api/auth/demo', authLimit, async (req, res) => {
    if (!settings.demo)
      return res.status(404).json({ error: 'Demonstração desativada.' });
    const { role } = z
      .object({ role: z.enum(['client', 'barber', 'admin']) })
      .parse(req.body);
    let demoScope;
    try {
      const previous = jwt.verify(req.cookies.xd_session, settings.secret);
      if (previous.demo) demoScope = previous.scope;
    } catch {}
    demoScope ||= randomUUID();
    session(res, {
      id: `demo-${demoScope}`,
      scope: demoScope,
      name: 'Visitante',
      role,
      demo: true,
      ...(role === 'barber' ? { barberId: 'david' } : {}),
    });
  });
  app.get('/api/auth/me', auth, (req, res) => {
    const { iat, exp, ...user } = req.user;
    res.json({ user });
  });
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('xd_session', { ...cookieOptions, maxAge: undefined });
    res.status(204).end();
  });
  app.get('/api/availability', auth, async (req, res) => {
    const { serviceId, barberId, date } = z
      .object({
        serviceId: z.enum(['corte', 'barba', 'combo']),
        barberId: z.enum(['david', 'lucas', 'rafael']),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(req.query);
    const from = new Date(`${date}T00:00:00-03:00`);
    if (Number.isNaN(from.getTime()) || localDate(from) !== date)
      return res.status(400).json({ error: 'Data inválida.' });
    const bookings = await Booking.find({
      scope: scope(req.user),
      barberId,
      status: 'confirmed',
      start: { $gte: from, $lt: new Date(from.getTime() + 86400000) },
    })
      .select('slots')
      .lean();
    res.json({
      times: availableTimes(
        serviceId,
        barberId,
        date,
        bookings.flatMap((b) => b.slots),
      ),
    });
  });
  app.get('/api/bookings', auth, async (req, res) => {
    const bookings = await Booking.find(visibility(req.user))
      .sort({ start: -1 })
      .limit(200)
      .lean();
    res.json({ bookings });
  });
  app.post('/api/bookings', auth, async (req, res) => {
    if (req.user.role !== 'client')
      return res
        .status(403)
        .json({ error: 'Use o perfil de cliente para agendar.' });
    const data = reservation.parse(req.body);
    let schedule;
    try {
      schedule = bookingSlots(
        data.serviceId,
        data.barberId,
        data.date,
        data.time,
      );
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (
      req.user.demo &&
      (await Booking.countDocuments({ scope: scope(req.user) })) >= 20
    )
      return res.status(429).json({
        error:
          'Esta demonstração permite até 20 reservas. Cancele ou inicie uma nova sessão mais tarde.',
      });
    const booking = await Booking.create({
      scope: scope(req.user),
      clientId: req.user.id,
      clientName: req.user.name,
      barberId: data.barberId,
      serviceId: data.serviceId,
      start: schedule.start,
      slots: schedule.slots,
      price: schedule.service.price,
      ...(req.user.demo
        ? { expiresAt: new Date(Date.now() + 7 * 86400000) }
        : {}),
    });
    res.status(201).json({ booking });
  });
  app.patch('/api/bookings/:id/cancel', auth, async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id))
      return res.status(400).json({ error: 'Reserva inválida.' });
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        ...visibility(req.user),
        status: 'confirmed',
        start: { $gt: new Date() },
      },
      { status: 'cancelled' },
      { new: true },
    );
    if (!booking)
      return res
        .status(404)
        .json({ error: 'Reserva não encontrada ou já encerrada.' });
    res.json({ booking });
  });
  app.use((req, res) =>
    res.status(404).json({ error: 'Rota não encontrada.' }),
  );
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: 'Confira os campos informados.',
        details: error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    if (error.code === 11000)
      return res.status(409).json({
        error: error.keyPattern?.email
          ? 'Este e-mail já está cadastrado.'
          : 'Este horário acabou de ser reservado. Escolha outro.',
      });
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'JSON inválido.' });
    if (error.status === 413)
      return res.status(413).json({ error: 'Requisição muito grande.' });
    console.error('API error:', error.name);
    res
      .status(500)
      .json({ error: 'Não foi possível concluir. Tente novamente.' });
  });
  return app;
}
