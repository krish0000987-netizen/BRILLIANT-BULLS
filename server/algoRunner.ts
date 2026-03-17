import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
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
  PIL: "pillow",
  cv2: "opencv-python",
  sklearn: "scikit-learn",
  bs4: "beautifulsoup4",
  yaml: "pyyaml",
  dotenv: "python-dotenv",
  dateutil: "python-dateutil",
  Crypto: "pycryptodome",
  OpenSSL: "pyOpenSSL",
  jwt: "PyJWT",
  requests_html: "requests-html",
  telegram: "python-telegram-bot",
  flask: "Flask",
  django: "Django",
  fastapi: "fastapi",
  uvicorn: "uvicorn",
  sqlalchemy: "SQLAlchemy",
  alembic: "alembic",
  celery: "celery",
  redis: "redis",
  pymongo: "pymongo",
  psycopg2: "psycopg2-binary",
  boto3: "boto3",
  paramiko: "paramiko",
  fabric: "fabric",
  scrapy: "Scrapy",
  selenium: "selenium",
  playwright: "playwright",
  aiohttp: "aiohttp",
  httpx: "httpx",
  arrow: "arrow",
  pendulum: "pendulum",
  freezegun: "freezegun",
  tzlocal: "tzlocal",
  pytz: "pytz",
  tabulate: "tabulate",
  rich: "rich",
  click: "click",
  typer: "typer",
  pydantic: "pydantic",
  marshmallow: "marshmallow",
  cerberus: "Cerberus",
  attrs: "attrs",
  attr: "attrs",
  tqdm: "tqdm",
  loguru: "loguru",
  structlog: "structlog",
  colorama: "colorama",
  termcolor: "termcolor",
  prettytable: "prettytable",
  xlrd: "xlrd",
  xlwt: "xlwt",
  openpyxl: "openpyxl",
  xlsxwriter: "XlsxWriter",
  pandas: "pandas",
  numpy: "numpy",
  scipy: "scipy",
  matplotlib: "matplotlib",
  seaborn: "seaborn",
  plotly: "plotly",
  bokeh: "bokeh",
  dash: "dash",
  streamlit: "streamlit",
  torch: "torch",
  tensorflow: "tensorflow",
  keras: "keras",
  transformers: "transformers",
  nltk: "nltk",
  spacy: "spacy",
  gensim: "gensim",
  fitz: "PyMuPDF",
  docx: "python-docx",
  pptx: "python-pptx",
  qrcode: "qrcode",
  barcode: "python-barcode",
  reportlab: "reportlab",
  paramiko: "paramiko",
  AliceBlue: "pya3",
  alice_blue: "pya3",
  pya3: "pya3",
};

export function extractImports(code: string): string[] {
  const imports = new Set<string>();
  const lines = code.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const importMatch = trimmed.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/);
    if (importMatch) {
      const pkg = importMatch[1].split(".")[0];
      if (!STDLIB_MODULES.has(pkg)) {
        imports.add(IMPORT_MAPPING[pkg] || pkg);
      }
    }
    const fromMatch = trimmed.match(/^from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/);
    if (fromMatch && !trimmed.startsWith("from .") && !trimmed.startsWith("from __")) {
      const pkg = fromMatch[1].split(".")[0];
      if (!STDLIB_MODULES.has(pkg)) {
        imports.add(IMPORT_MAPPING[pkg] || pkg);
      }
    }
  }
  return Array.from(imports);
}

class AlgoRunner {
  private process: ChildProcess | null = null;
  private logBuffer: LogLine[] = [];
  private maxBufferSize = 2000;
  private listeners: Set<LogListener> = new Set();
  private _status: "idle" | "running" | "stopping" | "scheduled" = "idle";
  private _mode: "live" | "test" = "live";
  private startedAt: Date | null = null;
  private cronJobs: any[] = [];
  private scheduledJobsInitialized = false;
  private _installingDeps = false;

  get status() { return this._status; }
  get isRunning() { return this.process !== null && this._status === "running"; }
  get logs() { return [...this.logBuffer]; }
  get mode() { return this._mode; }
  get installingDeps() { return this._installingDeps; }

  get runInfo() {
    return {
      status: this._status,
      mode: this._mode,
      isRunning: this.isRunning,
      startedAt: this.startedAt?.toISOString() || null,
      logCount: this.logBuffer.length,
      csvExists: this.csvExists(),
      scriptInfo: this.getScriptInfo(),
      installingDeps: this._installingDeps,
    };
  }

