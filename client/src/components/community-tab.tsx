import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock, Users, ChefHat, Eye } from "lucide-react";
import { CommunityChat } from "@/components/community-chat";
import RecipeDetailModal from "@/components/recipe-detail-modal";
import type { Recipe } from "@shared/schema";

interface CommunityTabProps {
  currentUserId: string;
  onRecipeUpdated?: (recipe: Recipe) => void;
}

export function CommunityTab({ currentUserId, onRecipeUpdated }: CommunityTabProps) {
  const [chatRecipe, setChatRecipe] = useState<Recipe | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes/community"],
    queryFn: async () => {
      const res = await fetch("/api/recipes/community", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load community recipes");
      return res.json();
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Community Recipes</h2>
        <p className="text-neutral-500 text-sm mt-1">
          Recipes created by our community — click chat to connect with the chef!
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-neutral-200 bg-white">
              <Skeleton className="h-40 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <Users size={28} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-neutral-700 font-semibold">No community recipes yet</p>
            <p className="text-neutral-500 text-sm mt-1">Be the first! Submit a recipe in the Weekly Challenge tab.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              data-testid={`community-card-${recipe.id}`}
              className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="relative h-36 bg-emerald-50 dark:bg-emerald-950 overflow-hidden flex-shrink-0">
                {recipe.imageUrl ? (
                  <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat size={36} className="text-emerald-300" />
                  </div>
                )}
                {recipe.challengeId && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-amber-500 text-white text-xs">Challenge</Badge>
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm leading-tight line-clamp-2">
                    {recipe.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{recipe.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={recipe.submittedByImage ?? undefined} />
                    <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                      {(recipe.submittedByName ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                    {recipe.submittedByName ?? "Community Member"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)}m
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span>{recipe.cuisineType}</span>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button
                    data-testid={`button-view-recipe-${recipe.id}`}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setViewRecipe(recipe)}
                  >
                    <Eye size={13} className="mr-1" /> View
                  </Button>
                  <Button
                    data-testid={`button-chat-recipe-${recipe.id}`}
                    size="sm"
                    className="flex-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setChatRecipe(recipe)}
                  >
                    <MessageCircle size={13} className="mr-1" /> Chat
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {chatRecipe && (
        <CommunityChat
          recipe={chatRecipe}
          currentUserId={currentUserId}
          onClose={() => setChatRecipe(null)}
        />
      )}

      {viewRecipe && (
        <RecipeDetailModal
          recipe={viewRecipe}
          onClose={() => setViewRecipe(null)}
          onRecipeUpdated={(updated) => {
            setViewRecipe(updated);
            onRecipeUpdated?.(updated);
          }}
        />
      )}
    </div>
  );
}
