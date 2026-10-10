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

test("reports an unreachable deployment host as a failed deployment", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cipp-ssh-test-"));
  tempDirs.push(directory);
  const sshPath = path.join(directory, "ssh");
  fs.writeFileSync(sshPath, `#!/bin/sh
cat >/dev/null
echo "ssh: connect to host unavailable.example port 22: Connection timed out" >&2
exit 255
`, { mode: 0o755 });

  let exitCode = 0;
  let stderr = "";
  try {
    await execFileAsync("sh", [
      "scripts/deploy-via-ssh.sh",
      "ec2-user",
      "unavailable.example",
      "example/cipp:test-revision"
    ], {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` }
    });
  } catch (error) {
    exitCode = error.code;
    stderr = error.stderr;
  }

  assert.equal(exitCode, 1);
  assert.match(stderr, /Connection timed out/);
  assert.match(stderr, /Check EC2_HOST.*network reachability/);
});
