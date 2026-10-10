const express = require("express");
const path = require("node:path");

const app = express();

app.get("/", (request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (request, response) => {
  response.json({ status: "ok" });
});

module.exports = app;