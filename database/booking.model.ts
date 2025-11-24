import { Schema, model, models, Document, Model, Types } from 'mongoose';
import { Event } from './event.model';

// Booking attributes used when creating a new document
export interface BookingAttrs {
  eventId: Types.ObjectId;
  email: string;
}

// Booking document type including timestamps
export interface BookingDocument extends BookingAttrs, Document {
  createdAt: Date;
  updatedAt: Date;
}

// Simple email validator suitable for most use cases
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bookingSchema = new Schema<BookingDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true, // index for faster lookups by event
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value: string): boolean => emailRegex.test(value),
        message: 'Invalid email address',
      },
    },
  },
  {
    timestamps: true, // automatically manage createdAt and updatedAt
    strict: true,
  },
);

// Explicit index on eventId to optimize common queries
bookingSchema.index({ eventId: 1 });

// Pre-save hook to validate email and ensure referenced event exists
bookingSchema.pre<BookingDocument>('save', async function preSave(next) {
  try {
    // Validate email format defensively in case it bypasses schema validation
    if (!emailRegex.test(this.email)) {
      return next(new Error('Invalid email address'));
    }

    // Ensure the referenced event exists before creating the booking
    const eventExists = await Event.exists({ _id: this.eventId });
    if (!eventExists) {
      return next(new Error('Referenced event does not exist'));
    }

    return next();
  } catch (error) {
    return next(error as Error);
  }
});

export const Booking: Model<BookingDocument> =
  (models.Booking as Model<BookingDocument> | undefined) ||
  model<BookingDocument>('Booking', bookingSchema);
