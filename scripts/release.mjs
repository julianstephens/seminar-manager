import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliArgs = process.argv.slice(2);
const rootDir = fileURLToPath(new URL("..", import.meta.url));
const changelogPath = join(rootDir, "CHANGELOG.md");

function printUsage() {
  console.log(`Usage: node ./scripts/release.mjs [--dry-run] [--no-push] [--no-release]

Creates an annotated git tag from the latest changelog entry, pushes it, and optionally creates a GitHub release.`);
}

function parseChangelog(changelogContent) {
  const lines = changelogContent.split(/\r?\n/);
  const versionHeaderRegex = /^##\s+\[?(v\d+\.\d+\.\d+)\]?\s*$/;

  const versionLineIndex = lines.findIndex((line) =>
    versionHeaderRegex.test(line),
  );
  if (versionLineIndex === -1) {
    throw new Error("Could not find a version header in CHANGELOG.md");
  }

  const versionMatch = lines[versionLineIndex].match(versionHeaderRegex);
  const version = versionMatch?.[1];

  if (!version) {
    throw new Error("Could not parse version from CHANGELOG.md");
  }

  const notes = [];
  for (let index = versionLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (versionHeaderRegex.test(line)) {
      break;
    }
    notes.push(line);
  }

  return { version, notes: notes.join("\n").trim() };
}

function runCommand(command, options = {}) {
  const { dryRun = false, input } = options;

  if (dryRun) {
    console.log(`[DRY RUN] Would run: ${command.join(" ")}`);
    return true;
  }

  console.log(`Running: ${command.join(" ")}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    input,
  });

  if (result.error) {
    console.error(result.error.message);
    return false;
  }

  if (result.status !== 0) {
    console.error(
      `Command failed with exit code ${result.status}: ${command.join(" ")}`,
    );
    return false;
  }

  return true;
}

function main() {
  const args = new Set(cliArgs);

  if (args.has("--help") || args.has("-h")) {
    printUsage();
    return;
  }

  const dryRun = args.has("--dry-run");
  const noPush = args.has("--no-push");
  const noRelease = args.has("--no-release");

  try {
    const changelogContent = readFileSync(changelogPath, "utf8");
    const { version, notes } = parseChangelog(changelogContent);

    console.log(`Reading ${changelogPath}...`);
    console.log(`Latest version: ${version}`);
    console.log("-".repeat(20));
    console.log(notes);
    console.log("-".repeat(20));

    const tempDir = mkdtempSync(join(tmpdir(), "release-"));
    const notesPath = join(tempDir, "release-notes.md");
    writeFileSync(notesPath, notes, "utf8");

    console.log(`Release notes written to temporary file: ${notesPath}`);

    if (
      !runCommand(["git", "tag", "-a", version, "-F", notesPath], { dryRun })
    ) {
      process.exitCode = 1;
      return;
    }

    rmSync(notesPath, { force: true });
    console.log(`Temporary file ${notesPath} removed.`);

    if (noPush) {
      console.log(
        "Skipping git tag push and GitHub release creation (--no-push specified).",
      );
      return;
    }

    if (!runCommand(["git", "push", "origin", version], { dryRun })) {
      process.exitCode = 1;
      return;
    }

    if (noRelease) {
      console.log("Skipping GitHub release creation (--no-release specified).");
      return;
    }

    if (
      !runCommand(
        ["gh", "release", "create", version, "-t", version, "--notes-from-tag"],
        { dryRun },
      )
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
