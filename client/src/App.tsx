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
import { Moon, Sun, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LiveLogsPage from "@/pages/live-logs";
import CsvUploadPage from "@/pages/csv-upload";
import SettingsPage from "@/pages/settings";
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-app-title">SecureTrader</h1>
          <p className="text-muted-foreground" data-testid="text-app-description">
            Enterprise-grade security hub for your trading operations
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => { window.location.href = "/api/login"; }}
          data-testid="button-login"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Sign in with Replit
        </Button>
        <p className="text-xs text-muted-foreground">
          Secure authentication powered by Replit
        </p>
      </div>
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
