import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Users, ChefHat, CheckCircle2, Flame } from "lucide-react";
import type { Recipe } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
}

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

export default function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  const emoji = cuisineEmojis[recipe.cuisineType] ?? "🍽️";
  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="modal-recipe-detail"
        className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl border border-card-border"
      >
        {/* Header Image / Banner */}
        <div className="relative w-full h-52 bg-gradient-to-br from-primary/20 via-primary/10 to-accent overflow-hidden flex-shrink-0">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-8xl">{emoji}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-primary text-primary-foreground border-0 text-xs">
                {recipe.cuisineType}
              </Badge>
              <Badge variant="outline" className="bg-background/70 backdrop-blur-sm border-border text-xs">
                Vegetarian
              </Badge>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="p-6 space-y-6">
            {/* Title & Description */}
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-serif text-2xl font-bold text-foreground leading-snug">
                {recipe.title}
              </DialogTitle>
              <p className="text-muted-foreground text-sm leading-relaxed">{recipe.description}</p>
            </DialogHeader>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Clock className="w-4 h-4 text-primary" />, label: "Prep", value: `${recipe.prepTime} min` },
                { icon: <Flame className="w-4 h-4 text-primary" />, label: "Cook", value: `${recipe.cookTime} min` },
                { icon: <Users className="w-4 h-4 text-primary" />, label: "Serves", value: `${recipe.servings}` },
              ].map((stat) => (
                <div key={stat.label} className="bg-muted/50 rounded-xl p-3 text-center space-y-1 border border-border">
                  <div className="flex justify-center">{stat.icon}</div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-sm font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            <Separator className="bg-border" />

            {/* Ingredients */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-primary" />
                <h3 className="font-serif text-lg font-bold text-foreground">Ingredients</h3>
                <span className="text-xs text-muted-foreground ml-auto">{recipe.ingredients.length} items</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {recipe.ingredients.map((ingredient, i) => (
                  <div
                    key={i}
                    data-testid={`ingredient-${i}`}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{ingredient}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Instructions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <h3 className="font-serif text-lg font-bold text-foreground">Instructions</h3>
              </div>
              <ol className="space-y-4">
                {recipe.instructions.map((step, i) => (
                  <li
                    key={i}
                    data-testid={`step-${i + 1}`}
                    className="flex gap-4"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="h-2" />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
