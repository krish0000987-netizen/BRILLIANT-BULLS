import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { FileSpreadsheet, Upload, Download, Trash2, Lock, Clock } from "lucide-react";
import { format } from "date-fns";
import type { CsvConfig } from "@shared/schema";

export default function CsvConfigPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: configs, isLoading } = useQuery<CsvConfig[]>({
    queryKey: ["/api/csv-configs"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/csv-configs/upload", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/csv-configs"] });
      toast({ title: "CSV Uploaded", description: "Your configuration has been encrypted and stored." });
    },
    onError: (err: any) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/csv-configs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/csv-configs"] });
      toast({ title: "Config Deleted", description: "The CSV configuration has been removed." });
    },
  });

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid File", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    uploadMutation.mutate(file);
    e.target.value = "";
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const res = await fetch(`/api/csv-configs/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download config", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-csv-title">
            CSV Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and manage your trading configuration files securely
          </p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <Button onClick={handleUpload} disabled={uploading} data-testid="button-upload-csv">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload CSV"}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>
            Your CSV files are encrypted with AES-256-GCM before storage. The original Python trading code reads its
            configuration from CSV files on disk independently -- this is a separate secure backup and management layer.
          </span>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : configs && configs.length > 0 ? (
        <div className="space-y-3">
          {configs.map((config) => (
            <Card key={config.id} className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" data-testid={`text-config-name-${config.id}`}>{config.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>Uploaded {format(new Date(config.createdAt!), "MMM d, yyyy HH:mm")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(config.id, config.fileName)}
                    data-testid={`button-download-${config.id}`}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(config.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${config.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <div className="text-center space-y-2">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">No configurations uploaded</p>
            <p className="text-xs text-muted-foreground">
              Upload your trading config CSV to store it securely with AES-256 encryption
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
