import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import {
  Users,
  CreditCard,
  ShieldCheck,
  Activity,
  UserPlus,
  ScrollText,
  ArrowRight,
  Crown,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  activeSubs: number;
  trialSubs: number;
  paidSubs: number;
  recentLogs: {
    id: number;
    action: string;
    category: string;
    severity: string;
    createdAt: string;
    userName?: string;
  }[];
  recentUsers: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
    createdAt: string;
  }[];
}

function StatCard({ icon: Icon, label, value, subtext, color }: { icon: any; label: string; value: number | string; subtext?: string; color: string }) {
  return (
    <Card data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [, navigate] = useLocation();

  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
  });

  const severityColors: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/10 text-red-600 dark:text-red-400",
    critical: "bg-red-600/10 text-red-700 dark:text-red-300",
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-dashboard-title">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">System overview and quick actions</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-dashboard-title">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">System overview and quick actions</p>
        </div>
        <Badge variant="secondary" className="bg-primary/10 text-primary" data-testid="badge-admin">
          <Crown className="h-3 w-3 mr-1" />
          Admin Panel
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} subtext={`${stats?.activeUsers ?? 0} active`} color="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
        <StatCard icon={CreditCard} label="Active Subscriptions" value={stats?.activeSubs ?? 0} subtext={`${stats?.paidSubs ?? 0} paid, ${stats?.trialSubs ?? 0} trial`} color="bg-green-500/10 text-green-600 dark:text-green-400" />
        <StatCard icon={ShieldCheck} label="Admins" value={stats?.adminCount ?? 0} color="bg-purple-500/10 text-purple-600 dark:text-purple-400" />
        <StatCard icon={Activity} label="Paid Plans" value={stats?.paidSubs ?? 0} subtext="Monthly, Quarterly, Yearly" color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/admin/users")} data-testid="card-quick-users">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Manage Users</p>
              <p className="text-xs text-muted-foreground">Create, edit, disable accounts</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/admin/logs")} data-testid="card-quick-logs">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-amber-500/10">
              <ScrollText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">System Logs</p>
              <p className="text-xs text-muted-foreground">View audit trail and activity</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/admin/users")} data-testid="card-quick-subs">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-green-500/10">
              <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Subscriptions</p>
              <p className="text-xs text-muted-foreground">Assign and manage plans</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Users</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/users")} data-testid="button-view-all-users">
                View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentUsers && stats.recentUsers.length > 0 ? (
              <div className="space-y-3">
                {stats.recentUsers.map(u => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "User";
                  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <div key={u.id} className="flex items-center gap-3" data-testid={`recent-user-${u.id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="text-xs capitalize">{u.role}</Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {u.createdAt ? format(new Date(u.createdAt), "MMM d") : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/logs")} data-testid="button-view-all-logs">
                View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentLogs && stats.recentLogs.length > 0 ? (
              <div className="space-y-3">
                {stats.recentLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3" data-testid={`recent-log-${log.id}`}>
                    <Badge variant="secondary" className={`text-xs capitalize mt-0.5 ${severityColors[log.severity] || ""}`}>
                      {log.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.createdAt ? format(new Date(log.createdAt), "MMM d, HH:mm") : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
