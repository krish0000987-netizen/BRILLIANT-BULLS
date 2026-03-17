import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import * as cron from "node-cron";
import { storage } from "./storage";

interface LogLine {
  timestamp: string;
  level: string;
  message: string;
}

type LogListener = (line: LogLine) => void;

const STDLIB_MODULES = new Set([
  "sys","os","re","json","csv","datetime","time","math","random","string","io",
  "abc","collections","functools","itertools","operator","pathlib","shutil",
  "subprocess","threading","multiprocessing","logging","unittest","typing","enum",
  "dataclasses","copy","pickle","struct","socket","ssl","http","urllib","email",
  "html","xml","sqlite3","hashlib","hmac","secrets","base64","binascii","codecs",
  "unicodedata","locale","gettext","argparse","configparser","tempfile","glob",
  "fnmatch","linecache","traceback","inspect","ast","dis","pprint","warnings",
  "contextlib","weakref","gc","signal","errno","ctypes","array","queue","heapq",
  "bisect","decimal","fractions","statistics","cmath","numbers","builtins",
  "platform","stat","uuid","textwrap","difflib","calendar","getopt","cmd","code",
  "codeop","zipfile","tarfile","gzip","bz2","lzma","zlib","importlib","pkgutil",
  "runpy","site","sysconfig","token","tokenize","keyword","asyncio","concurrent",
  "selectors","types","copyreg","shelve","shlex","sched","atexit","pdb","doctest",
  "unittest","tkinter","turtle","idlelib","venv","zoneinfo","tomllib","_thread",
  "faulthandler","tracemalloc","timeit","cProfile","profile","pstats","trace",
  "filecmp","fileinput","tempfile","glob","fnmatch","readline","rlcompleter",
  "netrc","ipaddress","smtplib","ftplib","imaplib","poplib","telnetlib","nntplib",
  "xmlrpc","wsgiref","mimetypes","webbrowser","mailbox","sndhdr","audioop","wave",
  "sunau","aifc","chunk","ossaudiodev","posix","grp","pwd","pty","tty","fcntl",
  "termios","resource","syslog","nis","spwd","crypt","curses",
]);

const IMPORT_MAPPING: Record<string, string> = {
  PIL: "pillow", cv2: "opencv-python", sklearn: "scikit-learn",
  bs4: "beautifulsoup4", yaml: "pyyaml", dotenv: "python-dotenv",
  dateutil: "python-dateutil", Crypto: "pycryptodome", OpenSSL: "pyOpenSSL",
  jwt: "PyJWT", requests_html: "requests-html", telegram: "python-telegram-bot",
  flask: "Flask", django: "Django", fastapi: "fastapi", uvicorn: "uvicorn",
  sqlalchemy: "SQLAlchemy", alembic: "alembic", celery: "celery",
  redis: "redis", pymongo: "pymongo", psycopg2: "psycopg2-binary",
  boto3: "boto3", paramiko: "paramiko", fabric: "fabric", scrapy: "Scrapy",
  selenium: "selenium", playwright: "playwright", aiohttp: "aiohttp",
  httpx: "httpx", arrow: "arrow", pendulum: "pendulum", freezegun: "freezegun",
  tzlocal: "tzlocal", pytz: "pytz", tabulate: "tabulate", rich: "rich",
  click: "click", typer: "typer", pydantic: "pydantic",
  marshmallow: "marshmallow", attrs: "attrs", cattrs: "cattrs",
  dacite: "dacite", orjson: "orjson", ujson: "ujson", simplejson: "simplejson",
  toml: "toml", dotenv_values: "python-dotenv", decouple: "python-decouple",
  dynaconf: "dynaconf", cerberus: "Cerberus", voluptuous: "voluptuous",
  cerberus2: "cerberus", pya3: "pya3", alice_blue: "pya3",
  talib: "TA-Lib", pandas_ta: "pandas_ta", mplfinance: "mplfinance",
  yfinance: "yfinance", nsepy: "nsepy", jugaad_trader: "jugaad-trader",
  kiteconnect: "kiteconnect", fyers_apiv3: "fyers-apiv3",
  breeze_connect: "breeze-connect", smartapi: "smartapi-python",
  NorenRestApiPy: "NorenRestApiPy", py5paisa: "py5paisa",
  upstox_client: "upstox-python-sdk",
};

