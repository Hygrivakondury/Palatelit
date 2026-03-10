import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock, Users, ChefHat, CheckCircle2, Flame, Heart, Star,
  Minus, Plus, Camera, Upload, Loader2, MessageSquare, X
} from "lucide-react";
import type { Recipe, Review } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
  onRecipeUpdated?: (recipe: Recipe) => void;
}

const cuisineEmojis: Record<string, string> = {
  "North Indian": "🌶️", "South Indian": "🥥", "Gujarati": "🫓",
  "Punjabi": "🫘", "Bengali": "🍚", "Rajasthani": "🏜️",
  "Maharashtrian": "🌿", "Fusion": "✨", "Pan-Indian": "🇮🇳",
  "East Indian": "🐟", "West Indian": "🫚",
};

const dietaryTagStyles: Record<string, string> = {
  "Vegan": "bg-green-50 text-green-700 border-green-200",
  "Gluten-Free": "bg-blue-50 text-blue-700 border-blue-200",
  "Jain Friendly": "bg-violet-50 text-violet-700 border-violet-200",
};

function scaleIngredient(ingredient: string, scale: number): string {
  if (scale === 1) return ingredient;
  return ingredient.replace(
    /(\d+(?:\.\d+)?(?:\/\d+)?)\s*(cup|tbsp|tsp|g|kg|ml|l|oz|lb|piece|pieces|sprig|sprigs|clove|cloves)?\b/gi,
    (match, num, unit) => {
      let value = num.includes("/")
        ? num.split("/").reduce((a: number, b: string) => a / parseFloat(b))
        : parseFloat(num);
      const scaled = (value * scale).toFixed(value * scale < 1 ? 2 : value * scale < 10 ? 1 : 0);
      const cleanScaled = scaled.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
      return unit ? `${cleanScaled} ${unit}` : cleanScaled;
    }
  );
}

