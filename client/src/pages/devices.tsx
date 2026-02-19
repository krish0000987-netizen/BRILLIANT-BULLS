import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Smartphone, Monitor, Tablet, Globe, Trash2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import type { Device } from "@shared/schema";

export default function DevicesPage() {
  const { toast } = useToast();

  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const removeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await apiRequest("DELETE", `/api/devices/${deviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      toast({ title: "Device Removed", description: "The device has been removed from your account." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const trustMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await apiRequest("PATCH", `/api/devices/${deviceId}/trust`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      toast({ title: "Device Trusted", description: "This device has been marked as trusted." });
    },
  });

  const getDeviceIcon = (os?: string | null) => {
    const lower = (os || "").toLowerCase();
    if (lower.includes("android") || lower.includes("ios")) return Tablet;
    if (lower.includes("mac") || lower.includes("windows") || lower.includes("linux")) return Monitor;
    return Smartphone;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-devices-title">
          Trusted Devices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage devices that have accessed your account
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : devices && devices.length > 0 ? (
        <div className="space-y-3">
          {devices.map((device) => {
            const DeviceIcon = getDeviceIcon(device.osName);
            return (
              <Card key={device.id} className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          {device.browserName || "Unknown Browser"} on {device.osName || "Unknown OS"}
                        </p>
                        {device.isTrusted && (
                          <Badge variant="secondary" className="text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Trusted
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {device.ipAddress || "Unknown IP"}
                        </span>
                        {device.country && <span>{device.city ? `${device.city}, ` : ""}{device.country}</span>}
                        <span>Last seen: {format(new Date(device.lastSeenAt!), "MMM d, yyyy HH:mm")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!device.isTrusted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => trustMutation.mutate(device.id)}
                        disabled={trustMutation.isPending}
                        data-testid={`button-trust-${device.id}`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                        Trust
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeMutation.mutate(device.id)}
                      disabled={removeMutation.isPending}
                      data-testid={`button-remove-${device.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8">
          <div className="text-center space-y-2">
            <Smartphone className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No devices have been registered yet</p>
          </div>
        </Card>
      )}
    </div>
  );
}
