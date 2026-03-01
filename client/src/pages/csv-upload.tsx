import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Upload, FileSpreadsheet, Trash2, CheckCircle, AlertTriangle, Info } from "lucide-react";

interface AlgoStatus {
  status: string;
  isRunning: boolean;
  startedAt: string | null;
  logCount: number;
  csvExists: boolean;
  tradingHoursActive: boolean;
  tradingHoursMessage: string;
  currentIST: string;
}

const EXPECTED_COLUMNS = [
  "user_id",
  "api_key",
  "bullish_stocks",
  "bearish_stocks",
  "capital",
  "risk_per_trade",
  "max_daily_trades",
  "paper_trading",
  "test_mode",
  "orb_range_filter",
  "min_range_pct",
  "max_range_pct",
];

export default function CsvUploadPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; data: string[] } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: algoStatus } = useQuery<AlgoStatus>({
    queryKey: ["/api/algo/status"],
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/algo/upload-config", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/algo/status"] });
      toast({ title: "Config Uploaded", description: "Your CSV configuration has been saved and is ready for the algorithm." });
      setSelectedFile(null);
      setCsvPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: any) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
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
      toast({ title: "Config Deleted", description: "CSV configuration removed." });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid File", description: "Please upload a .csv file", variant: "destructive" });
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.trim().split("\n");
      if (lines.length >= 2) {
        setCsvPreview({
          headers: lines[0].split(",").map((h) => h.trim()),
          data: lines[1].split(",").map((d) => d.trim()),
        });
      }
    };
    reader.readAsText(file);
  };

  const missingColumns = csvPreview
    ? EXPECTED_COLUMNS.filter((col) => !csvPreview.headers.includes(col))
    : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-csv-upload-title">
          CSV Configuration Upload
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your Alice Blue broker configuration (Columns A to M, Rows 1-2)
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Required CSV Format</h3>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Your CSV must have these columns (A to M) with a header row and one data row:</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {EXPECTED_COLUMNS.map((col) => (
              <Badge key={col} variant="secondary" className="text-xs">
                {col}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Upload Config</h3>
          </div>
          {algoStatus?.csvExists && (
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Config Active
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-csv-file"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={algoStatus?.isRunning}
              data-testid="button-select-csv"
            >
              <Upload className="h-4 w-4 mr-2" />
              Select CSV File
            </Button>
            {selectedFile && (
              <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
            )}
          </div>

          {algoStatus?.isRunning && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Cannot upload while algorithm is running. Stop it first.
            </p>
          )}
        </div>

        {csvPreview && (
          <div className="space-y-3">
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {csvPreview.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {csvPreview.data.map((d, i) => (
                      <td key={i} className="px-2 py-1.5 whitespace-nowrap">
                        {csvPreview.headers[i] === "api_key"
                          ? d.slice(0, 4) + "****"
                          : d.length > 30
                            ? d.slice(0, 30) + "..."
                            : d}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {missingColumns.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  <p className="font-medium">Missing columns:</p>
                  <p>{missingColumns.join(", ")}</p>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
              disabled={uploadMutation.isPending || !selectedFile}
              data-testid="button-upload-csv"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Configuration"}
            </Button>
          </div>
        )}
      </Card>

      {algoStatus?.csvExists && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-medium">Active Configuration</p>
              <p className="text-xs text-muted-foreground">
                Configuration is saved and ready for the algorithm. It will be auto-deleted at 3:30 PM IST.
              </p>
            </div>
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={algoStatus?.isRunning}
                data-testid="button-delete-config"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Config
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">Are you sure?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteMutation.mutate();
                    setShowDeleteConfirm(false);
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-medium">Schedule Info (Mon-Fri IST):</p>
            {algoStatus?.currentIST && (
              <Badge variant="outline" className="text-xs">🕐 {algoStatus.currentIST}</Badge>
            )}
          </div>
          <p>CSV upload available from 8:00 AM IST (Admin: anytime)</p>
          <p>Live Mode auto-starts at 9:15 AM</p>
          <p>Test Mode auto-starts at 9:30 AM</p>
          <p>Algorithm auto-stops at 3:10 PM</p>
          <p>CSV config auto-deleted at 3:30 PM</p>
        </div>
      </Card>
    </div>
  );
}
