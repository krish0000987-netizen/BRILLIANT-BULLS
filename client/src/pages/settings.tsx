import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { User, Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account preferences
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Profile Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <p className="text-sm font-medium" data-testid="text-profile-name">{displayName}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium" data-testid="text-profile-email">{user?.email || "Not provided"}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <p className="text-sm font-medium capitalize" data-testid="text-profile-role">{user?.role}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Account ID</Label>
            <p className="text-sm font-medium text-muted-foreground" data-testid="text-profile-id">{user?.id}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
            <div>
              <h3 className="text-sm font-medium">Dark Mode</h3>
              <p className="text-xs text-muted-foreground">Toggle between light and dark theme</p>
            </div>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={toggleTheme}
            data-testid="switch-dark-mode"
          />
        </div>
      </Card>
    </div>
  );
}
