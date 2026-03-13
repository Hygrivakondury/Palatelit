import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RecipeCard from "@/components/recipe-card";
import RecipeDetailModal from "@/components/recipe-detail-modal";
import { SmartChefChat } from "@/components/smart-chef-chat";
import { CommunityTab } from "@/components/community-tab";
import { WeeklyChallengeTab } from "@/components/weekly-challenge-tab";
import { PantryGenieTab } from "@/components/pantry-genie-tab";
import { MealPlanTab } from "@/components/meal-plan-tab";
import {
  Search, ChefHat, X, LogOut, Heart, Sparkles,
  SlidersHorizontal, UtensilsCrossed, Users, Trophy, ShoppingBag, CalendarDays,
  Candy, GlassWater, MessageSquare, Loader2
} from "lucide-react";
import type { Recipe, Favorite, UserProfile } from "@shared/schema";
import logoImg from "@assets/Palate_Lit_1773224307175.jpg";
import { CUISINE_TYPES } from "@shared/schema";

const DIETARY_FILTER_OPTIONS = ["All", "Vegan", "Gluten-Free", "Jain Friendly"] as const;
type TabId = "recipes" | "community" | "challenge" | "pantry" | "mealplan";
type RecipeSubTab = "main" | "dessert" | "mocktail";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "recipes", label: "Recipes", icon: <UtensilsCrossed size={16} /> },
  { id: "community", label: "Community", icon: <Users size={16} /> },
  { id: "challenge", label: "Weekly Challenge", icon: <Trophy size={16} /> },
  { id: "pantry", label: "Pantry", icon: <ShoppingBag size={16} /> },
  { id: "mealplan", label: "Meal Plan", icon: <CalendarDays size={16} /> },
];

const RECIPE_SUB_TABS: { id: RecipeSubTab; label: string; icon: React.ReactNode; placeholder: string; emptyLabel: string; tagline: string }[] = [
  {
    id: "main",
    label: "Dishes",
    icon: <UtensilsCrossed size={15} />,
    placeholder: "Type ingredients (e.g. paneer, spinach…)",
    emptyLabel: "No Dishes Found",
    tagline: "Explore India's finest vegetarian cooking",
  },
  {
    id: "dessert",
    label: "Desserts & Sweets",
    icon: <Candy size={15} />,
    placeholder: "Search sweets (e.g. jalebi, barfi, rasgulla…)",
    emptyLabel: "No Sweets Found",
    tagline: "India's most beloved mithai, halwas and festive sweets",
  },
  {
    id: "mocktail",
    label: "Mocktails & Juices",
    icon: <GlassWater size={15} />,
    placeholder: "Search drinks (e.g. lassi, thandai, aam panna…)",
    emptyLabel: "No Drinks Found",
    tagline: "Refreshing Indian drinks, sharbats and mocktails",
  },
];

