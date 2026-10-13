import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { User } from './models.js';
const settings = config();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12 || password.length > 72)
  throw new Error(
    'Configure ADMIN_EMAIL e ADMIN_PASSWORD (12 a 72 caracteres).',
  );
await mongoose.connect(settings.mongo);
await User.init();
if (await User.exists({ email }))
  console.log('Conta já existe. Nenhuma alteração realizada.');
else {
  await User.create({
    name: 'Administrador',
    email,
    password: await bcrypt.hash(password, 12),
    role: 'admin',
  });
  console.log('Administrador criado.');
}
await mongoose.disconnect();