  private getConfigDir(): string {
    return path.join(os.homedir(), ".aliceblue_orb_simple");
  }

  private getConfigPath(): string {
    return path.join(this.getConfigDir(), "config.csv");
  }

  getUserAlgoDir(): string {
    return path.join(process.cwd(), "server", "algo");
  }

  getUserAlgoPath(): string {
    return path.join(this.getUserAlgoDir(), "user_algo.py");
  }

  private getAlgoPath(): string {
    const userAlgo = this.getUserAlgoPath();
    if (fs.existsSync(userAlgo)) return userAlgo;
    return path.join(this.getUserAlgoDir(), "alice_blue_trail_enhanced.py");
  }

  getScriptInfo(): { hasUserScript: boolean; scriptName: string; size: number; imports: string[] } {
    const userAlgoPath = this.getUserAlgoPath();
    if (fs.existsSync(userAlgoPath)) {
      const stats = fs.statSync(userAlgoPath);
      const code = fs.readFileSync(userAlgoPath, "utf-8");
      return { hasUserScript: true, scriptName: "user_algo.py", size: stats.size, imports: extractImports(code) };
    }
    const defaultPath = path.join(this.getUserAlgoDir(), "alice_blue_trail_enhanced.py");
    if (fs.existsSync(defaultPath)) {
      const stats = fs.statSync(defaultPath);
      const code = fs.readFileSync(defaultPath, "utf-8");
      return { hasUserScript: false, scriptName: "alice_blue_trail_enhanced.py", size: stats.size, imports: extractImports(code) };
    }
    return { hasUserScript: false, scriptName: "none", size: 0, imports: [] };
  }

  saveScript(code: string): void {
    const dir = this.getUserAlgoDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const header = `# ============================================================\n# IST Timezone is automatically applied via TZ=Asia/Kolkata\n# All datetime.now() calls will return Indian Standard Time\n# ============================================================\n\n`;
    fs.writeFileSync(this.getUserAlgoPath(), header + code, "utf-8");
    this.addLog("info", "User algorithm script saved successfully");
  }

