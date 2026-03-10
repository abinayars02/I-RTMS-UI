const mongoose = require("mongoose");
const dns = require("dns");

let connected = false;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function applyDnsServersFromEnv() {
  const raw = (process.env.DNS_SERVERS || "").trim();
  if (!raw) return false;
  const servers = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!servers.length) return false;
  dns.setServers(servers);
  return true;
}

async function connectToMongo() {
  if (connected) return mongoose.connection;

  const uri = requireEnv("MONGODB_URI");
  const dbName = process.env.MONGODB_DB || "iRTMS";

  mongoose.set("strictQuery", true);
  // If the network DNS blocks SRV lookups for Node, allow overriding DNS servers.
  applyDnsServersFromEnv();

  try {
    await mongoose.connect(uri, { dbName });
  } catch (err) {
    const msg = String((err && err.message) || err || "");
    const isSrvRefused =
      uri.startsWith("mongodb+srv://") &&
      (msg.includes("querySrv") || msg.includes("_mongodb._tcp")) &&
      (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"));

    if (isSrvRefused) {
      // Retry once with public resolvers (often fixes corporate/VPN DNS SRV issues).
      dns.setServers(["1.1.1.1", "8.8.8.8"]);
      await mongoose.connect(uri, { dbName });
    } else {
      throw err;
    }
  }
  connected = true;

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error", err);
  });

  return mongoose.connection;
}

module.exports = { connectToMongo };