export default function HomePage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("recipes");
  const [recipeSubTab, setRecipeSubTab] = useState<RecipeSubTab>("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [selectedDietary, setSelectedDietary] = useState<string>("All");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const feedbackMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feedback", { message: feedbackMessage }),
    onSuccess: () => {
      setShowFeedbackDialog(false);
      setFeedbackMessage("");
      toast({ title: "Feedback sent!", description: "Thank you — the team will review it shortly." });
    },
    onError: () => toast({ title: "Failed to send feedback", variant: "destructive" }),
  });

  const currentUserId: string = (user as any)?.id ?? (user as any)?.claims?.sub ?? "";
  const activeSubTabMeta = RECIPE_SUB_TABS.find((s) => s.id === recipeSubTab)!;

  const { data: myProfile } = useQuery<UserProfile | null>({
    queryKey: ["/api/my-profile"],
    queryFn: async () => {
      const res = await fetch("/api/my-profile", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes", { search: activeSearch, cuisine: selectedCuisine === "All" ? "" : selectedCuisine, category: recipeSubTab }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeSearch) params.set("search", activeSearch);
      if (selectedCuisine !== "All") params.set("cuisine", selectedCuisine);
      params.set("category", recipeSubTab);
      const res = await fetch(`/api/recipes?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recipes");
      return res.json();
    },
    enabled: activeTab === "recipes",
    // Poll every 8s while any user-submitted recipe is still waiting for its AI image
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((r: Recipe) => r.isUserSubmitted && !r.imageUrl) ? 8000 : false;
    },
  });

  const { data: userFavorites = [] } = useQuery<Favorite[]>({
    queryKey: ["/api/favorites"],
    queryFn: async () => {
      const res = await fetch("/api/favorites", { credentials: "include" });
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const favoritedRecipeIds = new Set(userFavorites.map((f) => f.recipeId));

  // Auto-open recipe from shared link: ?recipe=123
  useEffect(() => {
    if (recipesLoading || recipes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get("recipe");
    if (!recipeId) return;
    const found = recipes.find((r) => r.id === parseInt(recipeId, 10));
    if (found) {
      setSelectedRecipe(found);
      // Clean up URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("recipe");
      window.history.replaceState({}, "", url.toString());
    } else {
      // Recipe might be in another sub-tab — fetch it directly
      fetch(`/api/recipes/${recipeId}`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((recipe) => {
          if (recipe) {
            setSelectedRecipe(recipe);
            const url = new URL(window.location.href);
            url.searchParams.delete("recipe");
            window.history.replaceState({}, "", url.toString());
          }
        })
        .catch(() => {});
    }
  }, [recipes, recipesLoading]);

  const filteredRecipes = recipes.filter((r) => {
    if (showFavoritesOnly && !favoritedRecipeIds.has(r.id)) return false;
    if (selectedDietary !== "All" && !r.dietaryTags?.includes(selectedDietary as any)) return false;
    return true;
  });

  const handleSearch = () => setActiveSearch(searchQuery);
  const handleClearSearch = () => { setSearchQuery(""); setActiveSearch(""); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const handleSubTabChange = (subTab: RecipeSubTab) => {
    setRecipeSubTab(subTab);
    setSearchQuery("");
    setActiveSearch("");
    setSelectedCuisine("All");
    setSelectedDietary("All");
    setShowFavoritesOnly(false);
  };

  const cuisineOptions = ["All", ...CUISINE_TYPES];
  const isFiltering = activeSearch || selectedCuisine !== "All" || selectedDietary !== "All" || showFavoritesOnly;

  const userInitials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() || user.email?.[0]?.toUpperCase() || "U"
    : "U";

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src={logoImg} alt="Palate Lit logo" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-serif text-lg font-bold text-foreground tracking-tight hidden sm:block">Palate Lit</span>
          </div>

          {activeTab === "recipes" && (
            <div className="flex-1 max-w-2xl flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary" />
                <Input
                  type="search"
                  placeholder={activeSubTabMeta.placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9 pr-9 h-9 bg-muted/50 border-border focus:bg-background text-sm"
                  data-testid="input-genie-search"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-clear-search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button onClick={handleSearch} className="h-9 px-4 gap-1.5" data-testid="button-search">
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:block text-sm">Search</span>
              </Button>
            </div>
          )}

          {(activeTab === "community" || activeTab === "challenge") && (
            <div className="flex-1 flex justify-center">
              <span className="font-serif text-base font-bold text-foreground sm:hidden">Palate Lit</span>
            </div>
          )}

          {authLoading ? (
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="button-user-menu" className="focus:outline-none flex-shrink-0">
                  <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all">
                    <AvatarImage src={user?.profileImageUrl ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email ?? "Guest"}
                  </p>
                  {user?.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                  {myProfile?.isAdmin && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block">
                      Admin
                    </span>
                  )}
                </div>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-foreground focus:text-foreground"
                  onClick={() => { setActiveTab("recipes"); setShowFavoritesOnly((v) => !v); }}
                  data-testid="menu-item-favorites"
                >
                  <Heart className="w-4 h-4" /> My Favourites
                  {favoritedRecipeIds.size > 0 && (
                    <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {favoritedRecipeIds.size}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-foreground focus:text-foreground"
                  onClick={() => setShowFeedbackDialog(true)}
                  data-testid="menu-item-feedback"
                >
                  <MessageSquare className="w-4 h-4" /> Share Feedback
                </DropdownMenuItem>
                {myProfile?.isAdmin && (
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                    onClick={() => navigate("/admin")}
                    data-testid="menu-item-admin"
                  >
                    <ShoppingBag className="w-4 h-4" /> Smart Commerce
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <a href="/api/logout" className="gap-2 cursor-pointer text-destructive focus:text-destructive" data-testid="menu-item-logout">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Desktop Tab Bar */}
        <div className="hidden sm:flex border-t border-border/50 max-w-7xl mx-auto px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-testid={`mobile-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span className={`${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`}>
              {tab.icon}
            </span>
            <span className="leading-none">{tab.id === "challenge" ? "Challenge" : tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "recipes" && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

          {/* Recipe Sub-Tabs */}
          <div className="flex gap-1 mb-6 bg-muted/40 rounded-xl p-1 w-fit">
            {RECIPE_SUB_TABS.map((sub) => (
              <button
                key={sub.id}
                data-testid={`recipe-subtab-${sub.id}`}
                onClick={() => handleSubTabChange(sub.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  recipeSubTab === sub.id
                    ? "bg-background shadow-sm text-primary border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sub.icon}
                <span className="hidden sm:inline">{sub.label}</span>
                <span className="sm:hidden">
                  {sub.id === "main" ? "Dishes" : sub.id === "dessert" ? "Desserts" : "Drinks"}
                </span>
              </button>
            ))}
          </div>

          <div className="mb-6 space-y-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
              {showFavoritesOnly ? "My Favourites" : activeSearch ? `Results for "${activeSearch}"` : activeSubTabMeta.label}
            </h1>
            <p className="text-muted-foreground text-sm">
              {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? "s" : ""}
              {showFavoritesOnly ? " saved" : activeSearch ? " found" : ` — ${activeSubTabMeta.tagline}`}
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cuisine</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cuisineOptions.map((cuisine) => (
                  <button
                    key={cuisine}
                    onClick={() => setSelectedCuisine(cuisine)}
                    data-testid={`filter-cuisine-${cuisine.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      selectedCuisine === cuisine
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-card-border hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    {cuisine}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1">Dietary</span>
              {DIETARY_FILTER_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedDietary(tag)}
                  data-testid={`filter-dietary-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedDietary === tag
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-card-border hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  {tag === "Vegan" && "🌱 "}{tag === "Gluten-Free" && "🌾 "}{tag === "Jain Friendly" && "🙏 "}
                  {tag}
                </button>
              ))}
              {isAuthenticated && (
                <button
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  data-testid="filter-favorites"
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${
                    showFavoritesOnly
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-card text-foreground border-card-border hover:border-red-300 hover:bg-red-50"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-white" : ""}`} />
                  Favourites
                  {favoritedRecipeIds.size > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${showFavoritesOnly ? "bg-white/20" : "bg-primary/10 text-primary"}`}>
                      {favoritedRecipeIds.size}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {isFiltering && (
            <div className="mb-5 flex items-center gap-3 p-3 bg-accent/50 border border-accent-border rounded-xl">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm text-accent-foreground flex-1 truncate">
                {activeSearch && <><span className="font-semibold">Search:</span> "{activeSearch}" · </>}
                {selectedCuisine !== "All" && <><span className="font-semibold">Cuisine:</span> {selectedCuisine} · </>}
                {selectedDietary !== "All" && <><span className="font-semibold">Dietary:</span> {selectedDietary} · </>}
                {showFavoritesOnly && <span className="font-semibold">❤️ Favourites only</span>}
              </p>
              <button
                onClick={() => { handleClearSearch(); setSelectedCuisine("All"); setSelectedDietary("All"); setShowFavoritesOnly(false); }}
                className="text-xs text-accent-foreground underline hover:no-underline flex-shrink-0"
                data-testid="button-clear-all-filters"
              >
                Clear all
              </button>
            </div>
          )}

          {recipesLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                  <Skeleton className="w-full h-44" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                {showFavoritesOnly ? <Heart className="w-8 h-8 text-muted-foreground" /> : <ChefHat className="w-8 h-8 text-muted-foreground" />}
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground">
                {showFavoritesOnly ? "No Favourites Yet" : activeSubTabMeta.emptyLabel}
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                {showFavoritesOnly
                  ? "Save recipes you love by clicking the heart icon in any recipe."
                  : activeSearch
                  ? `We couldn't find ${recipeSubTab === "main" ? "dishes" : recipeSubTab === "dessert" ? "sweets" : "drinks"} with "${activeSearch}". Try different terms.`
                  : "No recipes match your filters. Try adjusting them."}
              </p>
              <Button
                variant="outline"
                onClick={() => { handleClearSearch(); setSelectedCuisine("All"); setSelectedDietary("All"); setShowFavoritesOnly(false); }}
                data-testid="button-clear-filters-empty"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => setSelectedRecipe(recipe)}
                  isFavorited={favoritedRecipeIds.has(recipe.id)}
                  isAdmin={myProfile?.isAdmin ?? false}
                />
              ))}
            </div>
          )}

          {selectedRecipe && (
            <RecipeDetailModal
              recipe={selectedRecipe}
              onClose={() => setSelectedRecipe(null)}
              onRecipeUpdated={(updated) => {
                setSelectedRecipe(updated);
                queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
              }}
            />
          )}
        </main>
      )}

      {activeTab === "community" && (
        <CommunityTab
          currentUserId={currentUserId}
          onRecipeUpdated={() => queryClient.invalidateQueries({ queryKey: ["/api/recipes/community"] })}
          isAdmin={myProfile?.isAdmin ?? false}
        />
      )}

      {activeTab === "challenge" && (
        <WeeklyChallengeTab
          profile={myProfile ?? null}
          currentUserId={currentUserId}
        />
      )}

      {activeTab === "pantry" && (
        <PantryGenieTab
          onSelectRecipe={(recipe) => {
            setSelectedRecipe(recipe);
            setActiveTab("recipes");
          }}
        />
      )}

      {activeTab === "mealplan" && (
        <MealPlanTab
          onViewRecipe={(recipe) => {
            setSelectedRecipe(recipe);
            setActiveTab("recipes");
          }}
        />
      )}

      <SmartChefChat
        recipeContext={selectedRecipe ? selectedRecipe.title : null}
      />

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={(open) => { setShowFeedbackDialog(open); if (!open) setFeedbackMessage(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Share Your Feedback
            </DialogTitle>
            <DialogDescription>
              Tell us what you love, what you'd like to see, or anything else on your mind. We read every message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Textarea
              data-testid="input-feedback-message"
              placeholder="Your feedback…"
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => { setShowFeedbackDialog(false); setFeedbackMessage(""); }}
                data-testid="button-feedback-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={() => feedbackMutation.mutate()}
                disabled={!feedbackMessage.trim() || feedbackMutation.isPending}
                data-testid="button-feedback-submit"
                className="gap-2"
              >
                {feedbackMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                {feedbackMutation.isPending ? "Sending…" : "Send Feedback"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
