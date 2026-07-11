import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = isLogin ? "/api/login" : "/api/register";
      const body = isLogin
        ? { email, password }
        : { email, password, displayName };

      await apiRequest("POST", url, body);

      // refresh the auth state and WAIT for it before redirecting,
      // so the home route sees the logged-in user immediately.
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: isLogin ? "Welcome back!" : "Account created",
        description: isLogin ? "You're now signed in." : "Your kitchen is ready.",
      });
      setLocation("/");
    } catch (err: any) {
      const msg =
        typeof err?.message === "string"
          ? err.message.replace(/^\d+:\s*/, "")
          : "Something went wrong. Please try again.";
      toast({
        title: "Couldn't sign you in",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Palate <span className="text-primary">Lit</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isLogin
              ? "Welcome back to your kitchen"
              : "Create an account to save and share recipes"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-card-border rounded-2xl shadow-sm p-6 sm:p-8">
          {/* Google */}
          <a href="/api/auth/google" className="block">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 rounded-full h-11"
              data-testid="button-google"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 4.75 12 4.75z"/>
              </svg>
              Continue with Google
            </Button>
          </a>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px bg-border flex-1" />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  data-testid="input-displayname"
                  placeholder="How your name appears on recipes"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                required
                placeholder={isLogin ? "Your password" : "At least 8 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              data-testid="button-submit"
              className="w-full rounded-full h-11 font-medium"
            >
              {submitting
                ? "Please wait…"
                : isLogin
                ? "Sign in"
                : "Create account"}
            </Button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-muted-foreground mt-5">
            {isLogin ? "New to Palate Lit? " : "Already have an account? "}
            <button
              type="button"
              data-testid="button-toggle-mode"
              onClick={() => setMode(isLogin ? "register" : "login")}
              className="text-primary font-medium hover:underline"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>

        {/* Back */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
