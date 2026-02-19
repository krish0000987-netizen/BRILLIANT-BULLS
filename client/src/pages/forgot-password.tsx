import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordRequestSchema } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: { email: string }) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", data);
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2.5 rounded-md bg-primary/10">
              <Shield className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-forgot-title">
            Reset Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a password reset link
          </p>
        </div>

        <Card className="p-6">
          {submitted ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-medium" data-testid="text-email-sent">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  If an account exists with that email, you'll receive a reset link within a few minutes. The link expires in 10 minutes.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/login")} data-testid="button-back-login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="you@example.com"
                            className="pl-9"
                            data-testid="input-email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-send-reset">
                  {isLoading ? "Sending..." : "Send Reset Link"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </Form>
          )}
        </Card>

        {!submitted && (
          <p className="text-center text-sm text-muted-foreground">
            <button
              onClick={() => navigate("/login")}
              className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              data-testid="link-back-login"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to login
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
