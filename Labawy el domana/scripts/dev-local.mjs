import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, chmodSync } from "node:fs";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
process.umask(0o077);
const local = join(root, ".local");
const data = join(local, "postgres");
const passwordFile = join(local, "postgres-password");
const logFile = join(local, "postgres.log");
const linksFile = join(local, "owner-links.txt");
const port = 55432;
const candidates = [
  ...(process.env.PATH || "").split(delimiter),
  "/usr/local/opt/postgresql@14/bin",
  "/Library/PostgreSQL/18/bin",
  "/opt/homebrew/opt/postgresql@18/bin",
  "/opt/homebrew/opt/postgresql@17/bin",
];
const major = existsSync(join(data, "PG_VERSION")) ? readFileSync(join(data, "PG_VERSION"), "utf8").trim() : null;
const bin = candidates.find(directory => {
  if (!existsSync(join(directory, "initdb")) || !existsSync(join(directory, "pg_ctl"))) return false;
  const version = spawnSync(join(directory, "initdb"), ["--version"], { encoding: "utf8" });
  return version.status === 0 && (!major || version.stdout.match(/PostgreSQL\) (\d+)/)?.[1] === major);
});

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 30000, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed.\n${result.stderr || result.stdout || result.error?.message || "Unknown error"}`);
  }
  return result.stdout;
}

async function withClient(database, password, action) {
  const client = new pg.Client({ host: "127.0.0.1", port, user: "domino", password, database, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    return await action(client);
  } finally {
    await client.end();
  }
}

try {
  if (!bin) throw new Error("Compatible PostgreSQL binaries were not found. Install PostgreSQL or add its bin directory to PATH.");
  if (process.argv.includes("--check")) {
    console.log(`PostgreSQL tools found: ${bin}`);
    console.log(`Local database: 127.0.0.1:${port}; application: http://localhost:3000`);
    process.exit(0);
  }
  if (process.argv.includes("--stop")) {
    if (existsSync(join(data, "PG_VERSION"))) {
      const status = spawnSync(join(bin, "pg_ctl"), ["-D", data, "status"]);
      if (status.status === 0) console.log(run(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "-t", "20", "stop"]));
      else console.log("The project database is already stopped.");
    }
    process.exit(0);
  }
  mkdirSync(local, { recursive: true, mode: 0o700 });
  if (!existsSync(passwordFile)) {
    if (existsSync(join(data, "PG_VERSION"))) throw new Error("The saved local database password is missing. Existing data has been preserved.");
    writeFileSync(passwordFile, `${randomBytes(32).toString("hex")}\n`, { mode: 0o600, flag: "wx" });
  }
  const password = readFileSync(passwordFile, "utf8").trim();
  if (!existsSync(join(data, "PG_VERSION"))) {
    console.log("Initializing the project's PostgreSQL database...");
    console.log(run(join(bin, "initdb"), ["-D", data, "-U", "domino", "--pwfile", passwordFile, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"]));
    appendFileSync(join(data, "postgresql.conf"), `\n# Project-local development database\nlisten_addresses = '127.0.0.1'\nport = ${port}\nunix_socket_directories = ''\n`);
  }
  const status = spawnSync(join(bin, "pg_ctl"), ["-D", data, "status"]);
  if (status.status !== 0) {
    console.log(`Starting the project database on port ${port}...`);
    try {
      console.log(run(join(bin, "pg_ctl"), ["-D", data, "-l", logFile, "-w", "-t", "20", "start"]));
    } catch (error) {
      throw new Error(`${error.message}\n${existsSync(logFile) ? readFileSync(logFile, "utf8").split("\n").slice(-15).join("\n") : ""}`);
    }
  }
  await withClient("postgres", password, async client => {
    const result = await client.query("SHOW data_directory");
    if (result.rows[0].data_directory !== data) throw new Error(`Port ${port} belongs to a different PostgreSQL instance. It has not been modified.`);
    for (const database of ["domino_dev", "domino_test"]) {
      const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
      if (!existing.rowCount) await client.query(`CREATE DATABASE "${database}"`);
    }
  });
  const secretFile = join(local, "rate-limit-secret");
  if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  const databaseUrl = `postgresql://domino:${password}@127.0.0.1:${port}/domino_dev`;
  const env = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    TEST_DATABASE_URL: `postgresql://domino:${password}@127.0.0.1:${port}/domino_test`,
    APP_URL: "http://localhost:3000",
    RATE_LIMIT_SECRET: readFileSync(secretFile, "utf8").trim(),
  };
  const envFile = join(root, ".env");
  const backup = join(local, "env.before-native");
  if (existsSync(envFile) && !existsSync(backup)) {
    copyFileSync(envFile, backup);
    chmodSync(backup, 0o600);
  }
  writeFileSync(envFile, ["DATABASE_URL", "DIRECT_URL", "TEST_DATABASE_URL", "APP_URL", "RATE_LIMIT_SECRET"].map(key => `${key}=${env[key]}`).join("\n") + "\n", { mode: 0o600 });
  chmodSync(envFile, 0o600);
  console.log("Applying database migrations...");
  console.log(run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"], { env }));
  const seeded = await withClient("domino_dev", password, async client => {
    const result = await client.query("SELECT 1 FROM leagues WHERE name = $1", ["The Café Club"]);
    return result.rowCount > 0;
  });
  if (!seeded) {
    const output = run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"], { env });
    writeFileSync(linksFile, output, { mode: 0o600 });
    console.log(output);
  } else if (existsSync(linksFile)) {
    console.log(readFileSync(linksFile, "utf8"));
  }
  console.log("Private development links are saved in .local/owner-links.txt.");
  if (process.argv.includes("--setup-only")) process.exit(0);
  console.log("Starting the app at http://localhost:3000. Ctrl+C stops the app; scores remain saved.");
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"], { cwd: root, env, stdio: "inherit" });
  server.on("error", error => { console.error(error.message); process.exitCode = 1; });
  server.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" ? 0 : 1); });
  process.on("SIGINT", () => server.kill("SIGINT"));
  process.on("SIGTERM", () => server.kill("SIGTERM"));
} catch (error) {
  console.error(`Local setup could not finish: ${error.message}`);
  process.exitCode = 1;
}
