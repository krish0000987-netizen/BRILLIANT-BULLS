import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Shield,
  LayoutDashboard,
  Smartphone,
  ScrollText,
  FileKey,
  Settings,
  Users,
  LogOut,
  FileSpreadsheet,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Devices", url: "/devices", icon: Smartphone },
  { title: "Credentials", url: "/credentials", icon: FileKey },
  { title: "CSV Config", url: "/csv-config", icon: FileSpreadsheet },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "User Management", url: "/admin/users", icon: Users },
  { title: "System Logs", url: "/admin/logs", icon: ScrollText },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" data-testid="text-app-name">SecureTrader</h2>
            <p className="text-xs text-muted-foreground">Security Hub</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                    className={location === item.url ? "bg-sidebar-accent" : ""}
                  >
                    <a
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(item.url);
                      }}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={location === item.url}
                      className={location === item.url ? "bg-sidebar-accent" : ""}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(item.url);
                        }}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate capitalize" data-testid="text-user-role">{user?.role}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