export default function RecipeDetailModal({ recipe: initialRecipe, onClose, onRecipeUpdated }: RecipeDetailModalProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipe, setRecipe] = useState(initialRecipe);
  const [servingsMultiplier, setServingsMultiplier] = useState(1);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [activeTab, setActiveTab] = useState<"ingredients" | "instructions" | "reviews">("ingredients");

  const emoji = cuisineEmojis[recipe.cuisineType] ?? "🍽️";
  const currentServings = recipe.servings * servingsMultiplier;

  // Favorite state
  const { data: favoriteData } = useQuery<{ favorited: boolean }>({
    queryKey: [`/api/recipes/${recipe.id}/favorite`],
    queryFn: async () => {
      if (!isAuthenticated) return { favorited: false };
      const res = await fetch(`/api/recipes/${recipe.id}/favorite`, { credentials: "include" });
      return res.json();
    },
    enabled: isAuthenticated,
  });
  const isFavorited = favoriteData?.favorited ?? false;

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorited) {
        await apiRequest("DELETE", `/api/recipes/${recipe.id}/favorite`);
      } else {
        await apiRequest("POST", `/api/recipes/${recipe.id}/favorite`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recipes/${recipe.id}/favorite`] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: isFavorited ? "Removed from favorites" : "Added to favorites",
        description: isFavorited ? `${recipe.title} removed` : `${recipe.title} saved!`,
      });
    },
  });

  // Reviews
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: [`/api/recipes/${recipe.id}/reviews`],
    queryFn: async () => {
      const res = await fetch(`/api/recipes/${recipe.id}/reviews`, { credentials: "include" });
      return res.json();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/recipes/${recipe.id}/reviews`, {
        comment: reviewText,
        rating: reviewRating,
        recipeId: recipe.id,
        userId: "placeholder",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recipes/${recipe.id}/reviews`] });
      setReviewText("");
      setReviewRating(5);
      toast({ title: "Review posted!", description: "Your review has been shared with the community." });
    },
    onError: () => {
      toast({ title: "Failed to post review", variant: "destructive" });
    },
  });

  // Image upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`/api/recipes/${recipe.id}/upload-image`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json() as Promise<{ imageUrl: string; recipe: Recipe }>;
    },
    onSuccess: (data) => {
      setRecipe(data.recipe);
      onRecipeUpdated?.(data.recipe);
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Photo uploaded!", description: "Your dish photo has been added." });
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Please try a JPEG, PNG or WebP image under 5MB.", variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="modal-recipe-detail"
        className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl border border-card-border"
      >
        {/* Header Image */}
        <div className="relative w-full h-52 bg-gradient-to-br from-primary/20 via-primary/10 to-accent overflow-hidden flex-shrink-0">
          {recipe.imageUrl ? (
            <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-8xl">{emoji}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

          {/* Action buttons over image */}
          <div className="absolute top-3 right-3 flex gap-2">
            {/* Upload photo button */}
            {isAuthenticated && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-upload-image"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  data-testid="button-upload-photo"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full text-xs font-medium transition-all"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {recipe.imageUrl ? "Change photo" : "Add photo"}
                </button>
              </>
            )}

            {/* Favorite button */}
            {isAuthenticated && (
              <button
                onClick={() => favoriteMutation.mutate()}
                disabled={favoriteMutation.isPending}
                data-testid="button-favorite"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                  isFavorited
                    ? "bg-red-500 text-white"
                    : "bg-white/90 dark:bg-black/70 text-muted-foreground hover:text-red-500"
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
              </button>
            )}
          </div>

          {/* Bottom badges */}
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-primary-foreground border-0 text-xs">{recipe.cuisineType}</Badge>
              <Badge variant="outline" className="bg-background/70 backdrop-blur-sm border-border text-xs">Vegetarian</Badge>
              {recipe.dietaryTags?.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={`text-xs border ${dietaryTagStyles[tag] ?? ""} bg-white/80 backdrop-blur-sm`}
                  data-testid={`modal-tag-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {tag === "Vegan" && "🌱 "}{tag === "Gluten-Free" && "🌾 "}{tag === "Jain Friendly" && "🙏 "}
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[68vh]">
          <div className="p-6 space-y-5">
            {/* Title */}
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="font-serif text-2xl font-bold text-foreground leading-snug flex-1">
                  {recipe.title}
                </DialogTitle>
                {avgRating && (
                  <div className="flex items-center gap-1 flex-shrink-0 bg-accent rounded-lg px-2.5 py-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold text-accent-foreground">{avgRating}</span>
                    <span className="text-xs text-muted-foreground">({reviews.length})</span>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{recipe.description}</p>
            </DialogHeader>

            {/* Stats + Servings Scaler */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-xl p-3 text-center space-y-1 border border-border">
                <div className="flex justify-center"><Clock className="w-4 h-4 text-primary" /></div>
                <p className="text-xs text-muted-foreground">Prep</p>
                <p className="text-sm font-bold text-foreground">{recipe.prepTime} min</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center space-y-1 border border-border">
                <div className="flex justify-center"><Flame className="w-4 h-4 text-primary" /></div>
                <p className="text-xs text-muted-foreground">Cook</p>
                <p className="text-sm font-bold text-foreground">{recipe.cookTime} min</p>
              </div>
              {/* Smart Serving Scaler spans 2 columns */}
              <div className="col-span-2 bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col items-center gap-1" data-testid="servings-scaler">
                <div className="flex justify-center"><Users className="w-4 h-4 text-primary" /></div>
                <p className="text-xs text-muted-foreground">Servings</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setServingsMultiplier(m => Math.max(0.5, m - 0.5))}
                    disabled={servingsMultiplier <= 0.5}
                    data-testid="button-servings-decrease"
                    className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold text-foreground w-8 text-center" data-testid="text-servings-count">
                    {currentServings % 1 === 0 ? currentServings : currentServings.toFixed(1)}
                  </span>
                  <button
                    onClick={() => setServingsMultiplier(m => Math.min(4, m + 0.5))}
                    disabled={servingsMultiplier >= 4}
                    data-testid="button-servings-increase"
                    className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {servingsMultiplier !== 1 && (
                  <p className="text-xs text-primary font-medium">{servingsMultiplier}× original</p>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-0 border border-border rounded-xl overflow-hidden">
              {(["ingredients", "instructions", "reviews"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  data-testid={`tab-${tab}`}
                  className={`flex-1 py-2.5 text-sm font-medium capitalize transition-all ${
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab === "reviews" ? `Reviews${reviews.length ? ` (${reviews.length})` : ""}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Ingredients Tab */}
            {activeTab === "ingredients" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-base font-bold text-foreground">Ingredients</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{recipe.ingredients.length} items</span>
                  {servingsMultiplier !== 1 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      Scaled {servingsMultiplier}×
                    </span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {recipe.ingredients.map((ingredient, i) => (
                    <div
                      key={i}
                      data-testid={`ingredient-${i}`}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{scaleIngredient(ingredient, servingsMultiplier)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions Tab */}
            {activeTab === "instructions" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-base font-bold text-foreground">Instructions</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{recipe.instructions.length} steps</span>
                </div>
                <ol className="space-y-4">
                  {recipe.instructions.map((step, i) => (
                    <li key={i} data-testid={`step-${i + 1}`} className="flex gap-4">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <div className="space-y-5">
                {/* Write a review */}
                {isAuthenticated ? (
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={user?.profileImageUrl ?? undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {user?.firstName?.[0] ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium text-foreground">Write a review</p>
                    </div>

                    {/* Star rating */}
                    <div className="flex items-center gap-1" data-testid="star-rating-input">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          onClick={() => setReviewRating(star)}
                          data-testid={`star-${star}`}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-5 h-5 transition-colors ${
                              star <= (hoveredStar || reviewRating)
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        {["", "Poor", "Fair", "Good", "Great", "Excellent"][hoveredStar || reviewRating]}
                      </span>
                    </div>

                    <Textarea
                      placeholder="Share your experience cooking this dish..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      className="resize-none min-h-[80px] text-sm bg-background border-border"
                      data-testid="input-review-text"
                    />
                    <Button
                      size="sm"
                      onClick={() => reviewMutation.mutate()}
                      disabled={reviewMutation.isPending || reviewText.trim().length < 5}
                      data-testid="button-submit-review"
                      className="gap-2"
                    >
                      {reviewMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                      Post Review
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-muted/30 border border-border rounded-xl space-y-3">
                    <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Sign in to leave a review</p>
                    <a href="/api/login">
                      <Button size="sm" variant="outline">Sign In</Button>
                    </a>
                  </div>
                )}

                {/* Review list */}
                {reviewsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-7 h-7 rounded-full" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-sm text-muted-foreground">No reviews yet.</p>
                    <p className="text-xs text-muted-foreground">Be the first to share your experience!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} data-testid={`review-${review.id}`} className="border-b border-border last:border-0 pb-4 last:pb-0">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={review.authorImageUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {review.authorName?.[0]?.toUpperCase() ?? "A"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {review.authorName ?? "Anonymous"}
                              </span>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-3 h-3 ${s <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
                            {review.createdAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="h-1" />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
