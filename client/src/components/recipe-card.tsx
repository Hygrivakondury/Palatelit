import { Badge } from "@/components/ui/badge";
import { Clock, Users, ChefHat } from "lucide-react";
import type { Recipe } from "@shared/schema";

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

const cuisineColors: Record<string, string> = {
  "North Indian": "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  "South Indian": "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  "Gujarati": "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
  "Punjabi": "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900",
  "Bengali": "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900",
  "Rajasthani": "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900",
  "Maharashtrian": "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
  "Fusion": "bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900",
  "Pan-Indian": "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900",
  "East Indian": "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900",
  "West Indian": "bg-lime-50 text-lime-700 border-lime-100 dark:bg-lime-950/30 dark:text-lime-400 dark:border-lime-900",
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

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const totalTime = recipe.prepTime + recipe.cookTime;
  const badgeClass = cuisineColors[recipe.cuisineType] ?? "bg-muted text-muted-foreground border-border";
  const emoji = cuisineEmojis[recipe.cuisineType] ?? "🍽️";

  return (
    <div
      data-testid={`card-recipe-${recipe.id}`}
      onClick={onClick}
      className="group bg-card border border-card-border rounded-2xl overflow-hidden cursor-pointer hover-elevate active-elevate transition-all duration-200 flex flex-col"
    >
      {/* Image / Placeholder */}
      <div className="relative w-full h-44 bg-gradient-to-br from-primary/10 via-primary/5 to-accent overflow-hidden flex-shrink-0">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">{emoji}</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass}`}>
            {recipe.cuisineType}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif text-base font-bold text-card-foreground leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
          {recipe.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed flex-1">
          {recipe.description}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{totalTime} min</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>{recipe.servings} servings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ChefHat className="w-3.5 h-3.5 text-primary" />
            <span>{recipe.ingredients.length} ingredients</span>
          </div>
        </div>
      </div>
    </div>
  );
}
