const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const { connectToMongo } = require("./src/db");
const apiRouter = require("./src/routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../public")));

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
