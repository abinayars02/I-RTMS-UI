const mongoose = require("mongoose");

const LiveLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
    timestamp: { type: Date },
  },
  { strict: false, timestamps: false }
);

module.exports = mongoose.model("LiveLocation", LiveLocationSchema, "live_location");


const mongoose = require("mongoose");

const LiveLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
    timestamp: { type: Date },
  },
  { strict: false, timestamps: false }
);

module.exports = mongoose.model("LiveLocation", LiveLocationSchema, "live_location");

