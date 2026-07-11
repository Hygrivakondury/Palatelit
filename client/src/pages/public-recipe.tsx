import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Clock, Users, ChefHat, ArrowRight, Sparkles } from "lucide-react";
import type { Recipe } from "@shared/schema";

async function fetchPublicRecipe(id: string): Promise<Recipe> {
  const res = await fetch(`/api/recipes/${id}`);
  if (!res.ok) throw new Error("Recipe not found");
  return res.json();
}

export default function PublicRecipePage() {
  const [, params] = useRoute("/recipe/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;

  const { data: recipe, isLoading, isError } = useQuery<Recipe>({
    queryKey: [`/api/recipes/${id}`],
    queryFn: () => fetchPublicRecipe(id!),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Recipe not found</h1>
        <p className="text-muted-foreground mb-6">This recipe may have been removed.</p>
        <a href="/">
          <Button className="rounded-full">Explore Palate Lit</Button>
        </a>
      </div>
    );
  }

  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <div className="min-h-screen bg-background">
      {/* Top brand bar */}
      <div className="border-b border-border bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold text-foreground">
              Palate <strong className="text-primary">Lit</strong>
            </span>
          </a>
          <a href="/auth">
            <Button size="sm" className="rounded-full gap-1.5 font-medium">
              Join free <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </div>

      {/* Invite banner */}
      <div className="bg-primary/8 border-b border-primary/15">
        <div className="max-w-3xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 flex-1">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm text-foreground/80">
              You've been invited to <strong className="text-foreground">Palate Lit</strong> — a home for 360+ Indian
              vegetarian recipes. Join free to save favourites, plan meals, and share your own.
            </p>
          </div>
          <a href="/auth" className="shrink-0">
            <Button size="sm" className="rounded-full font-medium whitespace-nowrap">
              Accept your invite
            </Button>
          </a>
        </div>
      </div>

      {/* Recipe content */}
      <article className="max-w-3xl mx-auto px-6 py-8">
        {/* Image */}
        {recipe.imageUrl && (
          <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden mb-6 bg-muted">
            <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Title + meta */}
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">{recipe.title}</h1>
        <p className="text-muted-foreground leading-relaxed mb-2">{recipe.description}</p>
        {recipe.submittedByName && (
          <p className="text-sm text-muted-foreground mb-6">
            Recipe by <span className="font-medium text-foreground">{recipe.submittedByName}</span>
          </p>
        )}

        {/* Meta chips */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm">
            <Clock className="w-3.5 h-3.5 text-primary" /> {totalTime} min
          </div>
          <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm">
            <Users className="w-3.5 h-3.5 text-primary" /> Serves {recipe.servings}
          </div>
          <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm">
            <ChefHat className="w-3.5 h-3.5 text-primary" /> {recipe.cuisineType}
          </div>
        </div>

        {/* Ingredients */}
        <section className="mb-8">
          <h2 className="font-serif text-xl font-bold text-foreground mb-4">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-start gap-3 text-foreground/90">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                {ing}
              </li>
            ))}
          </ul>
        </section>

        {/* Instructions */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-bold text-foreground mb-4">Instructions</h2>
          <ol className="space-y-4">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-foreground/90 leading-relaxed pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Bottom invite CTA */}
        <div className="rounded-2xl bg-[#1c1410] text-center px-6 py-10">
          <h3 className="font-serif text-2xl font-bold text-white mb-2">
            Hungry for <span style={{ color: "hsl(16 72% 62%)" }}>more?</span>
          </h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            This is one of 360+ Indian vegetarian recipes on Palate Lit. Join free to unlock them all, save your
            favourites, and cook what's already in your kitchen.
          </p>
          <a href="/auth">
            <Button size="lg" className="rounded-full gap-2 font-semibold px-8">
              Join Palate Lit — it's free <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </article>
    </div>
  );
}
