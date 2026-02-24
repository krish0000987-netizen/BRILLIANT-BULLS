import { Switch, Route, useLocation, Link } from "wouter";
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
import { Moon, Sun, LogIn, Shield, AlertCircle, ArrowLeft, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
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

  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute top-4 right-4">
        <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-login-theme-toggle">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center space-y-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-2 text-muted-foreground" data-testid="link-back-home">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back to home
            </Button>
          </Link>
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-app-title">BRILLIANT BULLS</CardTitle>
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
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium" data-testid="link-signup">
              Sign Up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SignUpPage() {
  const { register, registerError, isRegistering } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register({ username, password, firstName: firstName || undefined, lastName: lastName || undefined, email: email || undefined, phone: phone || undefined });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative py-8">
      <div className="absolute top-4 right-4">
        <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-signup-theme-toggle">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center space-y-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-2 text-muted-foreground" data-testid="link-back-home-signup">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back to home
            </Button>
          </Link>
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-signup-title">Create Account</CardTitle>
          <CardDescription data-testid="text-signup-description">
            Sign up for BRILLIANT BULLS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(error || registerError) && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-signup-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error || registerError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="signup-firstName">First Name</Label>
                <Input id="signup-firstName" type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-signup-firstname" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-lastName">Last Name</Label>
                <Input id="signup-lastName" type="text" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-signup-lastname" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-username">Username <span className="text-destructive">*</span></Label>
              <Input id="signup-username" type="text" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} required data-testid="input-signup-username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password <span className="text-destructive">*</span></Label>
              <Input id="signup-password" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-signup-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-signup-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone</Label>
              <Input id="signup-phone" type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-signup-phone" />
            </div>
            <Button type="submit" className="w-full" disabled={isRegistering} data-testid="button-signup">
              {isRegistering ? "Creating account..." : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
              Sign In
            </Link>
          </div>
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
  const [location] = useLocation();

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
    if (location === "/login") {
      return <LoginPage />;
    }
    if (location === "/signup") {
      return <SignUpPage />;
    }
    return (
      <Switch>
        <Route path="/">{() => <LandingPage />}</Route>
        <Route path="/login">{() => <LoginPage />}</Route>
        <Route path="/signup">{() => <SignUpPage />}</Route>
        <Route>{() => <RedirectTo to="/" />}</Route>
      </Switch>
    );
  }

  if (location === "/" || location === "/login" || location === "/signup") {
    return (
      <>
        <RedirectTo to="/live-logs" />
        <AuthenticatedLayout />
      </>
    );
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
