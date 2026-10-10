const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const { afterEach, test } = require("node:test");

const execFileAsync = promisify(execFile);
const tempDirs = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

async function runDeployment({ candidate, initialContainer }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cipp-deploy-test-"));
  tempDirs.push(directory);
  const binDir = path.join(directory, "bin");
  const homeDir = path.join(directory, "home");
  const stateFile = path.join(directory, "docker-state.json");
  fs.mkdirSync(binDir);
  fs.mkdirSync(homeDir);
  fs.writeFileSync(stateFile, JSON.stringify({
    container: initialContainer,
    images: initialContainer ? [initialContainer.image] : []
  }));

  const mockDocker = `#!/usr/bin/env node
const fs = require("node:fs");
const statePath = process.env.MOCK_DOCKER_STATE;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
const fail = message => { console.error(message); process.exit(1); };

if (args[0] === "pull") {
  if (args[1].includes("pull-failure")) fail("mock registry connection failed");
  if (!state.images.includes(args[1])) state.images.push(args[1]);
  save();
} else if (args[0] === "container" && args[1] === "inspect") {
  if (!state.container) process.exit(1);
} else if (args[0] === "image" && args[1] === "inspect") {
  if (!state.images.includes(args[2])) process.exit(1);
} else if (args[0] === "inspect") {
  const format = args[2];
  if (!state.container) process.exit(1);
  if (format === "{{.State.Running}}") console.log(state.container.running);
  else if (format === "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}") console.log(state.container.health);
  else if (format === "{{.Config.Image}}") console.log(state.container.image);
  else fail("unexpected inspect format " + format);
} else if (args[0] === "rm") {
  state.container = null;
  save();
} else if (args[0] === "run") {
  const image = args[args.length - 1];
  state.container = {
    image,
    running: image.includes("crash") ? "false" : "true",
    health: image.includes("crash") ? "unhealthy" : "healthy"
  };
  if (!state.images.includes(image)) state.images.push(image);
  save();
  console.log("mock-container-id");
} else if (args[0] === "logs") {
  console.log("mock logs for " + (state.container ? state.container.image : "removed container"));
} else if (args[0] === "exec") {
  if (!state.container || state.container.running !== "true") process.exit(1);
} else {
  fail("unexpected docker command: " + args.join(" "));
}
`;
  const dockerPath = path.join(binDir, "docker");
  fs.writeFileSync(dockerPath, mockDocker, { mode: 0o755 });

  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    const result = await execFileAsync("sh", [
      path.join(__dirname, "../scripts/deploy-remote.sh"),
      `example/cipp:${candidate}`
    ], {
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH}`,
        MOCK_DOCKER_STATE: stateFile
      }
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    stdout = error.stdout;
    stderr = error.stderr;
    exitCode = error.code;
  }

  return {
    exitCode,
    stdout,
    stderr,
    state: JSON.parse(fs.readFileSync(stateFile, "utf8")),
    releaseFile: path.join(homeDir, ".cipp-deploy/deployed-release.txt")
  };
}

test("records the release only after the new container is healthy", async () => {
  const result = await runDeployment({
    candidate: "good-release",
    initialContainer: { image: "example/cipp:old-release", running: "true", health: "healthy" }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.state.container.image, "example/cipp:good-release");
  assert.match(fs.readFileSync(result.releaseFile, "utf8"), /^example\/cipp:good-release\n/);
});

test("restores and records the last healthy release when the candidate crashes", async () => {
  const result = await runDeployment({
    candidate: "crash-release",
    initialContainer: { image: "example/cipp:old-release", running: "true", health: "none" }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.state.container.image, "example/cipp:old-release");
  assert.match(fs.readFileSync(result.releaseFile, "utf8"), /^example\/cipp:old-release\n/);
  assert.match(result.stderr, /mock logs for example\/cipp:crash-release/);
  assert.match(result.stderr, /Rollback succeeded/);
});

test("keeps the running release untouched when pulling a candidate fails", async () => {
  const result = await runDeployment({
    candidate: "pull-failure",
    initialContainer: { image: "example/cipp:old-release", running: "true", health: "healthy" }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.state.container.image, "example/cipp:old-release");
  assert.equal(fs.existsSync(result.releaseFile), false);
  assert.match(result.stderr, /mock registry connection failed/);
});
