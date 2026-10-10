const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../app");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test("serves the task app", async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /خلّي يومك يمشي بخطوة/);
});

test("reports a healthy status", async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("reports the deployed version and revision", async () => {
  process.env.BUILD_VERSION = "1.2.3";
  process.env.BUILD_REVISION = "test-revision";
  try {
    const response = await fetch(`${baseUrl}/version`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { version: "1.2.3", revision: "test-revision" });
  } finally {
    delete process.env.BUILD_VERSION;
    delete process.env.BUILD_REVISION;
  }
});