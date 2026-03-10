import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import RecipeCard from "@/components/recipe-card";
import RecipeDetailModal from "@/components/recipe-detail-modal";
import { Search, Leaf, ChefHat, X, LogOut, User, Sparkles, SlidersHorizontal } from "lucide-react";
import type { Recipe } from "@shared/schema";
import { CUISINE_TYPES } from "@shared/schema";

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

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

  const handleSearch = () => {
    setActiveSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const cuisineOptions = ["All", ...CUISINE_TYPES];
  const isFiltering = activeSearch || selectedCuisine !== "All";

  const userInitials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() || user.email?.[0]?.toUpperCase() || "U"
    : "U";

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
            <Button
              onClick={handleSearch}
              className="h-10 px-5 gap-1.5"
              data-testid="button-search"
            >
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
                <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="menu-item-profile">
                  <User className="w-4 h-4" /> Profile
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
            {activeSearch
              ? `Recipes matching "${activeSearch}"`
              : "Discover Recipes"}
          </h1>
          <p className="text-muted-foreground">
            {activeSearch
              ? `${recipes.length} recipe${recipes.length !== 1 ? "s" : ""} found`
              : "Explore India's finest vegetarian cooking"}
          </p>
        </div>

        {/* Cuisine Filter Pills */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filter by Cuisine</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {cuisineOptions.map((cuisine) => (
              <button
                key={cuisine}
                onClick={() => setSelectedCuisine(cuisine)}
                data-testid={`filter-cuisine-${cuisine.toLowerCase().replace(/\s+/g, "-")}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
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

        {/* Active Filter Banner */}
        {isFiltering && (
          <div className="mb-6 flex items-center gap-3 p-3 bg-accent/50 border border-accent-border rounded-xl">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm text-accent-foreground flex-1">
              {activeSearch && <><span className="font-semibold">Genie Filter:</span> Looking for recipes with "{activeSearch}"</>}
              {activeSearch && selectedCuisine !== "All" && " · "}
              {selectedCuisine !== "All" && <><span className="font-semibold">Cuisine:</span> {selectedCuisine}</>}
            </p>
            <button
              onClick={() => { handleClearSearch(); setSelectedCuisine("All"); }}
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
                <Skeleton className="w-full h-48" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <ChefHat className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-foreground">No Recipes Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {activeSearch
                ? `We couldn't find recipes with "${activeSearch}". Try different ingredients or fewer items.`
                : "No recipes match your filters. Try selecting a different cuisine."}
            </p>
            <Button variant="outline" onClick={() => { handleClearSearch(); setSelectedCuisine("All"); }} data-testid="button-clear-filters-empty">
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => setSelectedRecipe(recipe)}
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
        />
      )}
    </div>
  );
}
