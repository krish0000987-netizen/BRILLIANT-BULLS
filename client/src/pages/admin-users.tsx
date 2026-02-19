import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import type { User } from "@shared/schema";

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role Updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (users || []).filter(
    (u) =>
      !searchTerm ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    admin: "bg-red-500/10 text-red-600 dark:text-red-400",
    manager: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    support: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    user: "bg-green-500/10 text-green-600 dark:text-green-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-users-title">
          User Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage user accounts, roles, and access control
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-users"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((u) => {
            const initials = u.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            return (
              <Card key={u.id} className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{u.fullName}</p>
                        <Badge variant="secondary" className={`text-xs capitalize ${roleColors[u.role] || ""}`}>
                          {u.role}
                        </Badge>
                        {!u.isActive && (
                          <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        @{u.username} | {u.email}
                        {u.lastLoginAt && ` | Last login: ${format(new Date(u.lastLoginAt), "MMM d, HH:mm")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.role}
                      onValueChange={(role) => changeRoleMutation.mutate({ userId: u.id, role })}
                    >
                      <SelectTrigger className="w-[110px]" data-testid={`select-role-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActiveMutation.mutate({ userId: u.id, isActive: !u.isActive })}
                      disabled={toggleActiveMutation.isPending}
                      data-testid={`button-toggle-active-${u.id}`}
                    >
                      {u.isActive ? (
                        <ShieldOff className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
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
            <Users className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        </Card>
      )}
    </div>
  );
}
