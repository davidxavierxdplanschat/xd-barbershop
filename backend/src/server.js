import mongoose from 'mongoose';
import { config } from './config.js';
import { createApp } from './app.js';
import { Booking, User } from './models.js';
const settings = config();
await mongoose.connect(settings.mongo, { serverSelectionTimeoutMS: 10000 });
await Promise.all([Booking.init(), User.init()]);
const server = createApp(settings).listen(process.env.PORT || 4000, () =>
  console.log('XD Barbershop API pronta.'),
);
async function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
