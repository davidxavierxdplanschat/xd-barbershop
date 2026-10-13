import { services, barbers } from './catalog.js';
export const timezone = 'America/Sao_Paulo';
export function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function bookingSlots(
  serviceId,
  barberId,
  date,
  time,
  now = new Date(),
) {
  const service = services.find((s) => s.id === serviceId);
  if (!service || !barbers.some((b) => b.id === barberId))
    throw new Error('Serviço ou barbeiro inválido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw new Error('Data ou horário inválido.');
  const start = new Date(`${date}T${time}:00-03:00`);
  if (Number.isNaN(start.getTime()) || localDate(start) !== date)
    throw new Error('Data inválida.');
  const [h, m] = time.split(':').map(Number);
  const minute = h * 60 + m;
  if (m % 30 !== 0 || minute < 9 * 60 || minute + service.duration > 19 * 60)
    throw new Error('Escolha um horário entre 09h e 19h.');
  if (new Date(`${date}T12:00:00-03:00`).getUTCDay() === 0)
    throw new Error('A barbearia fecha aos domingos.');
  if (start <= now || start.getTime() > now.getTime() + 60 * 86400000)
    throw new Error('Reserve um horário futuro dentro dos próximos 60 dias.');
  return {
    service,
    start,
    slots: Array.from(
      { length: service.duration / 30 },
      (_, i) => new Date(start.getTime() + i * 1800000),
    ),
  };
}
export function availableTimes(
  serviceId,
  barberId,
  date,
  occupied,
  now = new Date(),
) {
  const taken = new Set(occupied.map((d) => new Date(d).getTime()));
  return Array.from(
    { length: 20 },
    (_, i) =>
      `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
  ).filter((time) => {
    try {
      return bookingSlots(serviceId, barberId, date, time, now).slots.every(
        (s) => !taken.has(s.getTime()),
      );
    } catch {
      return false;
    }
  });
}
