import { Schema, model, models, Document, Model } from 'mongoose';

// Event attributes used when creating a new document
export interface EventAttrs {
  title: string;
  slug?: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string; // normalized to YYYY-MM-DD
  time: string; // normalized to HH:mm
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
}

// Event document type including timestamps
export interface EventDocument extends EventAttrs, Document {
  createdAt: Date;
  updatedAt: Date;
}

// Basic slug generator to create URL-friendly slugs from titles
const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-') // replace spaces/underscores with dashes
    .replace(/[^a-z0-9-]/g, '') // remove invalid chars
    .replace(/-+/g, '-') // collapse multiple dashes
    .replace(/^-|-$/g, ''); // trim leading/trailing dashes
};

// Normalize a date string to ISO date (YYYY-MM-DD)
const normalizeDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid event date');
  }
  return date.toISOString().split('T')[0];
};

// Normalize time string to 24h HH:mm format
const normalizeTime = (value: string): string => {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error('Invalid event time; expected HH:mm');
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Invalid event time; hour must be 0-23 and minutes 0-59');
  }

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
};

const eventSchema = new Schema<EventDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true, // unique index for fast lookups by slug
      trim: true,
    },
    description: { type: String, required: true, trim: true },
    overview: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    mode: { type: String, required: true, trim: true },
    audience: { type: String, required: true, trim: true },
    agenda: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]): boolean => Array.isArray(value) && value.length > 0,
        message: 'Agenda must contain at least one item',
      },
    },
    organizer: { type: String, required: true, trim: true },
    tags: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]): boolean => Array.isArray(value) && value.length > 0,
        message: 'Tags must contain at least one item',
      },
    },
  },
  {
    timestamps: true, // automatically manage createdAt and updatedAt
    strict: true,
  },
);

// Extra unique index on slug (in addition to the field-level unique option)
eventSchema.index({ slug: 1 }, { unique: true });

// Pre-save hook to validate data, normalize date/time, and generate slug
// Runs on both document creation and updates
eventSchema.pre<EventDocument>('save', function preSave(next) {
  try {
    // Ensure all required string fields are non-empty after trimming
    const requiredStringFields: (keyof EventAttrs)[] = [
      'title',
      'description',
      'overview',
      'image',
      'venue',
      'location',
      'date',
      'time',
      'mode',
      'audience',
      'organizer',
    ];

    for (const field of requiredStringFields) {
      const raw = this[field];
      if (typeof raw !== 'string' || raw.trim().length === 0) {
        return next(new Error(`Field "${String(field)}" is required and cannot be empty`));
      }
      // persist trimmed value
      (this as any)[field] = raw.trim();
    }

    // Ensure required array fields are non-empty
    if (!Array.isArray(this.agenda) || this.agenda.length === 0) {
      return next(new Error('Field "agenda" is required and cannot be empty'));
    }

    if (!Array.isArray(this.tags) || this.tags.length === 0) {
      return next(new Error('Field "tags" is required and cannot be empty'));
    }

    // Generate or regenerate slug only when title changes
    if (this.isModified('title')) {
      const generatedSlug = slugify(this.title);
      if (!generatedSlug) {
        return next(new Error('Generated slug is empty; check event title'));
      }
      this.slug = generatedSlug;
    }

    // Normalize date and time into consistent formats
    if (this.isModified('date')) {
      this.date = normalizeDate(this.date);
    }

    if (this.isModified('time')) {
      this.time = normalizeTime(this.time);
    }

    return next();
  } catch (error) {
    return next(error as Error);
  }
});

export const Event: Model<EventDocument> =
  (models.Event as Model<EventDocument> | undefined) || model<EventDocument>('Event', eventSchema);
