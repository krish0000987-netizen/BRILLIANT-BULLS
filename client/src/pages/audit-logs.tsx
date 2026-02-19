import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollText, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import type { AuditLog } from "@shared/schema";

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const filtered = (logs || []).filter((log) => {
    const matchSearch =
      !searchTerm ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchSeverity = severityFilter === "all" || log.severity === severityFilter;
    const matchCategory = categoryFilter === "all" || log.category === categoryFilter;
    return matchSearch && matchSeverity && matchCategory;
  });

  const categories = [...new Set((logs || []).map((l) => l.category))];

  const severityColors: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/10 text-red-600 dark:text-red-400",
    critical: "bg-red-600/10 text-red-700 dark:text-red-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-audit-title">
          Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive record of all security events and actions
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-logs"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-severity">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-category">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    {log.details && (
                      <p className="text-xs text-muted-foreground truncate">{log.details}</p>
                    )}
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
            <p className="text-sm text-muted-foreground">
              {searchTerm || severityFilter !== "all" || categoryFilter !== "all"
                ? "No logs match your filters"
                : "No audit logs recorded yet"}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
