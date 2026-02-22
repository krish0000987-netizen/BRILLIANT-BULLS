import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Clock, CheckCircle, XCircle, Zap } from "lucide-react";

interface Sub {
  id: string;
  plan: string;
  status: string;
  amount: number;
  startDate: string | null;
  endDate: string | null;
  trialStartedAt: string | null;
}

function formatIST(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";
}

function daysRemaining(endDate: string | null): number {
  if (!endDate) return 0;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sub, isLoading } = useQuery<Sub | null>({
    queryKey: ["/api/subscription"],
  });

  const startTrialMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/start-trial", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({ title: "Trial started!", description: "You have 3 days of free access." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const buyPlanMut = useMutation({
    mutationFn: async (plan: string) => {
      const res = await fetch("/api/subscription/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({ title: "Subscribed!", description: "Your plan is now active." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isActive = sub && sub.status === "active" && sub.endDate && new Date(sub.endDate) > new Date();
  const remaining = sub ? daysRemaining(sub.endDate) : 0;

  const plans = [
    { id: "monthly", name: "Monthly", price: "₹1,000", days: 30, description: "Best for short-term traders" },
    { id: "quarterly", name: "Quarterly", price: "₹2,000", days: 90, description: "Save 33% vs monthly" },
    { id: "yearly", name: "Yearly", price: "₹10,000", days: 365, description: "Best value — save 17%" },
  ];

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-subscription-title">Subscription</h1>
        <p className="text-muted-foreground">Manage your trading platform subscription</p>
      </div>

      {sub && (
        <Card data-testid="card-current-sub">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold capitalize" data-testid="text-current-plan">{sub.plan}</span>
              <Badge variant={isActive ? "default" : "destructive"} data-testid="badge-sub-status">
                {isActive ? "Active" : sub.status === "expired" ? "Expired" : sub.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Started:</span>
                <div data-testid="text-start-date">{formatIST(sub.startDate)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Expires:</span>
                <div data-testid="text-end-date">{formatIST(sub.endDate)}</div>
              </div>
            </div>
            {isActive && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-days-remaining">{remaining} days remaining</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!sub && (
        <Card data-testid="card-trial">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Start Free Trial
            </CardTitle>
            <CardDescription>Try all features free for 3 days. No payment required.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => startTrialMut.mutate()}
              disabled={startTrialMut.isPending}
              data-testid="button-start-trial"
            >
              {startTrialMut.isPending ? "Starting..." : "Start 3-Day Free Trial"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={sub?.plan === plan.id && isActive ? "border-primary" : ""} data-testid={`card-plan-${plan.id}`}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">{plan.price}</div>
                <div className="text-sm text-muted-foreground">{plan.days} days access</div>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Live trading</li>
                  <li className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> CSV config upload</li>
                  <li className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Real-time logs</li>
                  <li className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Audit trail</li>
                </ul>
                <Button
                  className="w-full"
                  variant={sub?.plan === plan.id && isActive ? "outline" : "default"}
                  onClick={() => buyPlanMut.mutate(plan.id)}
                  disabled={buyPlanMut.isPending || !!(sub?.plan === plan.id && isActive)}
                  data-testid={`button-buy-${plan.id}`}
                >
                  {sub?.plan === plan.id && isActive ? "Current Plan" : buyPlanMut.isPending ? "Processing..." : "Subscribe"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
