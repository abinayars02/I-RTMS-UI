const nodemailer = require("nodemailer");
function getTransport() {
  const user = (process.env.EMAIL_USER || "").trim();
  const pass = process.env.EMAIL_PASS || "";
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  })
}
async function sendRegistrationOtp(email, otp) {
  const transport = getTransport();
  if (!transport) {
    const error = new Error("Mail transport is not configured");
    error.code = "MAIL_NOT_CONFIGURED";
    throw error;
  }
  const from = (process.env.EMAIL_FROM || process.env.EMAIL_USER || "").trim();
  if (!from) {
    const error = new Error("Mail sender is not configured");
    error.code = "MAIL_NOT_CONFIGURED";
    throw error;
  }
  await transport.sendMail({
    from,
    to: email,
    subject: "Your BusCrowdTrack verification code",
    text: `Your BusCrowdTrack verification code is ${otp}. It expires in 10 minutes.`,
  });
}
module.exports = { sendRegistrationOtp };
