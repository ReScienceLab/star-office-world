#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const yaml = readFileSync("world.yaml", "utf8");

const sdkRange = pkg.dependencies["@resciencelab/agent-world-sdk"] || "^1.6.0";

const updated = yaml
  .replace(/^(\s+version:\s*").*(")$/m, `$1${pkg.version}$2`)
  .replace(/^(\s+sdkVersion:\s*").*(")$/m, `$1${sdkRange}$2`);

if (updated !== yaml) {
  writeFileSync("world.yaml", updated);
  console.log(`world.yaml synced: version=${pkg.version}, sdkVersion=${sdkRange}`);
} else {
  console.log("world.yaml already up to date");
}
