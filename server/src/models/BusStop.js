const mongoose = require("mongoose");

const BusStopSchema = new mongoose.Schema(
  {
    stop_id: { type: String, trim: true },
    route_id: { type: String, trim: true },
    stop_name: { type: String, trim: true },
    arrival_time: { type: String, trim: true },
    stop_order: { type: Number },
  },
  { strict: false, timestamps: false }
);

module.exports = mongoose.model("BusStop", BusStopSchema, "bus_stops");


const mongoose = require("mongoose");

const BusStopSchema = new mongoose.Schema(
  {
    stop_id: { type: String, trim: true },
    route_id: { type: String, trim: true },
    stop_name: { type: String, trim: true },
    arrival_time: { type: String, trim: true },
    stop_order: { type: Number },
  },
  { strict: false, timestamps: false }
);

module.exports = mongoose.model("BusStop", BusStopSchema, "bus_stops");

