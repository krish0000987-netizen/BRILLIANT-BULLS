import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileKey, Plus, Trash2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import type { EncryptedCredential } from "@shared/schema";

export default function CredentialsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [credType, setCredType] = useState("broker_api_key");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});

  const { data: credentials, isLoading } = useQuery<EncryptedCredential[]>({
    queryKey: ["/api/credentials"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { credentialType: string; value: string; label: string }) => {
      await apiRequest("POST", "/api/credentials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      setOpen(false);
      setCredType("broker_api_key");
      setLabel("");
      setValue("");
      toast({ title: "Credential Stored", description: "Your credential has been encrypted and stored securely." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      toast({ title: "Credential Deleted", description: "The credential has been removed." });
    },
  });

  const handleReveal = async (id: string) => {
    if (revealedIds.has(id)) {
      setRevealedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`/api/credentials/${id}/decrypt`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to decrypt");
      const data = await res.json();
      setDecryptedValues((prev) => ({ ...prev, [id]: data.value }));
      setRevealedIds((prev) => new Set(prev).add(id));
    } catch {
      toast({ title: "Error", description: "Failed to decrypt credential", variant: "destructive" });
    }
  };

  const credentialTypes: Record<string, string> = {
    broker_api_key: "Broker API Key",
    broker_secret: "Broker Secret",
    trading_token: "Trading Token",
    payment_info: "Payment Info",
    personal_detail: "Personal Detail",
    other: "Other",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-credentials-title">
            Encrypted Credentials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AES-256 encrypted sensitive data
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-credential">
              <Plus className="h-4 w-4 mr-2" />
              Add Credential
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Store New Credential</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={credType} onValueChange={setCredType}>
                  <SelectTrigger data-testid="select-cred-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(credentialTypes).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. AliceBlue API Key"
                  data-testid="input-cred-label"
                />
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  type="password"
                  placeholder="Enter sensitive value"
                  data-testid="input-cred-value"
                />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm text-muted-foreground">
                <Lock className="h-4 w-4 flex-shrink-0" />
                <span>This value will be encrypted with AES-256-GCM before storage</span>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({ credentialType: credType, value, label })}
                disabled={!value || createMutation.isPending}
                data-testid="button-save-credential"
              >
                {createMutation.isPending ? "Encrypting..." : "Encrypt & Store"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : credentials && credentials.length > 0 ? (
        <div className="space-y-3">
          {credentials.map((cred) => (
            <Card key={cred.id} className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{cred.label || "Unnamed"}</p>
                      <Badge variant="secondary" className="text-xs">
                        {credentialTypes[cred.credentialType] || cred.credentialType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {revealedIds.has(cred.id)
                        ? decryptedValues[cred.id] || "***"
                        : "••••••••••••"}
                      {" "} | Added {format(new Date(cred.createdAt!), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReveal(cred.id)}
                    data-testid={`button-reveal-${cred.id}`}
                  >
                    {revealedIds.has(cred.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(cred.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${cred.id}`}
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
            <FileKey className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">No credentials stored</p>
            <p className="text-xs text-muted-foreground">
              Add your broker API keys and trading tokens to encrypt them securely
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
