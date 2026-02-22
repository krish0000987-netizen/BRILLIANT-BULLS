import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Moon, Sun, LogIn, Shield, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import NotFound from "@/pages/not-found";
import LiveLogsPage from "@/pages/live-logs";
import CsvUploadPage from "@/pages/csv-upload";
import SettingsPage from "@/pages/settings";
import SubscriptionPage from "@/pages/subscription";
import AdminUsersPage from "@/pages/admin-users";
import AdminLogsPage from "@/pages/admin-logs";
import { useEffect } from "react";

function RedirectTo({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to);
  }, [to, navigate]);
  return null;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function LoginPage() {
  const { login, loginError, isLoggingIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ username, password });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-app-title">SecureTrader</CardTitle>
          <CardDescription data-testid="text-app-description">
            Sign in to your trading security hub
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(error || loginError) && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-login-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error || loginError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-login">
              {isLoggingIn ? "Signing in..." : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <Switch>
              <Route path="/">{() => <RedirectTo to="/live-logs" />}</Route>
              <Route path="/live-logs">{() => (
                <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6">
                  <LiveLogsPage />
                </div>
              )}</Route>
              <Route path="/csv-upload">{() => (
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <CsvUploadPage />
                </div>
              )}</Route>
              <Route path="/subscription">{() => (
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <SubscriptionPage />
                </div>
              )}</Route>
              <Route path="/settings">{() => (
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <SettingsPage />
                </div>
              )}</Route>
              <Route path="/admin/users">{() => (
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <AdminUsersPage />
                </div>
              )}</Route>
              <Route path="/admin/logs">{() => (
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <AdminLogsPage />
                </div>
              )}</Route>
              <Route>{() => (
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                  <NotFound />
                </div>
              )}</Route>
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
