import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShoppingBag, ArrowLeft, Save, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { AffiliateLink } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const SLOT_META: Record<string, { emoji: string; color: string; bgColor: string }> = {
  amazon: { emoji: "🛒", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
  blinkit: { emoji: "⚡", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  flipkart: { emoji: "🏪", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
};

function AffiliateLinkEditor({ link }: { link: AffiliateLink }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [label, setLabel] = useState(link.label);
  const [buttonText, setButtonText] = useState(link.buttonText);
  const [webUrl, setWebUrl] = useState(link.webUrl);
  const [deepLinkUrl, setDeepLinkUrl] = useState(link.deepLinkUrl);
  const [isActive, setIsActive] = useState(link.isActive);

  const meta = SLOT_META[link.slot] ?? { emoji: "🛍️", color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" };

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", `/api/affiliate-links/${link.slot}`, {
        label, buttonText, webUrl, deepLinkUrl, isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate-links"] });
      toast({ title: "Saved!", description: `${label} link updated successfully.` });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Please check your inputs and try again.", variant: "destructive" });
    },
  });

  const isDirty =
    label !== link.label ||
    buttonText !== link.buttonText ||
    webUrl !== link.webUrl ||
    deepLinkUrl !== link.deepLinkUrl ||
    isActive !== link.isActive;

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${meta.bgColor}`} data-testid={`affiliate-editor-${link.slot}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.emoji}</span>
          <div>
            <h3 className={`font-bold text-base ${meta.color}`}>{link.label}</h3>
            <p className="text-xs text-muted-foreground">Slot: {link.slot}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`active-${link.slot}`} className="text-sm font-medium">Active</Label>
          <Switch
            id={`active-${link.slot}`}
            checked={isActive}
            onCheckedChange={setIsActive}
            data-testid={`toggle-active-${link.slot}`}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Amazon"
            className="bg-white dark:bg-neutral-900"
            data-testid={`input-label-${link.slot}`}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Button Text</Label>
          <Input
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="e.g. Buy Spices on Amazon"
            className="bg-white dark:bg-neutral-900"
            data-testid={`input-button-text-${link.slot}`}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Web URL <span className="normal-case font-normal">(browser fallback)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              placeholder="https://..."
              className="bg-white dark:bg-neutral-900 font-mono text-xs"
              data-testid={`input-web-url-${link.slot}`}
            />
            {webUrl && (
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md border border-border bg-white hover:bg-muted transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deep Link URL <span className="normal-case font-normal">(opens native app)</span>
          </Label>
          <Input
            value={deepLinkUrl}
            onChange={(e) => setDeepLinkUrl(e.target.value)}
            placeholder="e.g. amzn://... or blinkit://..."
            className="bg-white dark:bg-neutral-900 font-mono text-xs"
            data-testid={`input-deep-link-${link.slot}`}
          />
          <p className="text-xs text-muted-foreground">
            If the user has the app installed, this opens it directly. Falls back to Web URL after 1.5s if app not found.
          </p>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !isDirty}
        className="w-full gap-2"
        data-testid={`button-save-${link.slot}`}
      >
        {saveMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saveMutation.isPending ? "Saving…" : isDirty ? "Save Changes" : "No Changes"}
      </Button>
    </div>
  );
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: profile } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/my-profile"],
  });

  const { data: affiliateLinks = [], isLoading } = useQuery<AffiliateLink[]>({
    queryKey: ["/api/affiliate-links"],
    enabled: profile?.isAdmin === true,
  });

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold text-foreground">Admin Access Only</h1>
        <p className="text-muted-foreground text-sm text-center">
          This page is restricted to authorised administrators.
        </p>
        <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to App
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-foreground">Smart Commerce</h1>
              <p className="text-sm text-muted-foreground">Manage affiliate links shown in every recipe</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Affiliate Link Slots</h2>
          <p className="text-sm text-muted-foreground">
            Each active slot appears as a button in the "Get Ingredients Fast" section inside every recipe. Paste your affiliate URLs here — updates take effect immediately across the whole site.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {affiliateLinks.map((link) => (
              <AffiliateLinkEditor key={link.slot} link={link} />
            ))}
          </div>
        )}

        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold">How Deep Links work:</p>
          <p>• <strong>Amazon:</strong> Use <code>amzn://link.amazon.in/redirect?url=…</code> — opens Amazon app if installed</p>
          <p>• <strong>Blinkit:</strong> Use <code>blinkit://search?q=…</code> — opens Blinkit app if installed</p>
          <p>• <strong>Flipkart:</strong> Use <code>flipkart://search?q=…</code> — opens Flipkart app if installed</p>
          <p className="pt-1">If the app isn't installed, the Web URL is opened in the browser automatically after 1.5 seconds.</p>
        </div>
      </div>
    </div>
  );
}
