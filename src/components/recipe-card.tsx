import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Clock, Users, ChefHat, Heart, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recipe } from "@shared/schema";

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  isFavorited?: boolean;
  isAdmin?: boolean;
}

const cuisineColors: Record<string, string> = {
  "North Indian": "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400",
  "South Indian": "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400",
  "Gujarati": "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400",
  "Punjabi": "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400",
  "Bengali": "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/30 dark:text-sky-400",
  "Rajasthani": "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400",
  "Maharashtrian": "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400",
  "Fusion": "bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/30 dark:text-pink-400",
  "Pan-Indian": "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/30 dark:text-teal-400",
  "East Indian": "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400",
  "West Indian": "bg-lime-50 text-lime-700 border-lime-100 dark:bg-lime-950/30 dark:text-lime-400",
};

const cuisineEmojis: Record<string, string> = {
  "North Indian": "🌶️",
  "South Indian": "🥥",
  "Gujarati": "🫓",
  "Punjabi": "🫘",
  "Bengali": "🍚",
  "Rajasthani": "🏜️",
  "Maharashtrian": "🌿",
  "Fusion": "✨",
  "Pan-Indian": "🇮🇳",
  "East Indian": "🐟",
  "West Indian": "🫚",
};

const dietaryTagStyles: Record<string, string> = {
  "Vegan": "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400",
  "Gluten-Free": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  "Jain Friendly": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400",
};

export default function RecipeCard({ recipe, onClick, isFavorited, isAdmin }: RecipeCardProps) {
  const totalTime = recipe.prepTime + recipe.cookTime;
  const badgeClass = cuisineColors[recipe.cuisineType] ?? "bg-muted text-muted-foreground border-border";
  const emoji = cuisineEmojis[recipe.cuisineType] ?? "🍽️";
  const [imgError, setImgError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/recipes/${recipe.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
      qc.invalidateQueries({ queryKey: ["/api/recipes/community"] });
      toast({ title: "Recipe deleted", description: `"${recipe.title}" has been removed.` });
    },
    onError: () => {
      toast({ title: "Delete failed", description: "Could not delete this recipe.", variant: "destructive" });
    },
  });

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      deleteMutation.mutate();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      data-testid={`card-recipe-${recipe.id}`}
      onClick={onClick}
      className="group bg-card border border-card-border rounded-xl overflow-hidden cursor-pointer hover-elevate active-elevate transition-all duration-200 flex flex-col shadow-sm"
    >
      {/* Image / Placeholder — taller, more image-forward */}
      <div className="relative w-full h-52 bg-muted overflow-hidden flex-shrink-0">
        {recipe.imageUrl && !imgError ? (
          <img
            src={`${recipe.imageUrl}?v=2`}
            alt={recipe.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent/30">
            <span className="text-7xl">{emoji}</span>
          </div>
        )}
        {/* Subtle gradient on hover for title visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Cuisine badge — bottom left, clean */}
        <div className="absolute bottom-3 left-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${badgeClass}`}>
            {emoji} {recipe.cuisineType}
          </span>
        </div>

        {isFavorited && (
          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center shadow-sm">
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
          </div>
        )}
        {isAdmin && (
          <button
            data-testid={`button-delete-recipe-${recipe.id}`}
            onClick={handleDeleteClick}
            disabled={deleteMutation.isPending}
            title={confirmDelete ? "Click again to confirm delete" : "Delete recipe"}
            className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium shadow transition-all ${
              confirmDelete
                ? "bg-red-600 text-white"
                : "bg-white/90 dark:bg-black/70 text-red-500 hover:bg-red-600 hover:text-white"
            }`}
          >
            <Trash2 className="w-3 h-3" />
            {confirmDelete ? "Confirm?" : "Delete"}
          </button>
        )}
      </div>

      {/* Content — clean, spacious */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-serif text-base font-bold text-card-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {recipe.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed flex-1">
          {recipe.description}
        </p>

        {/* Dietary Tags — minimal, only vegan/special */}
        {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {recipe.dietaryTags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                data-testid={`tag-dietary-${recipe.id}-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${dietaryTagStyles[tag] ?? "bg-muted text-muted-foreground border-border"}`}
              >
                {tag === "Vegan" && "🌱 "}
                {tag === "Gluten-Free" && "🌾 "}
                {tag === "Jain Friendly" && "🙏 "}
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary/70" />
            <span>{totalTime} min</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary/70" />
            <span>{recipe.servings} servings</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <ChefHat className="w-3.5 h-3.5 text-primary/70" />
            <span>{recipe.ingredients.length} items</span>
          </div>
        </div>
      </div>
    </div>
  );
}
