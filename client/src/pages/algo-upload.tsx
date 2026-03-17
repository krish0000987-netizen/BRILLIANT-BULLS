import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Upload, FileCode, Trash2, CheckCircle, AlertCircle, Package,
  RefreshCw, Info, Code, HardDrive, Zap, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface ScriptInfo {
  hasUserScript: boolean;
  scriptName: string;
  size: number;
  imports: string[];
}

interface InstallResult {
  success: boolean;
  installed: string[];
  failed: string[];
  skipped: string[];
}

export default function AlgoUploadPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedCode, setPastedCode] = useState("");
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: scriptInfo, isLoading } = useQuery<ScriptInfo>({
    queryKey: ["/api/algo/script-info"],
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/algo/upload-script", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/algo/script-info"] });
      toast({ title: "Script Uploaded", description: "Your Python algorithm has been saved and is ready to run." });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: any) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    },
  });

  const saveCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/algo/save-script", { code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/algo/script-info"] });
      toast({ title: "Script Saved", description: "Your Python algorithm has been saved." });
      setPastedCode("");
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/algo/install-deps", {});
      return res.json();
    },
    onSuccess: (data: InstallResult) => {
      setInstallResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/algo/status"] });
      if (data.success) {
        toast({ title: "Dependencies Installed", description: `Installed ${data.installed.length} package(s) successfully.` });
      } else {
        toast({ title: "Some Failed", description: `${data.failed.length} package(s) failed to install.`, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Install Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/algo/script");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/algo/script-info"] });
      toast({ title: "Script Deleted", description: "Default algorithm will be used." });
      setShowDeleteConfirm(false);
      setInstallResult(null);
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".py")) {
      toast({ title: "Invalid File", description: "Only .py Python files are accepted.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-algo-upload-title">
          Algorithm Manager
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your Python trading algorithm. IST timezone is auto-injected.
        </p>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">How It Works</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Code className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <p>Upload <span className="font-medium text-foreground">.py file</span> or paste your Python trading algo code</p>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <p><span className="font-medium text-foreground">IST timezone (UTC+5:30)</span> is automatically applied — all datetime.now() calls use Indian time</p>
          </div>
          <div className="flex items-start gap-2">
            <Package className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <p>Click <span className="font-medium text-foreground">Auto-Install Libraries</span> to detect and install all Python imports</p>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <p>Algo auto-runs: <span className="font-medium text-foreground">Start 8:45 AM</span>, Stop 3:10 PM (Mon-Fri IST)</p>
          </div>
        </div>
      </Card>

      {scriptInfo && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Current Script</h3>
            </div>
            {scriptInfo.hasUserScript ? (
              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                User Script Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Default Script
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">File</p>
              <p className="font-medium font-mono" data-testid="text-script-name">{scriptInfo.scriptName}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Size</p>
              <p className="font-medium" data-testid="text-script-size">
                {scriptInfo.size > 0 ? formatSize(scriptInfo.size) : "—"}
              </p>
            </div>
          </div>

          {scriptInfo.imports.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Detected 3rd-party imports ({scriptInfo.imports.length}):</p>
              <div className="flex flex-wrap gap-1">
                {scriptInfo.imports.map((pkg) => (
                  <Badge key={pkg} variant="outline" className="text-xs font-mono" data-testid={`badge-import-${pkg}`}>
                    {pkg}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isAdmin && scriptInfo.imports.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setInstallResult(null); installMutation.mutate(); }}
                disabled={installMutation.isPending}
                data-testid="button-install-deps"
              >
                {installMutation.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                )}
                {installMutation.isPending ? "Installing..." : "Auto-Install Libraries"}
              </Button>
            )}

            {isAdmin && scriptInfo.hasUserScript && (
              <>
                {!showDeleteConfirm ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="button-delete-script"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete Script
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive font-medium">Delete user script?</span>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-script">
                      {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)} data-testid="button-cancel-delete-script">
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {installResult && (
            <div className={`rounded-md p-3 text-xs space-y-1 ${installResult.success ? "bg-green-500/5 border border-green-500/20" : "bg-amber-500/5 border border-amber-500/20"}`}>
              {installResult.installed.length > 0 && (
                <p className="text-green-600 dark:text-green-400">
                  <span className="font-medium">✓ Installed:</span> {installResult.installed.join(", ")}
                </p>
              )}
              {installResult.skipped.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Already installed:</span> {installResult.skipped.join(", ")}
                </p>
              )}
              {installResult.failed.length > 0 && (
                <p className="text-red-600 dark:text-red-400">
                  <span className="font-medium">✗ Failed:</span> {installResult.failed.join(", ")}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {isAdmin && (
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload" data-testid="tab-upload-file">Upload File</TabsTrigger>
            <TabsTrigger value="paste" data-testid="tab-paste-code">Paste Code</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">Upload Python Script</h3>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".py"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-py-file"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                data-testid="dropzone-py-file"
              >
                <FileCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to select a .py file</p>
                <p className="text-xs text-muted-foreground mt-1">Python trading algorithm file</p>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2 text-sm">
                    <FileCode className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-muted-foreground">{formatSize(selectedFile.size)}</span>
                  </div>
                  <Button
                    onClick={() => uploadMutation.mutate(selectedFile)}
                    disabled={uploadMutation.isPending}
                    size="sm"
                    data-testid="button-upload-script"
                  >
                    {uploadMutation.isPending ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {uploadMutation.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="paste" className="mt-4">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">Paste Python Code</h3>
              </div>
              <Textarea
                placeholder="# Paste your Python trading algorithm here..."
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                className="font-mono text-xs min-h-[300px] resize-y"
                data-testid="textarea-python-code"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {pastedCode.split("\n").length} lines · {pastedCode.length} characters
                </p>
                <Button
                  onClick={() => saveCodeMutation.mutate(pastedCode)}
                  disabled={saveCodeMutation.isPending || pastedCode.trim().length === 0}
                  data-testid="button-save-code"
                >
                  {saveCodeMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <HardDrive className="h-4 w-4 mr-2" />
                  )}
                  {saveCodeMutation.isPending ? "Saving..." : "Save Script"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!isAdmin && (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <p>Only administrators can upload or modify the trading algorithm.</p>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Schedule (Mon-Fri IST):</p>
          <p>🟢 Live algo auto-starts at <span className="font-medium">8:45 AM IST</span></p>
          <p>🧪 Test mode auto-starts at <span className="font-medium">9:30 AM IST</span></p>
          <p>🔴 Auto-stops at <span className="font-medium">3:10 PM IST</span></p>
          <p>🗑 CSV config auto-deleted at <span className="font-medium">4:00 PM IST</span></p>
        </div>
      </Card>
    </div>
  );
}
