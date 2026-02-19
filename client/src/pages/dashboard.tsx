import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Smartphone,
  ScrollText,
  FileKey,
  AlertTriangle,
  CheckCircle,
  Activity,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<{
    totalDevices: number;
    totalSessions: number;
    recentLogins: number;
    suspiciousEvents: number;
    totalCredentials: number;
    recentAuditLogs: Array<{
      id: string;
      action: string;
      category: string;
      severity: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const statCards = [
    {
      label: "Active Devices",
      value: stats?.totalDevices ?? 0,
      icon: Smartphone,
      color: "text-blue-500 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Active Sessions",
      value: stats?.totalSessions ?? 0,
      icon: Activity,
      color: "text-green-500 dark:text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Stored Credentials",
      value: stats?.totalCredentials ?? 0,
      icon: FileKey,
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Security Alerts",
      value: stats?.suspiciousEvents ?? 0,
      icon: AlertTriangle,
      color: "text-red-500 dark:text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">
          Welcome back, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your security overview at a glance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-semibold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    {stat.value}
                  </p>
                )}
              </div>
              <div className={`p-2.5 rounded-md ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Security Status</h3>
          </div>
          <div className="space-y-3">
            <StatusRow
              label="Password Strength"
              status="strong"
              icon={<CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
            />
            <StatusRow
              label="AES-256 Encryption"
              status="active"
              icon={<CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
            />
            <StatusRow
              label="Rate Limiting"
              status="enabled"
              icon={<CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
            />
            <StatusRow
              label="Security Headers"
              status="configured"
              icon={<CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
            />
            <StatusRow
              label="Session Timeout"
              status="30 min"
              icon={<Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ScrollText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Recent Activity</h3>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
            <div className="space-y-2">
              {stats.recentAuditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <SeverityDot severity={log.severity} />
                    <span className="text-sm truncate">{log.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ label, status, icon }: { label: string; status: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        <Badge variant="secondary" className="text-xs capitalize">{status}</Badge>
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    info: "bg-blue-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    critical: "bg-red-600",
  };
  return <div className={`h-2 w-2 rounded-full flex-shrink-0 ${colors[severity] || colors.info}`} />;
}
