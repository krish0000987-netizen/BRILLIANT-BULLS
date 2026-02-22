import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, Search, ShieldCheck, ShieldOff, UserPlus, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface UserWithSub {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  subscription: {
    plan: string;
    status: string;
    endDate: string | null;
  } | null;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", email: "", firstName: "", lastName: "", phone: "", role: "user" });
  const [subDialog, setSubDialog] = useState<string | null>(null);
  const [subPlan, setSubPlan] = useState("monthly");
  const [subDays, setSubDays] = useState("");

  const { data: users, isLoading } = useQuery<UserWithSub[]>({
    queryKey: ["/api/admin/users"],
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const changeRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createUserMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newUser),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User created" });
      setShowCreate(false);
      setNewUser({ username: "", password: "", email: "", firstName: "", lastName: "", phone: "", role: "user" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignSubMut = useMutation({
    mutationFn: async ({ userId, plan, days }: { userId: string; plan: string; days?: number }) => {
      const res = await fetch(`/api/admin/subscriptions/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan, days }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Subscription assigned" });
      setSubDialog(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const terminateSubMut = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/subscriptions/${userId}/terminate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Subscription terminated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = (users || []).filter((u) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase();
    return name.includes(term) || (u.email?.toLowerCase().includes(term) ?? false) || (u.username?.toLowerCase().includes(term) ?? false);
  });

  const roleColors: Record<string, string> = {
    admin: "bg-red-500/10 text-red-600 dark:text-red-400",
    manager: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    support: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    user: "bg-green-500/10 text-green-600 dark:text-green-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-admin-users-title">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage user accounts, roles, subscriptions, and access control</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user"><UserPlus className="h-4 w-4 mr-2" /> Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Username *</Label>
                <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} data-testid="input-new-username" />
              </div>
              <div className="space-y-1">
                <Label>Password *</Label>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} data-testid="input-new-password" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>First Name</Label>
                  <Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Last Name</Label>
                  <Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(r) => setNewUser({ ...newUser, role: r })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createUserMut.mutate()} disabled={createUserMut.isPending || !newUser.username || !newUser.password} data-testid="button-submit-create-user">
                {createUserMut.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" data-testid="input-search-users" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((u) => {
            const displayName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "User";
            const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            const subActive = u.subscription && u.subscription.status === "active" && u.subscription.endDate && new Date(u.subscription.endDate) > new Date();

            return (
              <Card key={u.id} className="p-4" data-testid={`card-user-${u.id}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{displayName}</p>
                        <Badge variant="secondary" className={`text-xs capitalize ${roleColors[u.role] || ""}`}>{u.role}</Badge>
                        {!u.isActive && <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400">Disabled</Badge>}
                        {u.subscription && (
                          <Badge variant="secondary" className={`text-xs capitalize ${subActive ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"}`}>
                            {u.subscription.plan} {subActive ? "" : `(${u.subscription.status})`}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        @{u.username || "—"} | {u.email || "No email"} | {u.phone || "No phone"}
                        {u.createdAt && ` | Joined: ${format(new Date(u.createdAt), "MMM d, yyyy")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={subDialog === u.id} onOpenChange={(open) => setSubDialog(open ? u.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" data-testid={`button-manage-sub-${u.id}`}>
                          <CreditCard className="h-3.5 w-3.5 mr-1" /> Sub
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Manage Subscription: {displayName}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          {u.subscription && (
                            <div className="text-sm p-2 rounded bg-muted">
                              Current: <span className="font-medium capitalize">{u.subscription.plan}</span> ({u.subscription.status})
                              {u.subscription.endDate && <> | Expires: {format(new Date(u.subscription.endDate), "MMM d, yyyy")}</>}
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label>Plan</Label>
                            <Select value={subPlan} onValueChange={setSubPlan}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="trial">Trial (3 days)</SelectItem>
                                <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                                <SelectItem value="quarterly">Quarterly (90 days)</SelectItem>
                                <SelectItem value="yearly">Yearly (365 days)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Custom days (optional)</Label>
                            <Input type="number" value={subDays} onChange={(e) => setSubDays(e.target.value)} placeholder="Leave empty for default" />
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1" onClick={() => assignSubMut.mutate({ userId: u.id, plan: subPlan, days: subDays ? parseInt(subDays) : undefined })} disabled={assignSubMut.isPending}>
                              {assignSubMut.isPending ? "Assigning..." : "Assign Plan"}
                            </Button>
                            {u.subscription && subActive && (
                              <Button variant="destructive" onClick={() => terminateSubMut.mutate(u.id)} disabled={terminateSubMut.isPending}>
                                Terminate
                              </Button>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Select value={u.role} onValueChange={(role) => changeRoleMut.mutate({ userId: u.id, role })}>
                      <SelectTrigger className="w-[110px]" data-testid={`select-role-${u.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => toggleActiveMut.mutate({ userId: u.id, isActive: !u.isActive })} disabled={toggleActiveMut.isPending} data-testid={`button-toggle-active-${u.id}`}>
                      {u.isActive ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
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