export function extractImports(code: string): string[] {
  const imports = new Set<string>();
  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    const importMatch = trimmed.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (importMatch) {
      const pkg = importMatch[1].split(".")[0];
      if (!STDLIB_MODULES.has(pkg)) imports.add(IMPORT_MAPPING[pkg] || pkg);
    }
    const fromMatch = trimmed.match(/^from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/);
    if (fromMatch && !trimmed.startsWith("from .") && !trimmed.startsWith("from __")) {
      const pkg = fromMatch[1].split(".")[0];
      if (!STDLIB_MODULES.has(pkg)) imports.add(IMPORT_MAPPING[pkg] || pkg);
    }
  }
  return Array.from(imports);
}

// ─── Per-user AlgoRunner ────────────────────────────────────────────────────

class AlgoRunner {
  private userId: string;
  private process: ChildProcess | null = null;
  private logBuffer: LogLine[] = [];
  private maxBufferSize = 2000;
  private listeners: Set<LogListener> = new Set();
  private _status: "idle" | "running" | "stopping" = "idle";
  private _mode: "live" | "test" = "live";
  private startedAt: Date | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  get status() { return this._status; }
  get isRunning() { return this.process !== null && this._status === "running"; }
  get logs() { return [...this.logBuffer]; }
  get mode() { return this._mode; }

  get runInfo() {
    return {
      status: this._status,
      mode: this._mode,
      isRunning: this.isRunning,
      startedAt: this.startedAt?.toISOString() || null,
      logCount: this.logBuffer.length,
      csvExists: this.csvExists(),
      scriptInfo: algoManager.getScriptInfo(),
      installingDeps: algoManager.installingDeps,
    };
  }

  getUserAlgoDir(): string {
    return path.join(process.cwd(), "server", "algo_users", this.userId);
  }

  csvExists(): boolean {
    return fs.existsSync(path.join(this.getUserAlgoDir(), "config.csv"));
  }

