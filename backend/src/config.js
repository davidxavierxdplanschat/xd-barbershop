import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true,
});
export function config() {
  if (!process.env.MONGODB_URI)
    throw new Error('Configure MONGODB_URI no backend/.env.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  return {
    mongo: process.env.MONGODB_URI,
    secret: process.env.JWT_SECRET,
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    production: process.env.NODE_ENV === 'production',
    demo: process.env.DEMO_ENABLED === 'true',
  };
}
