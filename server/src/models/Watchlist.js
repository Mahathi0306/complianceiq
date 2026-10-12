import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    aliases: [{ type: String, trim: true }],
    source: { type: String, enum: ['SANCTIONS', 'PEP', 'INTERNAL'], required: true },
    country: String,
  },
  { timestamps: true }
);

watchlistSchema.index({ name: 1, source: 1 }, { unique: true });

export const Watchlist = mongoose.model('Watchlist', watchlistSchema);
