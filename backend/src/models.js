import mongoose from 'mongoose';
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['client', 'barber', 'admin'],
      default: 'client',
    },
    barberId: String,
  },
  { timestamps: true },
);
const bookingSchema = new mongoose.Schema(
  {
    scope: { type: String, required: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    barberId: { type: String, required: true },
    serviceId: { type: String, required: true },
    start: { type: Date, required: true },
    slots: [{ type: Date, required: true }],
    price: Number,
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
    },
    expiresAt: Date,
  },
  { timestamps: true },
);
// A single atomic insert claims every 30-minute block. Partial index releases them on cancellation.
bookingSchema.index(
  { scope: 1, barberId: 1, slots: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } },
);
bookingSchema.index({ scope: 1, start: 1 });
bookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const User = mongoose.model('User', userSchema);
export const Booking = mongoose.model('Booking', bookingSchema);