  saveConfig(csvContent: string): void {
    const dir = this.getUserAlgoDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "config.csv"), csvContent, "utf-8");
    this.addLog("info", "CSV config saved successfully");
  }

  deleteConfig(): void {
    const p = path.join(this.getUserAlgoDir(), "config.csv");
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      this.addLog("info", "CSV config deleted");
    }
  }

  private getISTTimestamp(): string {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utcMs + 5.5 * 3600000);
    const y = ist.getFullYear();
    const mo = String(ist.getMonth() + 1).padStart(2, "0");
    const d = String(ist.getDate()).padStart(2, "0");
    const h = String(ist.getHours()).padStart(2, "0");
    const mi = String(ist.getMinutes()).padStart(2, "0");
    const s = String(ist.getSeconds()).padStart(2, "0");
    return `${y}-${mo}-${d}T${h}:${mi}:${s}+05:30`;
  }

  addLog(level: string, message: string) {
    const line: LogLine = { timestamp: this.getISTTimestamp(), level, message };
    this.logBuffer.push(line);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
    this.listeners.forEach((l) => { try { l(line); } catch {} });
    storage.createAlgoLog({ level, message }).catch(() => {});
  }

  addListener(fn: LogListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  startTest(): { success: boolean; message: string } {
    this._mode = "test";
    this.addLog("info", "[TEST MODE] Starting algorithm in test mode — schedule rules bypassed");
    return this.start();
  }

  start(asLive = false): { success: boolean; message: string } {
    if (asLive) this._mode = "live";
    if (this.isRunning) return { success: false, message: "Algorithm is already running" };
    if (!this.csvExists()) return { success: false, message: "No CSV config uploaded. Please upload your config first." };

    const sharedScript = algoManager.getSharedScriptPath();
    if (!sharedScript) {
      return { success: false, message: "No algorithm script found. Admin must upload a Python script first." };
    }

    const userDir = this.getUserAlgoDir();
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    // Copy latest shared script into user's isolated directory
    const scriptName = path.basename(sharedScript);
    const userScriptPath = path.join(userDir, scriptName);
    fs.copyFileSync(sharedScript, userScriptPath);

    const algoConfigPath = path.join(userDir, "config.csv");

    this.logBuffer = [];
    const modeLabel = this._mode === "test" ? "[TEST MODE] " : "";
    this.addLog("info", `${modeLabel}Starting algorithm: ${scriptName}`);
    this.addLog("info", `Config: ${algoConfigPath}`);
    this._status = "running";
    this.startedAt = new Date();

    // IST bootstrap wrapper
    const tzBootstrap = [
      "import os,time,logging,runpy",
      "os.environ['TZ']='Asia/Kolkata'",
      "time.tzset()",
      "def _fmt(self,record,datefmt=None):",
      "  ct=time.localtime(record.created)",
      "  if datefmt: return time.strftime(datefmt,ct)",
      "  t=time.strftime(self.default_time_format,ct)",
      "  return self.default_msec_format%(t,record.msecs)",
      "logging.Formatter.formatTime=_fmt",
      `runpy.run_path(r'${scriptName}',run_name='__main__')`,
    ].join("\n");

    fs.writeFileSync(path.join(userDir, "_ist_runner.py"), tzBootstrap, "utf-8");

    try {
      this.process = spawn("python3", ["-u", "_ist_runner.py"], {
        cwd: userDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
          TZ: "Asia/Kolkata",
          ALGO_CONFIG_PATH: algoConfigPath,
          CONFIG_FILE: algoConfigPath,
          CONFIG_PATH: algoConfigPath,
          ALGO_CONFIG_FILE: "config.csv",
          ALGO_CONFIG_DIR: userDir,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        for (const line of data.toString("utf-8").split("\n")) {
          const trimmed = line.trim();
          if (trimmed) this.addLog("stdout", trimmed);
        }
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        for (const line of data.toString("utf-8").split("\n")) {
          const trimmed = line.trim();
          if (trimmed) this.addLog("stderr", trimmed);
        }
      });

      this.process.on("close", (code) => {
        const modeStr = this._mode === "test" ? " [TEST MODE]" : "";
        this.addLog("info", `Algorithm process exited with code ${code}${modeStr}`);
        this.process = null;
        this._status = "idle";
      });

      this.process.on("error", (err) => {
        this.addLog("error", `Process error: ${err.message}`);
        this.process = null;
        this._status = "idle";
      });

      return { success: true, message: "Algorithm started successfully" };
    } catch (err: any) {
      this.addLog("error", `Failed to start: ${err.message}`);
      this._status = "idle";
      return { success: false, message: `Failed to start: ${err.message}` };
    }
  }

  stop(): { success: boolean; message: string } {
    if (!this.process) {
      this._status = "idle";
      return { success: false, message: "Algorithm is not running" };
    }
    this._status = "stopping";
    this.addLog("info", "Stopping algorithm...");
    try {
      this.process.kill("SIGINT");
      setTimeout(() => {
        if (this.process) {
          this.addLog("info", "Force killing algorithm...");
          this.process.kill("SIGKILL");
        }
      }, 5000);
      return { success: true, message: "Stop signal sent" };
    } catch (err: any) {
      return { success: false, message: `Failed to stop: ${err.message}` };
    }
  }
}

// ─── AlgoManager — manages all per-user runners + shared script ──────────────

class AlgoManager {
  private runners = new Map<string, AlgoRunner>();
  private schedulerInitialized = false;
  installingDeps = false;

  getRunner(userId: string): AlgoRunner {
    if (!this.runners.has(userId)) {
      this.runners.set(userId, new AlgoRunner(userId));
    }
    return this.runners.get(userId)!;
  }

  getAllRunnersInfo(): { userId: string; info: ReturnType<AlgoRunner["runInfo"]> }[] {
    return Array.from(this.runners.entries()).map(([userId, runner]) => ({
      userId,
      info: runner.runInfo,
    }));
  }

  getSharedScriptDir(): string {
    return path.join(process.cwd(), "server", "algo");
  }

  getSharedScriptPath(): string | null {
    const dir = this.getSharedScriptDir();
    const userAlgo = path.join(dir, "user_algo.py");
    if (fs.existsSync(userAlgo)) return userAlgo;
    const fallback = path.join(dir, "alice_blue_trail_enhanced.py");
    if (fs.existsSync(fallback)) return fallback;
    return null;
  }

