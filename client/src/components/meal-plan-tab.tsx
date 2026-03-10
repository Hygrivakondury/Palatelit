import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, Plus, X, Search, Clock, ChefHat,
  Loader2, UtensilsCrossed, Trash2, CheckCircle2,
  Wand2, Link2, ShoppingCart, RotateCcw, Check, Package,
} from "lucide-react";
import type { Recipe, MealPlan } from "@shared/schema";
import { DAYS_OF_WEEK, type DayOfWeek } from "@shared/schema";

const DAY_ABBR: Record<DayOfWeek, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const DAY_INDEX: Record<DayOfWeek, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "over", "high", "heat",
  "tbsp", "tsp", "cup", "cups", "fine", "well", "cook", "salt", "taste",
  "until", "add", "fresh", "then", "each", "some", "more", "use", "top",
  "side", "make", "bring", "let", "mix", "set", "cut", "large", "small",
  "medium", "water", "needed", "little", "pinch", "half", "whole", "sliced",
  "chopped", "minced", "grated", "diced", "tablespoon", "teaspoon", "handful",
]);

function extractIngredientKeywords(ingredients: string[]): Set<string> {
  const words = new Set<string>();
  for (const ing of ingredients) {
    const tokens = ing
      .toLowerCase()
      .replace(/[0-9,.()/\-]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    tokens.forEach((w) => words.add(w));
  }
  return words;
}

function getChainSuggestions(
  prevRecipes: Recipe[],
  candidates: Recipe[],
  alreadyPlanned: Set<number>
): Recipe[] {
  if (prevRecipes.length === 0) return [];
  const prevKeywords = extractIngredientKeywords(
    prevRecipes.flatMap((r) => r.ingredients)
  );
  return candidates
    .filter((r) => !alreadyPlanned.has(r.id))
    .map((r) => {
      const words = extractIngredientKeywords(r.ingredients);
      const overlap = [...words].filter((w) => prevKeywords.has(w)).length;
      return { recipe: r, overlap };
    })
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5)
    .map(({ recipe }) => recipe);
}

interface ShoppingItem {
  key: string;
  display: string;
  recipes: string[];
}

