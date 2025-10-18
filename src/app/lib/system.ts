// src/app/lib/system.ts
import os from "os";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

const execAsync = promisify(execCb);

export type SystemDetails = {
  platform: string;
  release: string;
  arch: string;
  hostname: string;
  uptimeSec: number;
  loadAvg: number[];
  cpuTempC: number | null;
  cpuUsagePercentPerCore: string[];
  memoryGB: {
    total: number;
    used: number;
    free: number;
  };
  memoryGBNoCache: {
    used: number;
    available: number;
  } | null;
  rootDisk: {
    totalGB: number;
    usedGB: number;
    freeGB: number;
  } | null;
  activeUsers: Array<{
    user: string;
    tty: string;
    host: string | null;
    since: string;
  }>;
  sshConnections: Array<{
    state: string;
    local: string;
    remote: string;
  }>;
};

/* ----------------------- small type helpers ----------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** One temperature sensor entry in `sensors -j` */
type SensorEntry = {
  temp1_label?: string;
  label?: string;
  name?: string;
  temp_label?: string;
  temp1_input?: number;
  input?: number;
  value?: number;
};
/** sensors -j JSON is nested: chip -> tempX -> SensorEntry */
type SensorsJson = Record<string, Record<string, SensorEntry>>;

/* ---------------------------- basics ------------------------------ */

function bytesToGB(bytes: number): number {
  return parseFloat((bytes / 1024 ** 3).toFixed(2));
}

