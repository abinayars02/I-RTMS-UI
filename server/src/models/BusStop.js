const mongoose = require("mongoose");

const BusStopSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    stop_name: { type: String, trim: true },
    routeId: { type: String, trim: true },
    route: { type: String, trim: true },
    order: { type: Number },
  },
  { strict: false, timestamps: false }
);

module.exports = mongoose.model("BusStop", BusStopSchema, "bus_stops");