function buildShoppingList(allWeekRecipes: Recipe[]): ShoppingItem[] {
  const map = new Map<string, { display: string; recipes: string[] }>();
  for (const recipe of allWeekRecipes) {
    for (const ing of recipe.ingredients) {
      const key = ing.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, { display: ing, recipes: [] });
      }
      const entry = map.get(key)!;
      if (!entry.recipes.includes(recipe.title)) {
        entry.recipes.push(recipe.title);
      }
    }
  }
  return Array.from(map.entries())
    .map(([key, { display, recipes }]) => ({ key, display, recipes }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

interface MealPlanTabProps {
  onViewRecipe: (recipe: Recipe) => void;
}

export function MealPlanTab({ onViewRecipe }: MealPlanTabProps) {
  const qc = useQueryClient();

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" }) as DayOfWeek;
    return DAYS_OF_WEEK.includes(today) ? today : "Monday";
  });
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTab, setPickerTab] = useState<"browse" | "chain">("browse");

  const { data: allPlans = [] } = useQuery<MealPlan[]>({
    queryKey: ["/api/meal-plans"],
  });

  const { data: dayPlan, isLoading: dayLoading } = useQuery<MealPlan>({
    queryKey: ["/api/meal-plans", selectedDay],
    queryFn: async () => {
      const res = await fetch(`/api/meal-plans/${selectedDay}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load meal plan");
      return res.json();
    },
  });

  const { data: allRecipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: shoppingCheckedData } = useQuery<{ checkedKeys: string[] }>({
    queryKey: ["/api/shopping-checked"],
  });
  const checkedKeys = new Set(shoppingCheckedData?.checkedKeys ?? []);

  const plannedIds = new Set(dayPlan?.recipeIds ?? []);
  const plannedRecipes = allRecipes.filter((r) => plannedIds.has(r.id));

  const previousDay: DayOfWeek | null = useMemo(() => {
    const idx = DAY_INDEX[selectedDay];
    return idx > 0 ? DAYS_OF_WEEK[idx - 1] : null;
  }, [selectedDay]);

  const previousDayPlan = previousDay
    ? allPlans.find((p) => p.day === previousDay)
    : null;

  const previousDayRecipes = useMemo(() => {
    if (!previousDayPlan) return [];
    return allRecipes.filter((r) => previousDayPlan.recipeIds.includes(r.id));
  }, [previousDayPlan, allRecipes]);

  const chainSuggestions = useMemo(
    () => getChainSuggestions(previousDayRecipes, allRecipes, plannedIds),
    [previousDayRecipes, allRecipes, plannedIds]
  );

  const allWeekRecipes = useMemo(() => {
    const weekRecipeIds = new Set(allPlans.flatMap((p) => p.recipeIds));
    return allRecipes.filter((r) => weekRecipeIds.has(r.id));
  }, [allPlans, allRecipes]);

  const shoppingList = useMemo(() => buildShoppingList(allWeekRecipes), [allWeekRecipes]);

  const filteredPicker = useMemo(() => {
    const source = pickerTab === "chain" ? chainSuggestions : allRecipes;
    if (!pickerSearch.trim()) return source;
    const q = pickerSearch.toLowerCase();
    return source.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.cuisineType.toLowerCase().includes(q)
    );
  }, [pickerTab, pickerSearch, allRecipes, chainSuggestions]);

  const addMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const res = await fetch(`/api/meal-plans/${selectedDay}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipeId }),
      });
      if (!res.ok) throw new Error("Failed to add recipe");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      qc.invalidateQueries({ queryKey: ["/api/meal-plans", selectedDay] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const res = await fetch(`/api/meal-plans/${selectedDay}/recipes/${recipeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove recipe");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      qc.invalidateQueries({ queryKey: ["/api/meal-plans", selectedDay] });
    },
  });

  const clearDayMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meal-plans/${selectedDay}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear day");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      qc.invalidateQueries({ queryKey: ["/api/meal-plans", selectedDay] });
    },
  });

  const smartfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meal-plans/smartfill", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to smartfill");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      qc.invalidateQueries({ queryKey: ["/api/meal-plans", selectedDay] });
    },
  });

  const clearWeekMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meal-plans", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear week");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      qc.invalidateQueries({ queryKey: ["/api/meal-plans", selectedDay] });
    },
  });

  const toggleCheckMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch("/api/shopping-checked/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shopping-checked"] });
    },
  });

  const clearChecksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shopping-checked", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear checks");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shopping-checked"] });
    },
  });

  const totalTime = plannedRecipes.reduce(
    (acc, r) => acc + (r.prepTime ?? 0) + (r.cookTime ?? 0),
    0
  );

  const dayHasRecipes = (day: DayOfWeek) => {
    const plan = allPlans.find((p) => p.day === day);
    return (plan?.recipeIds?.length ?? 0) > 0;
  };

  const checkedCount = shoppingList.filter((item) => checkedKeys.has(item.key)).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <CalendarDays size={24} className="text-primary" />
            Weekly Meal Plan
          </h2>
          <p className="text-neutral-500 text-sm mt-1">
            Plan your meals for each day of the week.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="button-smartfill"
            size="sm"
            onClick={() => smartfillMutation.mutate()}
            disabled={smartfillMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs h-9"
          >
            {smartfillMutation.isPending ? (
              <Loader2 size={13} className="animate-spin mr-1.5" />
            ) : (
              <Wand2 size={13} className="mr-1.5" />
            )}
            Smartfill Plan
          </Button>
          <Button
            data-testid="button-clear-week"
            size="sm"
            variant="outline"
            onClick={() => clearWeekMutation.mutate()}
            disabled={clearWeekMutation.isPending}
            className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-900/20 text-xs h-9"
          >
            {clearWeekMutation.isPending ? (
              <Loader2 size={13} className="animate-spin mr-1.5" />
            ) : (
              <RotateCcw size={13} className="mr-1.5" />
            )}
            Clear Week
          </Button>
        </div>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" data-testid="day-selector">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day}
            data-testid={`day-tab-${day.toLowerCase()}`}
            onClick={() => { setSelectedDay(day); setShowPicker(false); setPickerTab("browse"); }}
            className={`relative flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              selectedDay === day
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-primary/40"
            }`}
          >
            <span className="text-xs font-semibold">{DAY_ABBR[day]}</span>
            {dayHasRecipes(day) && (
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full ${
                  selectedDay === day ? "bg-white/70" : "bg-primary"
                }`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Day plan panel */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-700">
          <div>
            <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-base">
              {selectedDay}
            </h3>
            {plannedRecipes.length > 0 && (
              <p className="text-xs text-neutral-500 mt-0.5">
                {plannedRecipes.length} meal{plannedRecipes.length !== 1 ? "s" : ""}{" "}
                ·{" "}
                <span className="inline-flex items-center gap-1">
                  <Clock size={10} />
                  {totalTime} min total
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {plannedRecipes.length > 0 && (
              <Button
                data-testid="button-clear-day"
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 px-2 text-xs"
                onClick={() => clearDayMutation.mutate()}
                disabled={clearDayMutation.isPending}
              >
                {clearDayMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                <span className="ml-1">Clear day</span>
              </Button>
            )}
            <Button
              data-testid="button-add-recipe"
              size="sm"
              onClick={() => {
                setShowPicker((v) => !v);
                setPickerSearch("");
                setPickerTab("browse");
              }}
              className="h-8 bg-primary hover:bg-primary/90 text-white"
            >
              <Plus size={14} className="mr-1" />
              Add Recipe
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-3 min-h-[120px]">
          {dayLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : plannedRecipes.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 dark:text-neutral-500">
              <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No meals planned for {selectedDay}.</p>
              <p className="text-xs mt-1">Click "Add Recipe" to get started.</p>
            </div>
          ) : (
            plannedRecipes.map((recipe) => (
              <div
                key={recipe.id}
                data-testid={`meal-plan-recipe-${recipe.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-700/50 border border-neutral-100 dark:border-neutral-700 group"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <ChefHat size={18} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    data-testid={`meal-title-${recipe.id}`}
                    className="font-semibold text-sm text-neutral-800 dark:text-neutral-100 truncate"
                  >
                    {recipe.title}
                  </p>
                  <p className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
                    <span>{recipe.cuisineType}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min
                    </span>
                    {recipe.servings && (
                      <>
                        <span>·</span>
                        <span>Serves {recipe.servings}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    data-testid={`button-view-meal-${recipe.id}`}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onViewRecipe(recipe)}
                  >
                    View
                  </Button>
                  <button
                    data-testid={`button-remove-meal-${recipe.id}`}
                    onClick={() => removeMutation.mutate(recipe.id)}
                    disabled={removeMutation.isPending}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {removeMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <X size={12} />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recipe Picker */}
      {showPicker && (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-primary/30 shadow-md">
          <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">
                Add to {selectedDay}
              </h4>
              <button
                data-testid="button-close-picker"
                onClick={() => setShowPicker(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Picker tabs */}
            <div className="flex gap-1 mb-3">
              <button
                data-testid="picker-tab-browse"
                onClick={() => { setPickerTab("browse"); setPickerSearch(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pickerTab === "browse"
                    ? "bg-primary text-white"
                    : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                }`}
              >
                <UtensilsCrossed size={12} />
                Browse All
              </button>
              <button
                data-testid="picker-tab-chain"
                onClick={() => { setPickerTab("chain"); setPickerSearch(""); }}
                disabled={!previousDay || previousDayRecipes.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  pickerTab === "chain"
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                }`}
              >
                <Link2 size={12} />
                From {previousDay ? DAY_ABBR[previousDay] : "Yesterday"}
              </button>
            </div>

            {pickerTab === "chain" && previousDay && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                <Link2 size={13} className="mt-0.5 flex-shrink-0" />
                <span>
                  Recipes below share vegetables and ingredients from{" "}
                  <strong>{previousDay}</strong>'s meals — helping you use up what you already have.
                </span>
              </div>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                data-testid="input-recipe-search"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search recipes…"
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700">
            {recipesLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : pickerTab === "chain" && chainSuggestions.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 text-sm">
                <Link2 size={24} className="mx-auto mb-2 opacity-40" />
                <p>No chain-link suggestions found.</p>
                <p className="text-xs mt-1">Try adding meals to {previousDay} first.</p>
              </div>
            ) : filteredPicker.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 text-sm">
                No recipes match "{pickerSearch}"
              </div>
            ) : (
              filteredPicker.map((recipe) => {
                const isAdded = plannedIds.has(recipe.id);
                return (
                  <div
                    key={recipe.id}
                    data-testid={`picker-recipe-${recipe.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                        {recipe.title}
                      </p>
                      <p className="text-xs text-neutral-500 flex items-center gap-2">
                        <span>{recipe.cuisineType}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock size={9} />
                          {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min
                        </span>
                      </p>
                    </div>
                    {isAdded ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 size={13} />
                        Added
                      </span>
                    ) : (
                      <Button
                        data-testid={`button-picker-add-${recipe.id}`}
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs border-primary text-primary hover:bg-primary hover:text-white"
                        onClick={() => addMutation.mutate(recipe.id)}
                        disabled={addMutation.isPending}
                      >
                        {addMutation.isPending ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Plus size={11} />
                        )}
                        <span className="ml-1">Add</span>
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Week at a Glance */}
      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-700 p-4">
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
          Week at a Glance
        </h4>
        <div className="grid grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map((day) => {
            const plan = allPlans.find((p) => p.day === day);
            const count = plan?.recipeIds?.length ?? 0;
            return (
              <button
                key={day}
                data-testid={`week-glance-${day.toLowerCase()}`}
                onClick={() => { setSelectedDay(day); setShowPicker(false); }}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                  selectedDay === day
                    ? "bg-primary/10 dark:bg-primary/20"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
                }`}
              >
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {DAY_ABBR[day]}
                </span>
                <span
                  className={`text-lg font-bold leading-none ${
                    count > 0
                      ? "text-primary"
                      : "text-neutral-200 dark:text-neutral-600"
                  }`}
                >
                  {count}
                </span>
                <span className="text-xs text-neutral-400">
                  {count === 0 ? "—" : count === 1 ? "meal" : "meals"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shopping List */}
      {shoppingList.length > 0 && (
        <div
          data-testid="shopping-list-section"
          className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-700">
            <div>
              <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-base flex items-center gap-2">
                <ShoppingCart size={18} className="text-primary" />
                Weekly Shopping List
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                {shoppingList.length} ingredient{shoppingList.length !== 1 ? "s" : ""} needed
                {checkedCount > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {" "}· {checkedCount} checked off
                  </span>
                )}
              </p>
            </div>
            {checkedCount > 0 && (
              <Button
                data-testid="button-clear-checks"
                size="sm"
                variant="ghost"
                className="text-neutral-500 hover:text-neutral-700 text-xs h-8"
                onClick={() => clearChecksMutation.mutate()}
                disabled={clearChecksMutation.isPending}
              >
                {clearChecksMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <RotateCcw size={12} className="mr-1" />
                )}
                Clear checks
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="w-10 py-2.5 pl-5 text-left" />
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Ingredient
                  </th>
                  <th className="py-2.5 px-3 pr-5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Needed for
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 dark:divide-neutral-700/50">
                {shoppingList.map((item, idx) => {
                  const isChecked = checkedKeys.has(item.key);
                  return (
                    <tr
                      key={item.key}
                      data-testid={`shopping-row-${idx}`}
                      className={`transition-colors ${
                        isChecked
                          ? "bg-emerald-50/60 dark:bg-emerald-900/10"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-700/30"
                      }`}
                    >
                      <td className="pl-5 py-2.5">
                        <button
                          data-testid={`checkbox-shopping-${idx}`}
                          onClick={() => toggleCheckMutation.mutate(item.key)}
                          disabled={toggleCheckMutation.isPending}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            isChecked
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-neutral-300 dark:border-neutral-600 hover:border-primary"
                          }`}
                          aria-label={isChecked ? "Uncheck ingredient" : "Check ingredient"}
                        >
                          {isChecked && <Check size={11} strokeWidth={3} />}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-sm ${
                            isChecked
                              ? "line-through text-neutral-400 dark:text-neutral-500"
                              : "text-neutral-800 dark:text-neutral-100"
                          }`}
                        >
                          {item.display}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 pr-5">
                        <div className="flex flex-wrap gap-1">
                          {item.recipes.map((recipeName) => (
                            <Badge
                              key={recipeName}
                              variant="secondary"
                              className="text-xs py-0 px-1.5 bg-primary/10 text-primary border-0 font-normal"
                            >
                              {recipeName}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-700 flex items-center gap-2 text-xs text-neutral-400">
            <Package size={12} />
            Check off items as you order or buy them — your progress is saved.
          </div>
        </div>
      )}
    </div>
  );
}