function getCpuUsage(): string[] {
  const cpus = os.cpus();
  return cpus.map((cpu) => {
    const total = Object.values(cpu.times).reduce((a, t) => a + t, 0);
    const usage = 100 - (100 * cpu.times.idle) / total;
    return usage.toFixed(1);
  });
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execAsync(`command -v ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

/* --------------------- temperature detection ---------------------- */

async function getCpuTempViaSensors(): Promise<number | null> {
  if (!(await commandExists("sensors"))) return null;
  try {
    const { stdout } = await execAsync("sensors -j");
    const parsed: unknown = JSON.parse(stdout);

    if (!isRecord(parsed)) return null;
    const data = parsed as SensorsJson;

    let best: number | null = null;

    for (const chip of Object.values(data)) {
      if (!isRecord(chip)) continue;

      const chipObj = chip as Record<string, unknown>;
      for (const [key, val] of Object.entries(chipObj)) {
        if (!/^temp\d+/.test(key)) continue;
        if (!isRecord(val)) continue;

        const entry = val as SensorEntry;
        const labelRaw =
          entry.temp1_label ?? entry.label ?? entry.name ?? entry.temp_label ?? "";
        const label = String(labelRaw).toLowerCase();
        const value = entry.temp1_input ?? entry.input ?? entry.value;

        if (isNumber(value)) {
          if (label.includes("package id 0")) return value; // prefer CPU package
          if (/(package|cpu|tdie|tctl|core)/i.test(label)) best = value;
          else if (best == null) best = value;
        }
      }
    }
    return best;
  } catch {
    return null;
  }
}

async function getCpuTempViaHwmon(): Promise<number | null> {
  const root = "/sys/class/hwmon";
  try {
    const hwmons = await fs.readdir(root);
    let candidate: number | null = null;

    for (const dir of hwmons) {
      const dirPath = path.join(root, dir);
      let files: string[] = [];
      try {
        files = await fs.readdir(dirPath);
      } catch {
        continue;
      }

      for (const f of files.filter((x) => /^temp\d+_input$/.test(x))) {
        const base = f.replace("_input", "");
        const inputPath = path.join(dirPath, f);
        const labelPath = path.join(dirPath, `${base}_label`);

        let label = "";
        try {
          label = (await fs.readFile(labelPath, "utf8")).trim().toLowerCase();
        } catch {
          // ignore
        }

        try {
          const valStr = await fs.readFile(inputPath, "utf8");
          const mdeg = parseInt(valStr.trim(), 10);
          if (!Number.isNaN(mdeg)) {
            const c = mdeg / 1000;
            if (label.includes("package id 0")) return c;
            if (/(package|tctl|tdie|cpu)/i.test(label)) return c;
            if (candidate == null) candidate = c;
          }
        } catch {
          // ignore this sensor
        }
      }
    }
    return candidate;
  } catch {
    return null;
  }
}

async function getCpuTempViaThermalZones(): Promise<number | null> {
  const tzRoot = "/sys/class/thermal";
  try {
    const zones = (await fs.readdir(tzRoot)).filter((d) => d.startsWith("thermal_zone"));
    let preferred: number | null = null;
    let any: number | null = null;

    for (const z of zones) {
      const zPath = path.join(tzRoot, z);
      let type = "";
      try {
        type = (await fs.readFile(path.join(zPath, "type"), "utf8")).trim().toLowerCase();
      } catch {
        // ignore
      }

      try {
        const val = parseInt(await fs.readFile(path.join(zPath, "temp"), "utf8"), 10);
        if (!Number.isNaN(val)) {
          const c = val / 1000;
          if (/pkg|cpu|soc|acpi/.test(type)) preferred = c;
          else if (any == null) any = c;
        }
      } catch {
        // ignore
      }
    }
    return preferred ?? any;
  } catch {
    return null;
  }
}

async function getCpuTemp(): Promise<number> {
  const viaSensors = await getCpuTempViaSensors();
  if (viaSensors != null) return viaSensors;
  const viaHwmon = await getCpuTempViaHwmon();
  if (viaHwmon != null) return viaHwmon;
  const viaTz = await getCpuTempViaThermalZones();
  if (viaTz != null) return viaTz;
  return NaN;
}

/* ----------------------- memory & disk utils ---------------------- */

async function readMeminfo(): Promise<Record<string, number>> {
  const txt = await fs.readFile("/proc/meminfo", "utf8");
  const kv: Record<string, number> = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^(\w+):\s+(\d+)\s+kB/);
    if (m) kv[m[1]] = Number(m[2]) * 1024;
  }
  return kv;
}

async function getRootDisk(): Promise<{ totalGB: number; usedGB: number; freeGB: number } | null> {
  try {
    const { stdout } = await execAsync("df -kP / | tail -1");
    const p = stdout.trim().split(/\s+/);
    const total = Number(p[1]) * 1024;
    const used = Number(p[2]) * 1024;
    const free = Number(p[3]) * 1024;
    return { totalGB: bytesToGB(total), usedGB: bytesToGB(used), freeGB: bytesToGB(free) };
  } catch {
    return null;
  }
}

/* ---------------- users & connections (typed) --------------------- */

function parseWho(lines: string[]): SystemDetails["activeUsers"] {
  const out: SystemDetails["activeUsers"] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const tokens = line.split(/\s+/);
    const user = tokens[0] ?? "?";
    const tty = tokens[1] ?? "?";
    const hostMatch = line.match(/\(([^)]+)\)\s*$/);
    const host = hostMatch ? hostMatch[1] : null;

    // everything after tty minus (host)
    let since = line.replace(/\s+\([^)]+\)\s*$/, "");
    const idx = since.indexOf(tty);
    since = idx >= 0 ? since.slice(idx + tty.length).trim() : since;

    out.push({ user, tty, host, since });
  }
  return out;
}

async function getActiveUsers(): Promise<SystemDetails["activeUsers"]> {
  try {
    const { stdout } = await execAsync("who --ips || who");
    const lines = stdout.split("\n");
    return parseWho(lines);
  } catch {
    return [];
  }
}

function parseSsh(lines: string[]): SystemDetails["sshConnections"] {
  const out: SystemDetails["sshConnections"] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split(/\s+/);
    if (cols.length >= 5) {
      const state = cols[0];
      const local = cols[3];
      const remote = cols[4];
      if (local.includes(":") && remote.includes(":")) {
        out.push({ state, local, remote });
      }
    }
  }
  return out;
}

async function getSshConnections(): Promise<SystemDetails["sshConnections"]> {
  try {
    const { stdout } = await execAsync(
      `ss -H -tn state established '( sport = :ssh )' || ss -H -tn state established sport = :22 || true`
    );
    const lines = stdout.split("\n");
    return parseSsh(lines);
  } catch {
    return [];
  }
}

/* ------------------------------- main ----------------------------- */

export async function getSystemDetails(): Promise<SystemDetails> {
  const cpuUsagePercentPerCore = getCpuUsage();

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const mi = await readMeminfo().catch(() => ({} as Record<string, number>));
  const avail = mi.MemAvailable ?? freeMem;

  const cpuTemp = await getCpuTemp();
  const rootDisk = await getRootDisk();
  const activeUsers = await getActiveUsers();
  const sshConnections = await getSshConnections();

  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptimeSec: os.uptime(),
    loadAvg: os.loadavg(),
    cpuTempC: Number.isNaN(cpuTemp) ? null : cpuTemp,
    cpuUsagePercentPerCore,
    memoryGB: {
      total: bytesToGB(totalMem),
      used: bytesToGB(usedMem),
      free: bytesToGB(freeMem),
    },
    memoryGBNoCache: {
      used: bytesToGB(totalMem - avail),
      available: bytesToGB(avail),
    },
    rootDisk,
    activeUsers,
    sshConnections,
  };
}