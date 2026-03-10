const mongoose = require("mongoose");

const LiveLocationSchema = new mongoose.Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
    latitude: { type: Number },
    longitude: { type: Number },
    // Some datasets may use slightly different spellings/keys
    lattitude: { type: Number },
    long: { type: Number },
    busNumber: { type: String, trim: true },
    routeId: { type: String, trim: true },
    updatedAt: { type: Date },
    timestamp: { type: Date },
  },
  { strict: false, timestamps: false }
);

module.exports = mongoose.model("LiveLocation", LiveLocationSchema, "live_location");

