import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import RecipeCard from "@/components/recipe-card";
import RecipeDetailModal from "@/components/recipe-detail-modal";
import { Search, Leaf, ChefHat, X, LogOut, User, Sparkles, SlidersHorizontal, Heart } from "lucide-react";
import type { Recipe, Favorite } from "@shared/schema";
import { CUISINE_TYPES } from "@shared/schema";

const DIETARY_FILTER_OPTIONS = ["All", "Vegan", "Gluten-Free", "Jain Friendly"] as const;

export default function HomePage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [selectedDietary, setSelectedDietary] = useState<string>("All");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes", { search: activeSearch, cuisine: selectedCuisine === "All" ? "" : selectedCuisine }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeSearch) params.set("search", activeSearch);
      if (selectedCuisine !== "All") params.set("cuisine", selectedCuisine);
      const res = await fetch(`/api/recipes?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recipes");
      return res.json();
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

  const filteredRecipes = recipes.filter((r) => {
    if (showFavoritesOnly && !favoritedRecipeIds.has(r.id)) return false;
    if (selectedDietary !== "All" && !r.dietaryTags?.includes(selectedDietary as any)) return false;
    return true;
  });

  const handleSearch = () => setActiveSearch(searchQuery);
  const handleClearSearch = () => { setSearchQuery(""); setActiveSearch(""); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const cuisineOptions = ["All", ...CUISINE_TYPES];

  const userInitials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() || user.email?.[0]?.toUpperCase() || "U"
    : "U";

  const isFiltering = activeSearch || selectedCuisine !== "All" || selectedDietary !== "All" || showFavoritesOnly;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-bold text-foreground tracking-tight hidden sm:block">Flavour Genie</span>
          </div>

          {/* Genie Filter Search Bar */}
          <div className="flex-1 max-w-2xl flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input
                type="search"
                placeholder="Type ingredients you have (e.g. paneer, spinach, tomato...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 pr-10 h-10 bg-muted/50 border-border focus:bg-background"
                data-testid="input-genie-search"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} className="h-10 px-5 gap-1.5" data-testid="button-search">
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Search</span>
            </Button>
          </div>

          {/* User Menu */}
          {authLoading ? (
            <Skeleton className="w-9 h-9 rounded-full" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="button-user-menu" className="focus:outline-none">
                  <Avatar className="w-9 h-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all">
                    <AvatarImage src={user?.profileImageUrl ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
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
                </div>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  data-testid="menu-item-favorites"
                >
                  <Heart className="w-4 h-4" /> My Favourites
                  {favoritedRecipeIds.size > 0 && (
                    <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {favoritedRecipeIds.size}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/api/logout" className="gap-2 cursor-pointer text-destructive focus:text-destructive" data-testid="menu-item-logout">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8 space-y-2">
          <h1 className="font-serif text-3xl font-bold text-foreground">
            {showFavoritesOnly ? "My Favourites" : activeSearch ? `Results for "${activeSearch}"` : "Discover Recipes"}
          </h1>
          <p className="text-muted-foreground">
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? "s" : ""}
            {showFavoritesOnly ? " saved" : activeSearch ? " found" : " — Explore India's finest vegetarian cooking"}
          </p>
        </div>

        {/* Filter rows */}
        <div className="space-y-4 mb-8">
          {/* Cuisine filter */}
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
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
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

          {/* Dietary + Favorites filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dietary</span>
            </div>
            {DIETARY_FILTER_OPTIONS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedDietary(tag)}
                data-testid={`filter-dietary-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
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
                className={`ml-2 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${
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

        {/* Active Filter Banner */}
        {isFiltering && (
          <div className="mb-6 flex items-center gap-3 p-3 bg-accent/50 border border-accent-border rounded-xl">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm text-accent-foreground flex-1 truncate">
              {activeSearch && <><span className="font-semibold">Ingredients:</span> "{activeSearch}" · </>}
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

        {/* Recipes Grid */}
        {recipesLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                <Skeleton className="w-full h-44" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-1.5 mt-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              {showFavoritesOnly ? <Heart className="w-10 h-10 text-muted-foreground" /> : <ChefHat className="w-10 h-10 text-muted-foreground" />}
            </div>
            <h3 className="font-serif text-2xl font-bold text-foreground">
              {showFavoritesOnly ? "No Favourites Yet" : "No Recipes Found"}
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {showFavoritesOnly
                ? "Save recipes you love by clicking the heart icon in any recipe."
                : activeSearch
                ? `We couldn't find recipes with "${activeSearch}". Try different ingredients.`
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => setSelectedRecipe(recipe)}
                isFavorited={favoritedRecipeIds.has(recipe.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Recipe Detail Modal */}
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
    </div>
  );
}
