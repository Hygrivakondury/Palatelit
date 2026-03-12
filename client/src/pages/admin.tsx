import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ShoppingBag, ArrowLeft, Save, ExternalLink, ImageIcon, ScanSearch, CheckCircle2, AlertCircle, MessageSquare, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { AffiliateLink, UserFeedback } from "@shared/schema";
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

function ImageManagementSection() {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<{ scanning: number; message: string } | null>(null);
  const [scanRunning, setScanRunning] = useState(false);

  const { data: stats, refetch: refetchStats } = useQuery<{ total: number; withImage: number; noImage: number }>({
    queryKey: ["/api/admin/image-stats"],
  });

  const generateMissingMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/regenerate-missing-images"),
    onSuccess: async (res) => {
      const data = await res.json();
      refetchStats();
      if (data.triggered === 0) {
        toast({ title: "All recipes already have images!", description: "Nothing to generate." });
      } else {
        toast({
          title: "Generating images",
          description: `Started generating pictures for ${data.triggered} recipe(s) in the background.`,
        });
      }
    },
    onError: () => toast({ title: "Failed to start generation", variant: "destructive" }),
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/scan-and-fix-images"),
    onSuccess: async (res) => {
      const data = await res.json();
      setScanResult(data);
      setScanRunning(true);
      toast({
        title: "Scan started",
        description: `Checking ${data.scanning} recipe image(s) for mismatches in the background. This may take several minutes.`,
      });
    },
    onError: () => toast({ title: "Scan failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground">Image Management</h1>
            <p className="text-sm text-muted-foreground">Scan and fix recipe images that don't match their dish</p>
          </div>
        </div>
      </div>

      <Separator />

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Recipes</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.withImage}</p>
            <p className="text-xs text-muted-foreground mt-1">Have AI Images</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.noImage}</p>
            <p className="text-xs text-muted-foreground mt-1">No Image</p>
          </div>
        </div>
      )}

      {/* Generate missing images */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ImageIcon className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground">Generate Images for All Recipes Without Pictures</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Automatically generates AI images for every recipe that currently has no picture. Runs in the background — images will appear as they are created.
            </p>
          </div>
        </div>
        <Button
          onClick={() => generateMissingMutation.mutate()}
          disabled={generateMissingMutation.isPending}
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="button-generate-missing-images"
        >
          {generateMissingMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          {generateMissingMutation.isPending ? "Starting…" : "Generate Missing Images"}
        </Button>
      </div>

      {/* Scan & Fix mismatched images */}
      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <ScanSearch className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground">Scan & Fix Mismatched Images</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Uses AI vision to check every recipe image against its dish name. Any image that doesn't match gets regenerated automatically in the background.
            </p>
          </div>
        </div>

        {scanResult && scanRunning && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Scanning {scanResult.scanning} images in the background. New images will appear as they are generated — no need to wait here.
            </p>
          </div>
        )}

        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          data-testid="button-scan-fix-images"
        >
          {scanMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ScanSearch className="w-4 h-4" />
          )}
          {scanMutation.isPending ? "Starting scan…" : "Scan & Fix All Mismatched Images"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Also use the "Regen Image" button inside any recipe for a quick one-off fix.
        </p>
      </div>
    </div>
  );
}

function FeedbackItem({ item }: { item: UserFeedback }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState(item.adminResponse ?? "");

  const respondMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/feedback/${item.id}/respond`, { adminResponse: replyText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({ title: "Response sent!", description: "The user will receive an email with your reply." });
    },
    onError: () => toast({ title: "Failed to send response", variant: "destructive" }),
  });

  const initials = item.userName?.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "?";
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className={`rounded-xl border bg-card p-4 space-y-3 ${item.adminResponse ? "border-emerald-200 dark:border-emerald-800" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarImage src={item.userProfileImage ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{item.userName || item.userEmail}</p>
            <p className="text-xs text-muted-foreground truncate">{item.userEmail}</p>
            <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{date}</span>
          </div>
          <p className="text-sm text-foreground mt-1 leading-relaxed whitespace-pre-wrap">{item.message}</p>
        </div>
      </div>

      {item.adminResponse && (
        <div className="ml-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 space-y-0.5">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Your response</p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.adminResponse}</p>
        </div>
      )}

      <div className="ml-12">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          data-testid={`button-toggle-reply-${item.id}`}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {item.adminResponse ? "Edit response" : "Reply"}
        </button>
        {expanded && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response…"
              rows={3}
              className="resize-none text-sm"
              data-testid={`input-reply-${item.id}`}
            />
            <Button
              size="sm"
              onClick={() => respondMutation.mutate()}
              disabled={!replyText.trim() || respondMutation.isPending}
              className="gap-2"
              data-testid={`button-send-reply-${item.id}`}
            >
              {respondMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {respondMutation.isPending ? "Sending…" : "Send Response"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackSection() {
  const { data: feedback = [], isLoading } = useQuery<UserFeedback[]>({
    queryKey: ["/api/admin/feedback"],
  });

  const unread = feedback.filter((f) => !f.adminResponse).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-serif text-foreground">User Feedback</h1>
              {unread > 0 && (
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold">{unread} new</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Read and respond to feedback from your community</p>
          </div>
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : feedback.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No feedback yet. Users can share feedback via the menu in the app.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => <FeedbackItem key={item.id} item={item} />)}
        </div>
      )}
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

        <Separator />

        <FeedbackSection />

        <Separator />

        <ImageManagementSection />
      </div>
    </div>
  );
}
