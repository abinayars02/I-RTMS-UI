const mongoose = require("mongoose");
const PendingRegistrationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    otpIssuedAt: { type: Date, required: true },
  },
  { timestamps: true }
);
module.exports = mongoose.model("PendingRegistration", PendingRegistrationSchema, "pending_registrations");
