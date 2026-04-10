const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const { connectToMongo } = require("./src/db");
const apiRouter = require("./src/routes");
const { attachSessionUser, destroySession } = require("./src/auth");

const app = express();
const publicDir = path.join(__dirname, "../public");
const publicHtmlPaths = new Set(["/", "/login.html", "/register.html", "/logout.html", "/forgot-password.html", "/reset-password.html"]);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  attachSessionUser(req);
  next();
});

app.use("/api", (req, res, next) => {
  const publicApiPaths = new Set(["/auth/login", "/auth/register", "/auth/register/request-verification", "/auth/register/verify", "/auth/logout", "/auth/forgot-password", "/auth/reset-password", "/auth/reset-password/validate"]);
  if (publicApiPaths.has(req.path)) return next();
  if (req.user) return next();
  return res.status(401).json({ message: "Unauthorized" });
});

app.use("/api", apiRouter);

app.get("/logout.html", (req, res, next) => {
  destroySession(req, res);
  next();
});

app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const isHtmlRequest =
    req.method === "GET" && (req.path === "/" || ext === ".html" || !ext);

  if (!isHtmlRequest) return next();
  if (publicHtmlPaths.has(req.path)) return next();
  if (req.user) return next();
  return res.redirect("/login.html");
});

// Serve frontend static files
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

const PORT = process.env.PORT || 5000;

connectToMongo()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB. Server not started.");
    console.error(err);
    process.exitCode = 1;
  });