  deleteUserScript(): void {
    const p = this.getUserAlgoPath();
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      this.addLog("info", "User algorithm script deleted");
    }
  }

  async installDependencies(): Promise<{ success: boolean; installed: string[]; failed: string[]; skipped: string[] }> {
    const info = this.getScriptInfo();
    const packages = info.imports;

    if (packages.length === 0) {
      return { success: true, installed: [], failed: [], skipped: [] };
    }

    this._installingDeps = true;
    this.addLog("info", `[DEPS] Installing ${packages.length} detected package(s): ${packages.join(", ")}`);

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
        if (result.output.includes("already satisfied")) {
          this.addLog("info", `[DEPS] ✓ ${pkg} already installed`);
          skipped.push(pkg);
        } else {
          this.addLog("info", `[DEPS] ✓ Installed ${pkg}`);
          installed.push(pkg);
        }
      } else {
        this.addLog("error", `[DEPS] ✗ Failed to install ${pkg}: ${result.output.slice(0, 100)}`);
        failed.push(pkg);
      }
    }

    this._installingDeps = false;
    this.addLog("info", `[DEPS] Done. Installed: ${installed.length}, Already had: ${skipped.length}, Failed: ${failed.length}`);
    return { success: failed.length === 0, installed, failed, skipped };
  }

  csvExists(): boolean {
    return (
      fs.existsSync(this.getConfigPath()) ||
      fs.existsSync(path.join(this.getUserAlgoDir(), "config.csv"))
    );
  }

  saveConfig(csvContent: string): void {
    // Save to the hidden config dir (legacy)
    const dir = this.getConfigDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.getConfigPath(), csvContent, "utf-8");

    // Also save to algo directory so the script can read it as config.csv
    const algoDir = this.getUserAlgoDir();
    if (!fs.existsSync(algoDir)) fs.mkdirSync(algoDir, { recursive: true });
    fs.writeFileSync(path.join(algoDir, "config.csv"), csvContent, "utf-8");

    this.addLog("info", `CSV config saved to disk (${this.getConfigPath()}, ${path.join(algoDir, "config.csv")})`);
  }

  deleteConfig(): void {
    const configPath = this.getConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      this.addLog("info", "CSV config deleted from disk");
    }
    // Also delete the copy in algo directory
    const algoConfigPath = path.join(this.getUserAlgoDir(), "config.csv");
    if (fs.existsSync(algoConfigPath)) {
      fs.unlinkSync(algoConfigPath);
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

  private addLog(level: string, message: string) {
    const line: LogLine = { timestamp: this.getISTTimestamp(), level, message };
    this.logBuffer.push(line);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
    this.listeners.forEach((listener) => { try { listener(line); } catch {} });
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

    const algoPath = this.getAlgoPath();
    if (!fs.existsSync(algoPath)) return { success: false, message: "Algorithm file not found. Please upload your Python script first." };

    this.logBuffer = [];
    const modeLabel = this._mode === "test" ? "[TEST MODE] " : "";
    this.addLog("info", `${modeLabel}Starting algorithm: ${path.basename(algoPath)}`);
    this.addLog("info", `Using config: ${path.join(this.getUserAlgoDir(), "config.csv")}`);
    this._status = "running";
    this.startedAt = new Date();

    const configPath = this.getConfigPath();
    const algoConfigPath = path.join(this.getUserAlgoDir(), "config.csv");
    const algoDir = this.getUserAlgoDir();

    // Ensure algo directory exists
    if (!fs.existsSync(algoDir)) fs.mkdirSync(algoDir, { recursive: true });

    // Sync config: copy from legacy path → algo dir, or vice versa
    if (fs.existsSync(configPath) && !fs.existsSync(algoConfigPath)) {
      fs.writeFileSync(algoConfigPath, fs.readFileSync(configPath, "utf-8"), "utf-8");
      this.addLog("info", "Config synced from hidden dir → algo dir");
    } else if (!fs.existsSync(configPath) && fs.existsSync(algoConfigPath)) {
      const legacyDir = this.getConfigDir();
      if (!fs.existsSync(legacyDir)) fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(configPath, fs.readFileSync(algoConfigPath, "utf-8"), "utf-8");
      this.addLog("info", "Config synced from algo dir → hidden dir");
    }

    this.addLog("info", `Config file at: ${algoConfigPath} (exists: ${fs.existsSync(algoConfigPath)})`);

    const scriptName = path.basename(algoPath);

    try {
      // IST bootstrap:
      //   1. Set TZ env + tzset() so C-level time is IST
      //   2. Monkey-patch logging.Formatter.formatTime to always use
      //      time.localtime (IST) — overrides any script that does
      //      Formatter.converter = time.gmtime internally
      //   3. runpy.run_path() sets __file__/__name__ correctly (no NameError)
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

      const wrapperPath = path.join(this.getUserAlgoDir(), "_ist_runner.py");
      fs.writeFileSync(wrapperPath, tzBootstrap, "utf-8");

      this.process = spawn("python3", ["-u", "_ist_runner.py"], {
        cwd: this.getUserAlgoDir(), // run script from its own directory
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
          TZ: "Asia/Kolkata",
          ALGO_CONFIG_PATH: algoConfigPath,
          CONFIG_FILE: algoConfigPath,
          CONFIG_PATH: algoConfigPath,
          ALGO_CONFIG_FILE: "config.csv",
          ALGO_CONFIG_DIR: this.getUserAlgoDir(),
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

  setupScheduledJobs() {
    if (this.scheduledJobsInitialized) return;
    this.scheduledJobsInitialized = true;
    for (const job of this.cronJobs) job.stop();
    this.cronJobs = [];

    const startJob = cron.schedule("45 8 * * 1-5", () => {
      this.addLog("info", "[SCHEDULER] Auto-starting algorithm at 8:45 AM IST (Live Mode)");
      if (this.csvExists()) this.start(true);
      else this.addLog("warning", "[SCHEDULER] No CSV config found, skipping auto-start");
    }, { timezone: "Asia/Kolkata" });

    const testStartJob = cron.schedule("30 9 * * 1-5", () => {
      this.addLog("info", "[SCHEDULER] Auto-starting algorithm at 9:30 AM IST (Test Mode)");
      if (this.csvExists()) this.startTest();
      else this.addLog("warning", "[SCHEDULER] No CSV config found, skipping test mode auto-start");
    }, { timezone: "Asia/Kolkata" });

    const stopJob = cron.schedule("30 15 * * 1-5", () => {
      this.addLog("info", "[SCHEDULER] Auto-stopping algorithm at 3:30 PM IST");
      this.stop();
    }, { timezone: "Asia/Kolkata" });

    // CSV config is kept until manually deleted by the user via the UI
    this.cronJobs.push(startJob, testStartJob, stopJob);
    this.addLog("info", "Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)");
  }
}

export const algoRunner = new AlgoRunner();
