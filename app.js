const express = require("express");
const path = require("node:path");

const app = express();

app.get("/", (request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (request, response) => {
  response.json({ status: "ok" });
});

app.get("/version", (request, response) => {
  response.json({
    version: process.env.BUILD_VERSION || "dev",
    revision: process.env.BUILD_REVISION || "unknown"
  });
});

module.exports = app;