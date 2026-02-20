import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Trash2, ArrowDown, FlaskConical, FileX } from "lucide-react";

interface LogLine {
  timestamp: string;
  level: string;
  message: string;
}

interface AlgoStatus {
  status: string;
  mode: "live" | "test";
  isRunning: boolean;
  startedAt: string | null;
  logCount: number;
  csvExists: boolean;
}

export default function LiveLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: algoStatus, refetch: refetchStatus } = useQuery<AlgoStatus>({
    queryKey: ["/api/algo/status"],
    refetchInterval: 3000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/algo/start");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setLogs([]);
        toast({ title: "Algorithm Started", description: data.message });
      } else {
        toast({ title: "Could Not Start", description: data.message, variant: "destructive" });
      }
      refetchStatus();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/algo/start-test");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setLogs([]);
        toast({ title: "Test Mode Started", description: "Algorithm running in test mode" });
      } else {
        toast({ title: "Could Not Start", description: data.message, variant: "destructive" });
      }
      refetchStatus();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/algo/stop");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Algorithm Stopped" });
      refetchStatus();
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/algo/config", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/algo/status"] });
      toast({ title: "Config Deleted", description: "CSV configuration has been removed." });
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast({ title: "Delete Failed", description: "Could not delete the config file.", variant: "destructive" });
    },
  });

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;
    let isReconnect = false;

    function connect() {
      if (destroyed) return;

      if (isReconnect) {
        setLogs([]);
      }

      eventSource = new EventSource("/api/algo/logs/stream", { withCredentials: true });

      eventSource.onopen = () => {
        setSseConnected(true);
        isReconnect = true;
      };

      eventSource.onmessage = (event) => {
        try {
          const line: LogLine = JSON.parse(event.data);
          setLogs((prev) => {
            const next = [...prev, line];
            if (next.length > 2000) return next.slice(-2000);
            return next;
          });
        } catch {}
      };

      eventSource.onerror = () => {
        setSseConnected(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [logs, autoScroll, scrollToBottom]);

  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setAutoScroll(distanceFromBottom < 80);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
      case "stderr":
        return "text-red-400";
      case "warning":
        return "text-amber-400";
      case "info":
        return "text-blue-400";
      default:
        return "text-foreground";
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "stderr":
        return "ERR";
      case "stdout":
        return "OUT";
      case "info":
        return "INF";
      case "error":
        return "ERR";
      case "warning":
        return "WRN";
      default:
        return level.toUpperCase().slice(0, 3);
    }
  };

  const isTestMode = algoStatus?.mode === "test";
  const statusColor = algoStatus?.isRunning
    ? isTestMode
      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
      : "bg-green-500/10 text-green-600 dark:text-green-400"
    : "bg-muted text-muted-foreground";

  const statusLabel = algoStatus?.isRunning
    ? isTestMode
      ? "Test Running"
      : "Running"
    : algoStatus?.status === "stopping"
      ? "Stopping..."
      : "Idle";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-live-logs-title">
              Live Algorithm Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your trading algorithm in real-time
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={`text-xs ${statusColor}`} data-testid="badge-algo-status">
              {statusLabel}
            </Badge>
            {!sseConnected && (
              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Reconnecting...
              </Badge>
            )}
            {!algoStatus?.isRunning ? (
              <>
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || startTestMutation.isPending || !algoStatus?.csvExists}
                  data-testid="button-start-algo"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startMutation.isPending ? "Starting..." : "Start Live"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => startTestMutation.mutate()}
                  disabled={startMutation.isPending || startTestMutation.isPending || !algoStatus?.csvExists}
                  data-testid="button-start-test"
                >
                  <FlaskConical className="h-4 w-4 mr-2" />
                  {startTestMutation.isPending ? "Starting..." : "Test Mode"}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                data-testid="button-stop-algo"
              >
                <Square className="h-4 w-4 mr-2" />
                {stopMutation.isPending ? "Stopping..." : "Stop"}
              </Button>
            )}
          </div>
        </div>

        {!algoStatus?.csvExists && (
          <Card className="p-3 border-amber-500/30 bg-amber-500/5">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No CSV config uploaded. Please go to the CSV Upload tab to upload your trading configuration before starting.
            </p>
          </Card>
        )}

        {algoStatus?.csvExists && (
          <Card className="p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                  CSV Config Active
                </Badge>
                <span className="text-xs text-muted-foreground">Auto-deletes at 3:30 PM IST</span>
              </div>
              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={algoStatus?.isRunning}
                  data-testid="button-delete-config-logs"
                >
                  <FileX className="h-3.5 w-3.5 mr-1" />
                  Delete Config
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive font-medium">Delete CSV config?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteConfigMutation.mutate()}
                    disabled={deleteConfigMutation.isPending}
                    data-testid="button-confirm-delete-config"
                  >
                    {deleteConfigMutation.isPending ? "Deleting..." : "Yes, Delete"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    data-testid="button-cancel-delete-config"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b flex-shrink-0">
          <p className="text-xs text-muted-foreground">{logs.length} log entries</p>
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAutoScroll(true);
                  scrollToBottom();
                }}
                data-testid="button-scroll-bottom"
              >
                <ArrowDown className="h-3 w-3 mr-1" />
                Scroll to bottom
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLogs([])}
              data-testid="button-clear-logs"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed bg-black/5 dark:bg-black/30"
          data-testid="container-logs"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No logs yet. Start the algorithm to see output here.</p>
            </div>
          ) : (
            <>
              {logs.map((line, i) => (
                <div key={i} className="flex gap-2 py-px">
                  <span className="text-muted-foreground whitespace-nowrap flex-shrink-0 select-none tabular-nums">
                    {new Date(line.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                  </span>
                  <span className={`whitespace-nowrap flex-shrink-0 font-semibold w-8 text-center select-none ${getLevelColor(line.level)}`}>
                    {getLevelLabel(line.level)}
                  </span>
                  <span className={`${getLevelColor(line.level)} break-all whitespace-pre-wrap`}>
                    {line.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </>
          )}
        </div>
      </Card>

      <div className="flex-shrink-0 pt-2 text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
        <span>Schedule: Live 8:45 AM | Test 9:30 AM | Stop 3:10 PM | CSV cleanup 3:30 PM (Mon-Fri IST)</span>
        {algoStatus?.startedAt && (
          <span>Started: {new Date(algoStatus.startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })} IST</span>
        )}
      </div>
    </div>
  );
}