  getScriptInfo(): { hasUserScript: boolean; scriptName: string; size: number; imports: string[] } {
    const p = this.getSharedScriptPath();
    if (!p) return { hasUserScript: false, scriptName: "none", size: 0, imports: [] };
    const stats = fs.statSync(p);
    const code = fs.readFileSync(p, "utf-8");
    const isUser = path.basename(p) === "user_algo.py";
    return { hasUserScript: isUser, scriptName: path.basename(p), size: stats.size, imports: extractImports(code) };
  }

  saveScript(code: string): void {
    const dir = this.getSharedScriptDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const header = `# ============================================================\n# IST Timezone is automatically applied via TZ=Asia/Kolkata\n# All datetime.now() calls will return Indian Standard Time\n# ============================================================\n\n`;
    fs.writeFileSync(path.join(dir, "user_algo.py"), header + code, "utf-8");
  }

  getScriptContent(): string | null {
    const p = this.getSharedScriptPath();
    return p ? fs.readFileSync(p, "utf-8") : null;
  }

  deleteScript(): void {
    const p = path.join(this.getSharedScriptDir(), "user_algo.py");
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  async installDependencies(): Promise<{ success: boolean; installed: string[]; failed: string[]; skipped: string[] }> {
    const info = this.getScriptInfo();
    const packages = info.imports;
    if (packages.length === 0) return { success: true, installed: [], failed: [], skipped: [] };

    this.installingDeps = true;
    const installed: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    for (const pkg of packages) {
      const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
        const proc = spawn("python3", ["-m", "pip", "install", "-q", pkg], {
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        proc.stdout?.on("data", (d: Buffer) => { output += d.toString(); });
        proc.stderr?.on("data", (d: Buffer) => { output += d.toString(); });
        proc.on("close", (code) => resolve({ success: code === 0, output: output.trim() }));
        proc.on("error", (err) => resolve({ success: false, output: err.message }));
      });

      if (result.success) {
        if (result.output.includes("already satisfied")) skipped.push(pkg);
        else installed.push(pkg);
      } else {
        failed.push(pkg);
      }
    }

    this.installingDeps = false;
    return { success: failed.length === 0, installed, failed, skipped };
  }

  setupScheduledJobs() {
    if (this.schedulerInitialized) return;
    this.schedulerInitialized = true;

    // Auto-start all users with valid CSV at 8:45 AM IST (live mode)
    cron.schedule("45 8 * * 1-5", () => {
      for (const [, runner] of this.runners) {
        if (runner.csvExists() && !runner.isRunning) runner.start(true);
      }
    }, { timezone: "Asia/Kolkata" });

    // Auto-stop all at 3:30 PM IST
    cron.schedule("30 15 * * 1-5", () => {
      for (const [, runner] of this.runners) {
        if (runner.isRunning) runner.stop();
      }
    }, { timezone: "Asia/Kolkata" });
  }
}

export const algoManager = new AlgoManager();

// Legacy export for any remaining references
export const algoRunner = {
  get runInfo() { return algoManager.getRunner("admin").runInfo; },
  get logs() { return algoManager.getRunner("admin").logs; },
  addListener: (fn: LogListener) => algoManager.getRunner("admin").addListener(fn),
  start: (asLive?: boolean) => algoManager.getRunner("admin").start(asLive),
  startTest: () => algoManager.getRunner("admin").startTest(),
  stop: () => algoManager.getRunner("admin").stop(),
  csvExists: () => algoManager.getRunner("admin").csvExists(),
  saveConfig: (csv: string) => algoManager.getRunner("admin").saveConfig(csv),
  deleteConfig: () => algoManager.getRunner("admin").deleteConfig(),
  getUserAlgoDir: () => algoManager.getRunner("admin").getUserAlgoDir(),
  getScriptInfo: () => algoManager.getScriptInfo(),
  saveScript: (code: string) => algoManager.saveScript(code),
  deleteUserScript: () => algoManager.deleteScript(),
  installDependencies: () => algoManager.installDependencies(),
  setupScheduledJobs: () => algoManager.setupScheduledJobs(),
};
