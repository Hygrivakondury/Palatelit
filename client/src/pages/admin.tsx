import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, ShoppingBag, ArrowLeft, Save, ExternalLink, ImageIcon, ScanSearch,
  MessageSquare, Send, ChevronDown, ChevronUp, UtensilsCrossed, Users,
  Plus, X, Pencil, Trash2, Search, CheckCircle2, ChefHat, PenSquare, Eye, EyeOff, DollarSign, FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { AffiliateLink, UserFeedback, Recipe, BlogPost, AdSlot } from "@shared/schema";
import { CUISINE_TYPES, DIETARY_TAGS, AD_SLOT_NAMES, SITE_CONTENT_DEFAULTS } from "@shared/schema";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
type AdminTab = "recipes" | "community" | "commerce" | "feedback" | "images" | "blog" | "monetize" | "content";

const SLOT_META: Record<string, { emoji: string; color: string; bgColor: string }> = {
  amazon: { emoji: "🛒", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800" },
  blinkit: { emoji: "⚡", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" },
  flipkart: { emoji: "🏪", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800" },
};

// ─── RECIPE EDITOR ──────────────────────────────────────────────────────────
type RecipeFormData = {
  title: string;
  description: string;
  ingredientsText: string;
  instructionsText: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  cuisineType: string;
  dietaryTags: string[];
  category: string;
  youtubeUrl: string;
};

function emptyForm(): RecipeFormData {
  return {
    title: "", description: "", ingredientsText: "", instructionsText: "",
    prepTime: "15", cookTime: "20", servings: "4",
    cuisineType: "Pan-Indian", dietaryTags: [], category: "main", youtubeUrl: "",
  };
}

function recipeToForm(r: Recipe): RecipeFormData {
  return {
    title: r.title,
    description: r.description,
    ingredientsText: r.ingredients.join("\n"),
    instructionsText: r.instructions.join("\n"),
    prepTime: String(r.prepTime),
    cookTime: String(r.cookTime),
    servings: String(r.servings),
    cuisineType: r.cuisineType,
    dietaryTags: r.dietaryTags ?? [],
    category: r.category ?? "main",
    youtubeUrl: r.youtubeUrl ?? "",
  };
}

function formToPayload(f: RecipeFormData) {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    ingredients: f.ingredientsText.split("\n").map(s => s.trim()).filter(Boolean),
    instructions: f.instructionsText.split("\n").map(s => s.trim()).filter(Boolean),
    prepTime: Number(f.prepTime) || 15,
    cookTime: Number(f.cookTime) || 20,
    servings: Number(f.servings) || 4,
    cuisineType: f.cuisineType,
    dietaryTags: f.dietaryTags,
    category: f.category,
    youtubeUrl: f.youtubeUrl.trim() || null,
  };
}

function RecipeEditorForm({
  initial,
  onSave,
  onCancel,
  isPending,
  mode,
}: {
  initial: RecipeFormData;
  onSave: (payload: ReturnType<typeof formToPayload>) => void;
  onCancel: () => void;
  isPending: boolean;
  mode: "create" | "edit";
}) {
  const [f, setF] = useState<RecipeFormData>(initial);
  const set = (k: keyof RecipeFormData) => (val: string) => setF(prev => ({ ...prev, [k]: val }));

  const toggleTag = (tag: string) =>
    setF(prev => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(tag)
        ? prev.dietaryTags.filter(t => t !== tag)
        : [...prev.dietaryTags, tag],
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recipe Title *</Label>
          <Input value={f.title} onChange={e => set("title")(e.target.value)} placeholder="e.g. Dal Makhani" data-testid="admin-input-title" />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
          <Textarea value={f.description} onChange={e => set("description")(e.target.value)} rows={2} placeholder="Brief description of the dish" className="resize-none" />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ingredients * <span className="normal-case font-normal">(one per line)</span></Label>
          <Textarea value={f.ingredientsText} onChange={e => set("ingredientsText")(e.target.value)} rows={6} placeholder={"2 cups whole black lentils\n1 cup kidney beans\n3 tbsp butter"} className="resize-y font-mono text-sm" data-testid="admin-input-ingredients" />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions * <span className="normal-case font-normal">(one step per line)</span></Label>
          <Textarea value={f.instructionsText} onChange={e => set("instructionsText")(e.target.value)} rows={6} placeholder={"Soak lentils overnight.\nBring to boil with 3 cups water.\nAdd butter and cream."} className="resize-y font-mono text-sm" data-testid="admin-input-instructions" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prep Time (min)</Label>
          <Input type="number" min={0} value={f.prepTime} onChange={e => set("prepTime")(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cook Time (min)</Label>
          <Input type="number" min={0} value={f.cookTime} onChange={e => set("cookTime")(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Servings</Label>
          <Input type="number" min={1} value={f.servings} onChange={e => set("servings")(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tab / Category</Label>
          <Select value={f.category} onValueChange={set("category")}>
            <SelectTrigger data-testid="admin-select-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="main">🍽️ Dishes</SelectItem>
              <SelectItem value="dessert">🍬 Desserts & Sweets</SelectItem>
              <SelectItem value="mocktail">🥤 Mocktails & Juices</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cuisine Type</Label>
          <Select value={f.cuisineType} onValueChange={set("cuisineType")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CUISINE_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dietary Tags</Label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  f.dietaryTags.includes(tag)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground hover:border-primary/50"
                }`}
                data-testid={`admin-tag-${tag}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">YouTube URL <span className="normal-case font-normal">(optional)</span></Label>
          <Input value={f.youtubeUrl} onChange={e => set("youtubeUrl")(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => onSave(formToPayload(f))}
          disabled={isPending || !f.title.trim() || !f.ingredientsText.trim() || !f.instructionsText.trim()}
          className="flex-1 gap-2"
          data-testid="admin-button-save-recipe"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isPending ? "Saving…" : mode === "create" ? "Create Recipe" : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <X className="w-4 h-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── RECIPE MANAGEMENT SECTION ─────────────────────────────────────────────
function RecipeManagementSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "main" | "dessert" | "mocktail">("all");
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: allRecipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/admin/recipes"],
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: ReturnType<typeof formToPayload> }) =>
      apiRequest("PATCH", `/api/admin/recipes/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe updated!", description: "Changes saved across the whole site." });
      setEditingRecipe(null);
    },
    onError: () => toast({ title: "Failed to update recipe", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formToPayload>) => apiRequest("POST", "/api/admin/recipes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe created!", description: "AI image generation started in background." });
      setShowCreate(false);
    },
    onError: () => toast({ title: "Failed to create recipe", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe deleted" });
    },
    onError: () => toast({ title: "Failed to delete recipe", variant: "destructive" }),
  });

  const filtered = allRecipes.filter(r => {
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categoryLabel = (c: string) =>
    c === "main" ? "🍽️ Dishes" : c === "dessert" ? "🍬 Desserts" : "🥤 Drinks";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold font-serif text-foreground">Recipe Management</h2>
          <p className="text-sm text-muted-foreground">{allRecipes.length} recipes total</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setEditingRecipe(null); }} className="gap-2" data-testid="admin-button-new-recipe">
          <Plus className="w-4 h-4" /> New Recipe
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Create New Recipe</h3>
          <RecipeEditorForm
            initial={emptyForm()}
            onSave={(payload) => createMutation.mutate(payload)}
            onCancel={() => setShowCreate(false)}
            isPending={createMutation.isPending}
            mode="create"
          />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="pl-9"
            data-testid="admin-input-search-recipes"
          />
        </div>
        <Select value={filterCategory} onValueChange={(v: typeof filterCategory) => setFilterCategory(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tabs</SelectItem>
            <SelectItem value="main">🍽️ Dishes</SelectItem>
            <SelectItem value="dessert">🍬 Desserts</SelectItem>
            <SelectItem value="mocktail">🥤 Drinks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-10">No recipes match your filters.</p>
          )}
          {filtered.map(recipe => (
            <div key={recipe.id}>
              <div
                className={`rounded-xl border bg-card p-3 flex items-center gap-3 transition-all ${editingRecipe?.id === recipe.id ? "border-primary/60 ring-1 ring-primary/30" : "border-border hover:border-primary/30"}`}
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{recipe.title}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-xs text-muted-foreground">{categoryLabel(recipe.category ?? "main")}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{recipe.cuisineType}</span>
                    {recipe.isUserSubmitted && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Community</Badge>}
                    {!recipe.imageUrl && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">No image</Badge>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingRecipe(editingRecipe?.id === recipe.id ? null : recipe);
                      setShowCreate(false);
                    }}
                    data-testid={`admin-button-edit-${recipe.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${recipe.title}"? This cannot be undone.`)) {
                        deleteMutation.mutate(recipe.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid={`admin-button-delete-${recipe.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {editingRecipe?.id === recipe.id && (
                <div className="rounded-b-xl border border-t-0 border-primary/40 bg-card/60 p-5 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Editing: {recipe.title}</p>
                  <RecipeEditorForm
                    initial={recipeToForm(recipe)}
                    onSave={(payload) => updateMutation.mutate({ id: recipe.id, data: payload })}
                    onCancel={() => setEditingRecipe(null)}
                    isPending={updateMutation.isPending}
                    mode="edit"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COMMUNITY MODERATION ──────────────────────────────────────────────────
function CommunityModerationSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  type AdminMsg = { id: number; recipeId: number; senderName: string | null; content: string; createdAt: string | null };

  const { data: messages = [], isLoading } = useQuery<AdminMsg[]>({
    queryKey: ["/api/admin/community-messages"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/community/messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-messages"] });
      toast({ title: "Message deleted" });
    },
    onError: () => toast({ title: "Failed to delete message", variant: "destructive" }),
  });

  const filtered = messages.filter(m =>
    !search || m.content.toLowerCase().includes(search.toLowerCase()) || m.senderName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold font-serif text-foreground">Community Moderation</h2>
        <p className="text-sm text-muted-foreground">{messages.length} recent messages</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages…" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No messages found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => (
            <div key={msg.id} className="rounded-xl border bg-card p-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{msg.senderName || "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">Recipe #{msg.recipeId}</p>
                  {msg.createdAt && (
                    <p className="text-xs text-muted-foreground ml-auto">
                      {new Date(msg.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
                <p className="text-sm text-foreground mt-0.5 leading-relaxed line-clamp-3">{msg.content}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive flex-shrink-0"
                onClick={() => {
                  if (confirm("Delete this message permanently?")) deleteMutation.mutate(msg.id);
                }}
                disabled={deleteMutation.isPending}
                data-testid={`admin-delete-msg-${msg.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AFFILIATE EDITOR ──────────────────────────────────────────────────────
function AffiliateLinkEditor({ link }: { link: AffiliateLink }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [label, setLabel] = useState(link.label);
  const [buttonText, setButtonText] = useState(link.buttonText);
  const [webUrl, setWebUrl] = useState(link.webUrl);
  const [deepLinkUrl, setDeepLinkUrl] = useState(link.deepLinkUrl);
  const [isActive, setIsActive] = useState(link.isActive);
  const meta = SLOT_META[link.slot] ?? { emoji: "🛍️", color: "text-gray-700", bgColor: "bg-card border-border" };

  const saveMutation = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/affiliate-links/${link.slot}`, { label, buttonText, webUrl, deepLinkUrl, isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate-links"] });
      toast({ title: "Saved!", description: `${label} link updated.` });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const isDirty = label !== link.label || buttonText !== link.buttonText || webUrl !== link.webUrl || deepLinkUrl !== link.deepLinkUrl || isActive !== link.isActive;

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
          <Switch id={`active-${link.slot}`} checked={isActive} onCheckedChange={setIsActive} data-testid={`toggle-active-${link.slot}`} />
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display Label</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Amazon" className="bg-white dark:bg-neutral-900" data-testid={`input-label-${link.slot}`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Button Text</Label>
          <Input value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder="e.g. Buy on Amazon" className="bg-white dark:bg-neutral-900" data-testid={`input-button-text-${link.slot}`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Web URL <span className="normal-case font-normal">(browser fallback)</span></Label>
          <div className="flex gap-2">
            <Input value={webUrl} onChange={e => setWebUrl(e.target.value)} placeholder="https://..." className="bg-white dark:bg-neutral-900 font-mono text-xs" data-testid={`input-web-url-${link.slot}`} />
            {webUrl && <a href={webUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md border border-border bg-white hover:bg-muted transition-colors"><ExternalLink className="w-4 h-4 text-muted-foreground" /></a>}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deep Link URL <span className="normal-case font-normal">(opens native app)</span></Label>
          <Input value={deepLinkUrl} onChange={e => setDeepLinkUrl(e.target.value)} placeholder="e.g. amzn://... or blinkit://..." className="bg-white dark:bg-neutral-900 font-mono text-xs" data-testid={`input-deep-link-${link.slot}`} />
          <p className="text-xs text-muted-foreground">Falls back to Web URL after 1.5s if app not found.</p>
        </div>
      </div>
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !isDirty} className="w-full gap-2" data-testid={`button-save-${link.slot}`}>
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saveMutation.isPending ? "Saving…" : isDirty ? "Save Changes" : "No Changes"}
      </Button>
    </div>
  );
}

// ─── IMAGE MANAGEMENT ──────────────────────────────────────────────────────
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
      toast({ title: data.triggered === 0 ? "All recipes have images!" : "Generating images…", description: data.triggered === 0 ? "Nothing to generate." : `Started for ${data.triggered} recipe(s).` });
    },
    onError: () => toast({ title: "Failed to start generation", variant: "destructive" }),
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/scan-and-fix-images"),
    onSuccess: async (res) => {
      const data = await res.json();
      setScanResult(data);
      setScanRunning(true);
      toast({ title: "Scan started", description: `Checking ${data.scanning} image(s) in background.` });
    },
    onError: () => toast({ title: "Scan failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold font-serif text-foreground">Image Management</h2>
        <p className="text-sm text-muted-foreground">AI-generate and fix recipe images</p>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.withImage}</p>
            <p className="text-xs text-muted-foreground mt-1">Have Images</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.noImage}</p>
            <p className="text-xs text-muted-foreground mt-1">No Image</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ImageIcon className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground">Generate Images for All Without Pictures</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Automatically generates AI images for every recipe without one. Runs in background.</p>
          </div>
        </div>
        <Button onClick={() => generateMissingMutation.mutate()} disabled={generateMissingMutation.isPending} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-generate-missing-images">
          {generateMissingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {generateMissingMutation.isPending ? "Starting…" : "Generate Missing Images"}
        </Button>
      </div>

      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <ScanSearch className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground">Scan & Fix Mismatched Images</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Uses AI vision to check every image against its dish name. Regenerates wrong ones automatically.</p>
          </div>
        </div>
        {scanResult && scanRunning && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">Scanning {scanResult.scanning} images. Images will appear as they are generated.</p>
          </div>
        )}
        <Button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending} className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white" data-testid="button-scan-fix-images">
          {scanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
          {scanMutation.isPending ? "Starting scan…" : "Scan & Fix All Mismatched Images"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">Also use "Regen Image" inside any recipe for a quick one-off fix.</p>
      </div>
    </div>
  );
}

// ─── FEEDBACK SECTION ──────────────────────────────────────────────────────
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

  const initials = item.userName?.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2) || "?";
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
        <div className="ml-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Your response</p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.adminResponse}</p>
        </div>
      )}
      <div className="ml-12">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`button-toggle-reply-${item.id}`}>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {item.adminResponse ? "Edit response" : "Reply"}
        </button>
        {expanded && (
          <div className="mt-2 space-y-2">
            <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type your response…" rows={3} className="resize-none text-sm" data-testid={`input-reply-${item.id}`} />
            <Button size="sm" onClick={() => respondMutation.mutate()} disabled={!replyText.trim() || respondMutation.isPending} className="gap-2" data-testid={`button-send-reply-${item.id}`}>
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
  const unread = feedback.filter(f => !f.adminResponse).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold font-serif text-foreground">User Feedback</h2>
          <p className="text-sm text-muted-foreground">{feedback.length} messages · {unread} need reply</p>
        </div>
        {unread > 0 && <Badge className="bg-red-500 text-white ml-auto">{unread} unread</Badge>}
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : feedback.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No feedback yet.</p>
      ) : (
        <div className="space-y-3">{feedback.map(item => <FeedbackItem key={item.id} item={item} />)}</div>
      )}
    </div>
  );
}

// ─── BLOG MANAGEMENT SECTION ───────────────────────────────────────────────
function BlogManagementSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", tags: "", isPublished: false });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog", "admin"],
    queryFn: () => fetch("/api/blog?admin=1").then(r => r.json()),
  });

  const resetForm = () => setForm({ title: "", excerpt: "", content: "", tags: "", isPublished: false });

  const startCreate = () => { resetForm(); setEditing(null); setCreating(true); };
  const startEdit = (p: BlogPost) => {
    setForm({ title: p.title, excerpt: p.excerpt ?? "", content: p.content ?? "", tags: (p.tags ?? []).join(", "), isPublished: p.isPublished ?? false });
    setCreating(false);
    setEditing(p);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        isPublished: form.isPublished,
      };
      if (creating) return apiRequest("POST", "/api/blog", payload);
      return apiRequest("PATCH", `/api/blog/${editing!.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      setEditing(null); setCreating(false); resetForm();
      toast({ title: creating ? "Post created!" : "Post updated!" });
    },
    onError: () => toast({ title: "Failed to save post", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/blog/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Post deleted" });
    },
    onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, current }: { id: number; current: boolean }) =>
      apiRequest("PATCH", `/api/blog/${id}`, { isPublished: !current }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/blog"] }),
    onError: () => toast({ title: "Failed to toggle publish", variant: "destructive" }),
  });

  const isEditorOpen = creating || !!editing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-serif text-foreground">Blog Posts</h2>
        <Button onClick={startCreate} className="gap-2" size="sm" data-testid="button-create-post">
          <Plus className="w-4 h-4" /> New Post
        </Button>
      </div>

      {isEditorOpen && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground">{creating ? "Create New Post" : `Edit: ${editing?.title}`}</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Post title"
                data-testid="input-post-title"
              />
            </div>
            <div>
              <Label className="text-xs">Excerpt</Label>
              <Input
                value={form.excerpt}
                onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                placeholder="Short description shown on card"
              />
            </div>
            <div>
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. South Indian, Tips, Seasonal"
              />
            </div>
            <div>
              <Label className="text-xs">Content (Markdown)</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Write your post content in Markdown…"
                rows={14}
                className="font-mono text-xs resize-y"
                data-testid="input-post-content"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isPublished}
                onCheckedChange={v => setForm(f => ({ ...f, isPublished: v }))}
                id="publish-toggle"
              />
              <Label htmlFor="publish-toggle" className="text-sm cursor-pointer">
                {form.isPublished ? "Published" : "Draft (not visible to public)"}
              </Label>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || saveMutation.isPending}
              className="gap-2"
              data-testid="button-save-post"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saveMutation.isPending ? "Saving…" : "Save Post"}
            </Button>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <PenSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No posts yet. Click "New Post" to start writing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="rounded-xl border bg-card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground truncate text-sm">{post.title}</p>
                  <Badge variant={post.isPublished ? "default" : "secondary"} className="text-[10px]">
                    {post.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.excerpt}</p>
                {post.publishedAt && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(post.publishedAt).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => togglePublish.mutate({ id: post.id, current: post.isPublished ?? false })}
                  title={post.isPublished ? "Unpublish" : "Publish"}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {post.isPublished ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
                <Button variant="outline" size="sm" onClick={() => startEdit(post)} className="h-8 px-2 gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { if (confirm(`Delete "${post.title}"?`)) deleteMutation.mutate(post.id); }}
                  className="h-8 px-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MONETIZE SECTION ──────────────────────────────────────────────────────
const AD_SLOT_LABELS: Record<string, string> = {
  blog_banner_top: "Blog — Top Banner",
  blog_inline: "Blog — Inline (mid-article)",
  blog_banner_bottom: "Blog — Bottom Banner",
  recipe_sidebar: "Recipes — Sidebar",
};

function MonetizeSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: slots = [], isLoading } = useQuery<AdSlot[]>({ queryKey: ["/api/ad-slots"] });

  const updateMutation = useMutation({
    mutationFn: ({ slotName, data }: { slotName: string; data: Partial<AdSlot> }) =>
      apiRequest("PUT", `/api/ad-slots/${slotName}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ad-slots"] }); toast({ title: "Ad slot saved" }); },
    onError: () => toast({ title: "Failed to save ad slot", variant: "destructive" }),
  });

  const [drafts, setDrafts] = useState<Record<string, { htmlCode: string; isActive: boolean }>>({});

  const getDraft = (slotName: string, field: "htmlCode" | "isActive", fallback: string | boolean) => {
    if (drafts[slotName] !== undefined && (drafts[slotName] as any)[field] !== undefined) return (drafts[slotName] as any)[field];
    return fallback;
  };

  const setDraft = (slotName: string, field: "htmlCode" | "isActive", value: string | boolean) => {
    setDrafts(prev => {
      const existing = prev[slotName] ?? { htmlCode: "", isActive: false };
      return { ...prev, [slotName]: { ...existing, [field]: value } };
    });
  };

  const slotMap = Object.fromEntries(slots.map(s => [s.slotName, s]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold font-serif text-foreground">Ad Slot Monetization</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste any ad network HTML/JS snippet into a slot. Toggle each slot on/off. Active slots render live on the blog.
        </p>
      </div>
      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="space-y-5">
          {AD_SLOT_NAMES.map(slotName => {
            const slot = slotMap[slotName];
            const htmlCode = getDraft(slotName, "htmlCode", slot?.htmlCode ?? "") as string;
            const isActive = getDraft(slotName, "isActive", slot?.isActive ?? false) as boolean;
            return (
              <div key={slotName} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{AD_SLOT_LABELS[slotName] ?? slotName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{slotName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={v => setDraft(slotName, "isActive", v)}
                      id={`slot-active-${slotName}`}
                    />
                    <Label htmlFor={`slot-active-${slotName}`} className="text-xs text-muted-foreground">
                      {isActive ? "Active" : "Inactive"}
                    </Label>
                  </div>
                </div>
                <Textarea
                  value={htmlCode}
                  onChange={e => setDraft(slotName, "htmlCode", e.target.value)}
                  placeholder="Paste ad HTML/script here (e.g. Google AdSense snippet)…"
                  rows={5}
                  className="font-mono text-xs resize-y"
                />
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ slotName, data: { htmlCode, isActive, label: AD_SLOT_LABELS[slotName] ?? slotName } })}
                  disabled={updateMutation.isPending}
                  className="gap-2"
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save Slot
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SITE CONTENT SECTION ──────────────────────────────────────────────────

const CONTENT_FIELDS: Array<{ key: string; label: string; description: string; multiline?: boolean }> = [
  { key: "hero_badge", label: "Hero Badge Text", description: "Small pill badge at the top of the hero section" },
  { key: "hero_headline_1", label: "Hero Headline — Line 1", description: "First line of the large hero heading" },
  { key: "hero_headline_accent", label: "Hero Headline — Accent Word", description: "The highlighted terracotta-coloured word(s) in the hero heading" },
  { key: "hero_headline_2", label: "Hero Headline — Line 2", description: "Second line of the hero heading (e.g. \"on your terms\")" },
  { key: "hero_description", label: "Hero Description", description: "Paragraph text below the hero headline", multiline: true },
  { key: "hero_cta_primary", label: "Hero Primary Button", description: "Text on the main call-to-action button" },
  { key: "hero_cta_secondary", label: "Hero Secondary Button", description: "Text on the secondary button" },
  { key: "section_how_title", label: "How It Works — Heading", description: "Section heading for the three-step explainer" },
  { key: "section_cuisines_title", label: "Cuisines Section — Heading", description: "Heading for the cuisine types section" },
  { key: "section_cuisines_description", label: "Cuisines Section — Description", description: "Description text for the cuisine pills section", multiline: true },
  { key: "section_community_title", label: "Community Section — Heading", description: "Heading for the testimonials section" },
  { key: "section_community_description", label: "Community Section — Description", description: "Subtitle below the testimonials heading", multiline: true },
  { key: "cta_headline_main", label: "Final CTA — Headline", description: "Main text of the final call-to-action (before the accent word)" },
  { key: "cta_headline_accent", label: "Final CTA — Accent Word", description: "The highlighted word at the end of the CTA headline" },
  { key: "cta_description", label: "Final CTA — Description", description: "Paragraph below the CTA headline", multiline: true },
  { key: "cta_button", label: "Final CTA — Button Text", description: "Text on the final join button" },
  { key: "footer_tagline", label: "Footer Tagline", description: "Short tagline shown in the footer" },
];

function SiteContentSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: savedContent = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-content"],
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Seed draft from saved content when it loads
  const mergedValues = (key: string) => draft[key] ?? savedContent[key] ?? SITE_CONTENT_DEFAULTS[key] ?? "";

  const handleChange = (key: string, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const entries = CONTENT_FIELDS.map(f => ({ key: f.key, value: mergedValues(f.key) }));
      return apiRequest("PUT", "/api/site-content", entries);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-content"] });
      setDraft({});
      setHasChanges(false);
      toast({ title: "Landing page updated!", description: "Changes are live on your site." });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const resetField = (key: string) => {
    setDraft(prev => ({ ...prev, [key]: SITE_CONTENT_DEFAULTS[key] ?? "" }));
    setHasChanges(true);
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-serif text-foreground">Landing Page Content</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Edit any text shown on the public landing page. Changes go live immediately after saving.</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasChanges}
          className="gap-2 flex-shrink-0"
          data-testid="button-save-site-content"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
          <span className="font-semibold">Unsaved changes</span> — click "Save Changes" to publish them.
        </div>
      )}

      <div className="space-y-5">
        {CONTENT_FIELDS.map(field => (
          <div key={field.key} className="bg-background border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <label className="text-sm font-semibold text-foreground">{field.label}</label>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{field.description}</p>
              </div>
              <button
                onClick={() => resetField(field.key)}
                className="text-xs text-muted-foreground hover:text-foreground underline flex-shrink-0 mt-0.5"
                title="Reset to default"
              >
                Reset
              </button>
            </div>
            {field.multiline ? (
              <Textarea
                value={mergedValues(field.key)}
                onChange={e => handleChange(field.key, e.target.value)}
                className="text-sm min-h-[80px] resize-y"
                data-testid={`input-content-${field.key}`}
              />
            ) : (
              <Input
                value={mergedValues(field.key)}
                onChange={e => handleChange(field.key, e.target.value)}
                className="text-sm"
                data-testid={`input-content-${field.key}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasChanges}
          className="gap-2"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}

const ADMIN_TABS: { id: AdminTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "recipes", label: "Recipes", icon: <UtensilsCrossed size={15} />, desc: "Create, edit, delete any recipe" },
  { id: "community", label: "Community", icon: <Users size={15} />, desc: "Moderate messages" },
  { id: "commerce", label: "Commerce", icon: <ShoppingBag size={15} />, desc: "Affiliate link slots" },
  { id: "feedback", label: "Feedback", icon: <MessageSquare size={15} />, desc: "Reply to users" },
  { id: "images", label: "Images", icon: <ImageIcon size={15} />, desc: "Generate & fix AI images" },
  { id: "blog", label: "Blog Posts", icon: <PenSquare size={15} />, desc: "Write & manage blog posts" },
  { id: "monetize", label: "Monetize", icon: <DollarSign size={15} />, desc: "Ad slot configuration" },
  { id: "content", label: "Page Content", icon: <FileText size={15} />, desc: "Edit landing page text" },
];

export default function AdminPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("recipes");

  const { data: profile } = useQuery<{ isAdmin: boolean }>({ queryKey: ["/api/my-profile"] });
  const { data: affiliateLinks = [], isLoading: linksLoading } = useQuery<AffiliateLink[]>({
    queryKey: ["/api/affiliate-links"],
    enabled: profile?.isAdmin === true,
  });
  const { data: feedback = [] } = useQuery<UserFeedback[]>({
    queryKey: ["/api/admin/feedback"],
    enabled: profile?.isAdmin === true,
  });
  const unreadFeedback = feedback.filter(f => !f.adminResponse).length;

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!profile.isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-5xl">🔒</div>
      <h1 className="text-xl font-bold text-foreground">Admin Access Only</h1>
      <p className="text-muted-foreground text-sm text-center">This page is restricted to authorised administrators.</p>
      <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to App
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="ml-2">
            <h1 className="text-2xl font-bold font-serif text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Palate Lit — Site Management</p>
          </div>
        </div>

        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Sidebar nav */}
          <aside className="lg:w-52 flex-shrink-0">
            <nav className="space-y-1 lg:sticky lg:top-6">
              {ADMIN_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`admin-tab-${tab.id}`}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="mt-0.5 flex-shrink-0">{tab.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold">{tab.label}</p>
                      {tab.id === "feedback" && unreadFeedback > 0 && (
                        <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{unreadFeedback}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight hidden lg:block">{tab.desc}</p>
                  </div>
                </button>
              ))}
            </nav>

            {/* Quick reference */}
            <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2 hidden lg:block">
              <p className="font-semibold text-foreground">What you can do:</p>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                <li>Create/edit/delete any recipe</li>
                <li>Move recipes between Dishes, Sweets, Drinks tabs</li>
                <li>Set cuisine & dietary tags</li>
                <li>Regen/fix AI images</li>
                <li>Moderate community messages</li>
                <li>Reply to user feedback</li>
                <li>Manage affiliate commerce links</li>
                <li>Create/toggle weekly challenges</li>
                <li>Edit landing page text (Page Content tab)</li>
              </ul>
              <p className="text-[10px] text-muted-foreground pt-1">Weekly Challenge controls are in the Challenge tab of the main app.</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 border border-border rounded-2xl p-5 bg-card">
            {activeTab === "recipes" && <RecipeManagementSection />}
            {activeTab === "community" && <CommunityModerationSection />}
            {activeTab === "commerce" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold font-serif text-foreground">Smart Commerce</h2>
                  <p className="text-sm text-muted-foreground">Affiliate link slots shown in every recipe. Updates apply site-wide immediately.</p>
                </div>
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold">How Deep Links work:</p>
                  <p>• <strong>Amazon:</strong> <code>amzn://link.amazon.in/redirect?url=…</code></p>
                  <p>• <strong>Blinkit:</strong> <code>blinkit://search?q=…</code></p>
                  <p>• <strong>Flipkart:</strong> <code>flipkart://search?q=…</code></p>
                  <p className="pt-1">Falls back to Web URL after 1.5s if app isn't installed.</p>
                </div>
                {linksLoading ? (
                  <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}</div>
                ) : (
                  <div className="space-y-4">{affiliateLinks.map(link => <AffiliateLinkEditor key={link.slot} link={link} />)}</div>
                )}
              </div>
            )}
            {activeTab === "feedback" && <FeedbackSection />}
            {activeTab === "images" && <ImageManagementSection />}
            {activeTab === "blog" && <BlogManagementSection />}
            {activeTab === "monetize" && <MonetizeSection />}
            {activeTab === "content" && <SiteContentSection />}
          </main>
        </div>
      </div>
    </div>
  );
}
