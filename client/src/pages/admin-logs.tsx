import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollText, Search } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import type { AuditLog } from "@shared/schema";

export default function AdminLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs, isLoading } = useQuery<(AuditLog & { userName?: string })[]>({
    queryKey: ["/api/admin/logs"],
  });

  const filtered = (logs || []).filter(
    (log) =>
      !searchTerm ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const severityColors: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/10 text-red-600 dark:text-red-400",
    critical: "bg-red-600/10 text-red-700 dark:text-red-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-logs-title">
          System Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          All system-wide audit logs across all users
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search system logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-system-logs"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Card key={log.id} className="p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge
                    variant="secondary"
                    className={`text-xs capitalize ${severityColors[log.severity] || ""}`}
                  >
                    {log.severity}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{log.action}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {(log as any).userName && <span>By: {(log as any).userName}</span>}
                      {log.details && <span className="truncate">| {log.details}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                  <Badge variant="outline" className="text-xs">{log.category}</Badge>
                  {log.ipAddress && <span>{log.ipAddress}</span>}
                  <span>{format(new Date(log.createdAt!), "MMM d, HH:mm:ss")}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <div className="text-center space-y-2">
            <ScrollText className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No system logs found</p>
          </div>
        </Card>
      )}
    </div>
  );
}
