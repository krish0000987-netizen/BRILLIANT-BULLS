import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import * as cron from "node-cron";

interface LogLine {
  timestamp: string;
  level: string;
  message: string;
}

type LogListener = (line: LogLine) => void;

class AlgoRunner {
  private process: ChildProcess | null = null;
  private logBuffer: LogLine[] = [];
  private maxBufferSize = 2000;
  private listeners: Set<LogListener> = new Set();
  private _status: "idle" | "running" | "stopping" | "scheduled" = "idle";
  private startedAt: Date | null = null;
  private cronJobs: any[] = [];
  private scheduledJobsInitialized = false;

  get status() {
    return this._status;
  }

  get isRunning() {
    return this.process !== null && this._status === "running";
  }

  get logs() {
    return [...this.logBuffer];
  }

  get runInfo() {
    return {
      status: this._status,
      isRunning: this.isRunning,
      startedAt: this.startedAt?.toISOString() || null,
      logCount: this.logBuffer.length,
      csvExists: this.csvExists(),
    };
  }

  private getConfigDir(): string {
    return path.join(os.homedir(), ".aliceblue_orb_simple");
  }

  private getConfigPath(): string {
    return path.join(this.getConfigDir(), "config.csv");
  }

  private getAlgoPath(): string {
    return path.join(process.cwd(), "server", "algo", "alice_blue_trail_enhanced.py");
  }

  csvExists(): boolean {
    return fs.existsSync(this.getConfigPath());
  }

  saveConfig(csvContent: string): void {
    const dir = this.getConfigDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.getConfigPath(), csvContent, "utf-8");
    this.addLog("info", "CSV config saved to disk");
  }

  deleteConfig(): void {
    const configPath = this.getConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      this.addLog("info", "CSV config deleted from disk");
    }
  }

  private addLog(level: string, message: string) {
    const line: LogLine = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    this.logBuffer.push(line);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
    this.listeners.forEach((listener) => {
      try {
        listener(line);
      } catch {}
    });
  }

  addListener(fn: LogListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): { success: boolean; message: string } {
    if (this.isRunning) {
      return { success: false, message: "Algorithm is already running" };
    }

    if (!this.csvExists()) {
      return { success: false, message: "No CSV config uploaded. Please upload your config first." };
    }

    const algoPath = this.getAlgoPath();
    if (!fs.existsSync(algoPath)) {
      return { success: false, message: "Algorithm file not found on server" };
    }

    this.logBuffer = [];
    this.addLog("info", "Starting algorithm...");
    this._status = "running";
    this.startedAt = new Date();

    try {
      this.process = spawn("python3", ["-u", algoPath], {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        const text = data.toString("utf-8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (trimmed) {
            this.addLog("stdout", trimmed);
          }
        }
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf-8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (trimmed) {
            this.addLog("stderr", trimmed);
          }
        }
      });

      this.process.on("close", (code) => {
        this.addLog("info", `Algorithm process exited with code ${code}`);
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

    for (const job of this.cronJobs) {
      job.stop();
    }
    this.cronJobs = [];

    const startJob = cron.schedule("45 8 * * 1-5", () => {
      this.addLog("info", "[SCHEDULER] Auto-starting algorithm at 8:45 AM IST");
      if (this.csvExists()) {
        this.start();
      } else {
        this.addLog("warning", "[SCHEDULER] No CSV config found, skipping auto-start");
      }
    }, { timezone: "Asia/Kolkata" });

    const stopJob = cron.schedule("10 15 * * 1-5", () => {
      this.addLog("info", "[SCHEDULER] Auto-stopping algorithm at 3:10 PM IST");
      this.stop();
    }, { timezone: "Asia/Kolkata" });

    const deleteJob = cron.schedule("30 15 * * 1-5", () => {
      this.addLog("info", "[SCHEDULER] Auto-deleting CSV config at 3:30 PM IST");
      this.deleteConfig();
    }, { timezone: "Asia/Kolkata" });

    this.cronJobs.push(startJob, stopJob, deleteJob);
    this.addLog("info", "Scheduled jobs configured: Start 8:45 AM, Stop 3:10 PM, CSV Delete 3:30 PM (Mon-Fri IST)");
  }
}

export const algoRunner = new AlgoRunner();
