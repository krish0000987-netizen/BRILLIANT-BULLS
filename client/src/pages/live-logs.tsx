import { useEffect, useRef, useState } from "react";
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
  const logContainerRef = useRef<HTMLDivElement>(null);

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
        toast({ title: "Test Mode Started", description: "Algorithm running in test mode — no schedule restrictions" });
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

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      setLogs([]);
    },
  });

  useEffect(() => {
    const eventSource = new EventSource("/api/algo/logs/stream");

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
      eventSource.close();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/algo/status"] });
      }, 2000);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
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
    <div className="space-y-4 h-full flex flex-col">
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
          <Button
            size="icon"
            variant="ghost"
            onClick={() => clearLogsMutation.mutate()}
            data-testid="button-clear-logs"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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

      <Card className="flex-1 min-h-0 p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
          <p className="text-xs text-muted-foreground">{logs.length} log entries</p>
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAutoScroll(true);
                  if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                  }
                }}
                data-testid="button-scroll-bottom"
              >
                <ArrowDown className="h-3 w-3 mr-1" />
                Scroll to bottom
              </Button>
            )}
          </div>
        </div>
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="overflow-auto p-3 font-mono text-xs leading-5"
          style={{ height: "calc(100vh - 300px)", minHeight: "400px" }}
          data-testid="container-logs"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No logs yet. Start the algorithm to see output here.</p>
            </div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="flex gap-2 hover-elevate rounded px-1">
                <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {new Date(line.timestamp).toLocaleTimeString()}
                </span>
                <span className={getLevelColor(line.level)}>
                  {line.message}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
        <span>Schedule: Live 8:45 AM | Test 9:30 AM | Stop 3:10 PM | CSV cleanup 3:30 PM (Mon-Fri IST)</span>
        {algoStatus?.startedAt && (
          <span>Started: {new Date(algoStatus.startedAt).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
