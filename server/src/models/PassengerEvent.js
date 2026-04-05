const mongoose = require("mongoose");

// Flexible schema: we only rely on numeric fields when present.
const PassengerEventSchema = new mongoose.Schema(
  {
    value: { type: Number },
    in: { type: Number },
    inside_total: { type: Number },
    busNumber: { type: String, trim: true },
    routeId: { type: String, trim: true },
    timestamp: { type: Date },
  },
  { strict: false, timestamps: false }
);

module.exports = mongoose.model(
  "PassengerEvent",
  PassengerEventSchema,
  "passenger_events"
);

