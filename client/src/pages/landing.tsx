import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import {
  Shield,
  Lock,
  Activity,
  BarChart3,
  Clock,
  Users,
  ChevronRight,
  Zap,
  Eye,
  FileText,
  Moon,
  Sun,
} from "lucide-react";

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <Card className="border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors" data-testid={`card-feature-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-4">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-primary">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-lg" data-testid="text-landing-brand">BRILLIANT BULLS</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-landing-theme-toggle">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/login">
              <Button data-testid="button-landing-signin">
                Sign In
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6" data-testid="text-landing-badge">
            <Zap className="h-3.5 w-3.5" />
            Enterprise-Grade Trading Security
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6" data-testid="text-landing-headline">
            Secure Your Algorithmic
            <span className="text-primary block sm:inline"> Trading Operations</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-landing-subheadline">
            A comprehensive security wrapper that protects your trading algorithms with
            authentication, encryption, audit logging, and automated scheduling — without
            modifying a single line of your trading code.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="text-base px-8" data-testid="button-landing-get-started">
                Get Started
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-landing-learn-more">
                Learn More
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section className="py-12 border-y border-border/50 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <StatCard value="AES-256" label="Encryption Standard" />
          <StatCard value="24/7" label="Automated Scheduling" />
          <StatCard value="100%" label="Code Isolation" />
          <StatCard value="Real-time" label="Audit Logging" />
        </div>
      </section>

      <section id="features" className="py-20 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" data-testid="text-landing-features-title">
              Everything You Need to Trade Securely
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built for professional traders who demand enterprise-level security
              without sacrificing performance or control.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Lock}
              title="Secure Authentication"
              description="Username/password login with bcrypt hashing, session management, and login rate limiting to prevent brute-force attacks."
            />
            <FeatureCard
              icon={Shield}
              title="AES-256 Encryption"
              description="Military-grade AES-256-GCM encryption for all sensitive data including API credentials and trading configurations."
            />
            <FeatureCard
              icon={Activity}
              title="Live Algorithm Monitoring"
              description="Real-time log streaming via SSE with auto-reconnect, providing instant visibility into your algo's performance."
            />
            <FeatureCard
              icon={Clock}
              title="Automated Scheduling"
              description="Fully automated trading schedule — live mode at 8:45 AM, test mode at 9:30 AM, auto-stop at 3:10 PM IST."
            />
            <FeatureCard
              icon={Users}
              title="Role-Based Access"
              description="Granular role management with admin, manager, support, and user roles. Control who can access what."
            />
            <FeatureCard
              icon={Eye}
              title="Audit Trail"
              description="Complete audit logging of every action with severity levels, timestamps, and IP tracking for regulatory compliance."
            />
            <FeatureCard
              icon={BarChart3}
              title="Subscription Management"
              description="Flexible subscription plans — free trial, monthly, quarterly, and yearly options with automated enforcement."
            />
            <FeatureCard
              icon={FileText}
              title="CSV Configuration"
              description="Encrypted CSV-based trading configurations that your algorithm reads securely without any code modifications."
            />
            <FeatureCard
              icon={Zap}
              title="Zero Code Changes"
              description="Your existing trading algorithm runs completely unchanged. The security wrapper operates independently around it."
            />
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 px-4 sm:px-6 bg-muted/30 border-t border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Secure Your Trading?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Start with a free 3-day trial. No credit card required.
          </p>
          <Link href="/login">
            <Button size="lg" className="text-base px-10" data-testid="button-landing-cta">
              Start Free Trial
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground" data-testid="text-landing-copyright">
              BRILLIANT BULLS. All rights reserved.
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Enterprise-grade security for algorithmic trading
          </div>
        </div>
      </footer>
    </div>
  );
}
