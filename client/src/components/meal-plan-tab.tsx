import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, Plus, X, Search, Clock,
  Loader2, UtensilsCrossed, Trash2,
  Wand2, ShoppingCart, RotateCcw, Check, ChefHat,
} from "lucide-react";
import type { Recipe, MealPlan } from "@shared/schema";
import {
  DAYS_OF_WEEK, MEAL_TYPES, MEAL_TYPE_LABELS, MEAL_TYPE_EMOJIS,
  type DayOfWeek, type MealType,
} from "@shared/schema";

const DAY_ABBR: Record<DayOfWeek, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
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
      if (!map.has(key)) map.set(key, { display: ing, recipes: [] });
      const entry = map.get(key)!;
      if (!entry.recipes.includes(recipe.title)) entry.recipes.push(recipe.title);
    }
  }
  return Array.from(map.entries())
    .map(([key, { display, recipes }]) => ({ key, display, recipes }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

interface MealPlanTabProps {
  onViewRecipe: (recipe: Recipe) => void;
}

type PickerTarget = { day: DayOfWeek; mealType: MealType } | null;

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  lunch: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800",
  dinner: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
  snacks: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",
};

const MEAL_HEADER_COLORS: Record<MealType, string> = {
  breakfast: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40",
  lunch: "text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40",
  dinner: "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40",
  snacks: "text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40",
};

const CUISINE_FILTER_COLORS: Record<string, string> = {
  All: "bg-neutral-800 text-white",
  "North Indian": "bg-orange-600 text-white",
  "South Indian": "bg-green-700 text-white",
  Gujarati: "bg-yellow-600 text-white",
  Maharashtrian: "bg-red-700 text-white",
  Rajasthani: "bg-pink-700 text-white",
  Bengali: "bg-blue-700 text-white",
  "Pan-Indian": "bg-teal-700 text-white",
  Punjabi: "bg-orange-700 text-white",
  Keralan: "bg-emerald-700 text-white",
  Tamil: "bg-rose-700 text-white",
  Andhra: "bg-red-600 text-white",
};

export function MealPlanTab({ onViewRecipe }: MealPlanTabProps) {
  const qc = useQueryClient();

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCuisine, setPickerCuisine] = useState("All");
  const [showShopping, setShowShopping] = useState(false);
  const [checkedImgErr, setCheckedImgErr] = useState<Set<number>>(new Set());

  const { data: allPlans = [], isLoading: plansLoading } = useQuery<MealPlan[]>({
    queryKey: ["/api/meal-plans"],
  });

  const { data: allRecipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: shoppingCheckedData } = useQuery<{ checkedKeys: string[] }>({
    queryKey: ["/api/shopping-checked"],
  });
  const checkedKeys = new Set(shoppingCheckedData?.checkedKeys ?? []);

  const recipeMap = useMemo(() => new Map(allRecipes.map((r) => [r.id, r])), [allRecipes]);

  const getPlanFor = (day: DayOfWeek): MealPlan | undefined =>
    allPlans.find((p) => p.day === day);

  const getMealRecipes = (plan: MealPlan | undefined, mt: MealType): Recipe[] => {
    if (!plan) return [];
    const ids = plan[mt] ?? [];
    return ids.map((id) => recipeMap.get(id)).filter(Boolean) as Recipe[];
  };

  const allWeekRecipes = useMemo(() => {
    const ids = new Set(allPlans.flatMap((p) => p.recipeIds ?? []));
    return allRecipes.filter((r) => ids.has(r.id));
  }, [allPlans, allRecipes]);

  const shoppingList = useMemo(() => buildShoppingList(allWeekRecipes), [allWeekRecipes]);

  const cuisines = useMemo(() => {
    const cs = new Set(allRecipes.map((r) => r.cuisineType));
    return ["All", ...Array.from(cs).sort()];
  }, [allRecipes]);

  const filteredPicker = useMemo(() => {
    let source = allRecipes;
    if (pickerCuisine !== "All") source = source.filter((r) => r.cuisineType === pickerCuisine);
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      source = source.filter((r) => r.title.toLowerCase().includes(q) || r.cuisineType.toLowerCase().includes(q));
    }
    return source;
  }, [allRecipes, pickerCuisine, pickerSearch]);

  const addMutation = useMutation({
    mutationFn: async ({ day, mealType, recipeId }: { day: string; mealType: MealType; recipeId: number }) => {
      const res = await fetch(`/api/meal-plans/${day}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipeId, mealType }),
      });
      if (!res.ok) throw new Error("Failed to add recipe");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ day, mealType, recipeId }: { day: string; mealType: MealType; recipeId: number }) => {
      const res = await fetch(`/api/meal-plans/${day}/recipes/${recipeId}?mealType=${mealType}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove recipe");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
    },
  });

  const clearDayMutation = useMutation({
    mutationFn: async (day: string) => {
      const res = await fetch(`/api/meal-plans/${day}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear day");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
  });

  const smartfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meal-plans/smartfill", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to smartfill");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
  });

  const clearWeekMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meal-plans", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear week");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/shopping-checked"] }),
  });

  const clearChecksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shopping-checked", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear checks");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/shopping-checked"] }),
  });

  const openPicker = (day: DayOfWeek, mealType: MealType) => {
    setPickerTarget({ day, mealType });
    setPickerSearch("");
    setPickerCuisine("All");
  };

  const closePicker = () => setPickerTarget(null);

  const onImgError = useCallback((id: number) => setCheckedImgErr(prev => new Set([...prev, id])), []);

  const checkedCount = shoppingList.filter((item) => checkedKeys.has(item.key)).length;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 px-2">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <CalendarDays size={24} className="text-primary" />
            Weekly Meal Plan
          </h2>
          <p className="text-neutral-500 text-sm mt-1">Plan your meals by day and meal type.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            data-testid="button-smartfill"
            size="sm"
            onClick={() => smartfillMutation.mutate()}
            disabled={smartfillMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs h-9"
          >
            {smartfillMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Wand2 size={13} className="mr-1.5" />}
            Smartfill Plan
          </Button>
          <Button
            data-testid="button-shopping-list"
            size="sm"
            variant="outline"
            onClick={() => setShowShopping((v) => !v)}
            className="text-primary border-primary/30 hover:bg-primary/5 text-xs h-9"
          >
            <ShoppingCart size={13} className="mr-1.5" />
            Shopping List
            {shoppingList.length > 0 && (
              <span className="ml-1.5 bg-primary text-white text-[10px] rounded-full px-1.5 py-0.5">
                {shoppingList.length - checkedCount}/{shoppingList.length}
              </span>
            )}
          </Button>
          <Button
            data-testid="button-clear-week"
            size="sm"
            variant="outline"
            onClick={() => clearWeekMutation.mutate()}
            disabled={clearWeekMutation.isPending}
            className="text-red-500 border-red-200 hover:bg-red-50 text-xs h-9"
          >
            {clearWeekMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <RotateCcw size={13} className="mr-1.5" />}
            Clear Week
          </Button>
        </div>
      </div>

      {/* Shopping List Panel */}
      {showShopping && (
        <div className="mb-5 bg-white dark:bg-neutral-800 rounded-2xl border border-primary/20 shadow-sm">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-primary" />
              <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">Shopping List</h4>
              {checkedCount > 0 && (
                <span className="text-xs text-neutral-500">{checkedCount} of {shoppingList.length} checked</span>
              )}
            </div>
            <div className="flex gap-2">
              {checkedCount > 0 && (
                <button
                  onClick={() => clearChecksMutation.mutate()}
                  className="text-xs text-neutral-400 hover:text-neutral-600 underline"
                >
                  Clear checks
                </button>
              )}
              <button onClick={() => setShowShopping(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={15} />
              </button>
            </div>
          </div>
          {shoppingList.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 text-sm">
              <ShoppingCart size={28} className="mx-auto mb-2 opacity-40" />
              <p>Add meals to your plan to generate a shopping list.</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {shoppingList.map((item) => (
                <button
                  key={item.key}
                  data-testid={`shopping-item-${item.key}`}
                  onClick={() => toggleCheckMutation.mutate(item.key)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    checkedKeys.has(item.key)
                      ? "bg-neutral-50 dark:bg-neutral-700/50 text-neutral-400 line-through"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    checkedKeys.has(item.key)
                      ? "bg-primary border-primary"
                      : "border-neutral-300 dark:border-neutral-600"
                  }`}>
                    {checkedKeys.has(item.key) && <Check size={10} className="text-white" />}
                  </div>
                  <span className="truncate">{item.display}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Weekly Table */}
      <div className="space-y-3">
        {/* Column headers — hidden on mobile */}
        <div className="hidden lg:grid lg:grid-cols-[100px_1fr_1fr_1fr_1fr_80px] gap-2 px-2">
          <div />
          {MEAL_TYPES.map((mt) => (
            <div key={mt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${MEAL_HEADER_COLORS[mt]}`}>
              <span>{MEAL_TYPE_EMOJIS[mt]}</span>
              <span>{MEAL_TYPE_LABELS[mt]}</span>
            </div>
          ))}
          <div />
        </div>

        {plansLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
        ) : (
          DAYS_OF_WEEK.map((day) => {
            const plan = getPlanFor(day);
            const totalMeals = MEAL_TYPES.reduce((acc, mt) => acc + (plan?.[mt]?.length ?? 0), 0);

            return (
              <div
                key={day}
                data-testid={`day-row-${day.toLowerCase()}`}
                className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden"
              >
                {/* Day header row */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-700/30">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-800 dark:text-neutral-100 w-8">
                      {DAY_ABBR[day]}
                    </span>
                    <span className="hidden sm:inline text-xs text-neutral-500">{day}</span>
                    {totalMeals > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        {totalMeals} meal{totalMeals !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {totalMeals > 0 && (
                    <button
                      data-testid={`button-clear-day-${day.toLowerCase()}`}
                      onClick={() => clearDayMutation.mutate(day)}
                      disabled={clearDayMutation.isPending}
                      className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={11} />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}
                </div>

                {/* Meal type slots — horizontal on desktop, vertical on mobile */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y lg:divide-y-0 divide-neutral-100 dark:divide-neutral-700">
                  {MEAL_TYPES.map((mt) => {
                    const recipes = getMealRecipes(plan, mt);
                    const isTarget = pickerTarget?.day === day && pickerTarget?.mealType === mt;
                    return (
                      <div
                        key={mt}
                        className={`p-3 min-h-[100px] flex flex-col gap-2 relative transition-colors ${
                          isTarget ? "bg-primary/5 dark:bg-primary/10" : ""
                        }`}
                      >
                        {/* Meal type label on mobile (hidden on large screens where header shows it) */}
                        <div className={`lg:hidden flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 w-fit ${MEAL_HEADER_COLORS[mt]}`}>
                          <span>{MEAL_TYPE_EMOJIS[mt]}</span>
                          <span>{MEAL_TYPE_LABELS[mt]}</span>
                        </div>

                        {/* Recipe cards for this slot */}
                        <div className="flex flex-col gap-1.5 flex-1">
                          {recipes.map((recipe) => (
                            <div
                              key={recipe.id}
                              data-testid={`meal-card-${day.toLowerCase()}-${mt}-${recipe.id}`}
                              className={`flex items-center gap-2 p-2 rounded-xl border group cursor-pointer ${MEAL_COLORS[mt]}`}
                              onClick={() => onViewRecipe(recipe)}
                            >
                              <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                                {recipe.imageUrl && !checkedImgErr.has(recipe.id) ? (
                                  <img
                                    src={`${recipe.imageUrl}?v=2`}
                                    alt={recipe.title}
                                    className="w-full h-full object-cover"
                                    onError={() => onImgError(recipe.id)}
                                  />
                                ) : (
                                  <ChefHat size={16} className="text-neutral-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2">
                                  {recipe.title}
                                </p>
                                <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                                  <Clock size={8} />
                                  {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)}m
                                </p>
                              </div>
                              <button
                                data-testid={`button-remove-meal-${recipe.id}`}
                                onClick={(e) => { e.stopPropagation(); removeMutation.mutate({ day, mealType: mt, recipeId: recipe.id }); }}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add button */}
                        <button
                          data-testid={`button-add-${day.toLowerCase()}-${mt}`}
                          onClick={() => isTarget ? closePicker() : openPicker(day, mt)}
                          className={`flex items-center justify-center gap-1 rounded-xl border border-dashed text-[10px] font-medium py-1.5 transition-all ${
                            isTarget
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-neutral-200 dark:border-neutral-600 text-neutral-400 hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                          }`}
                        >
                          {isTarget ? (
                            <><X size={10} /> Cancel</>
                          ) : (
                            <><Plus size={10} /> Add</>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recipe Picker Panel (fixed at bottom / slide-up on mobile, inline below on desktop) */}
      {pickerTarget && (
        <div
          data-testid="recipe-picker"
          className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-50 sm:z-auto sm:relative sm:mt-4 bg-white dark:bg-neutral-800 border-t sm:border border-primary/20 sm:rounded-2xl shadow-2xl sm:shadow-md"
          style={{ maxHeight: "60vh" }}
        >
          {/* Picker header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-800 z-10">
            <div className="flex items-center gap-2">
              <span className="text-base">{MEAL_TYPE_EMOJIS[pickerTarget.mealType]}</span>
              <div>
                <p className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm leading-tight">
                  {MEAL_TYPE_LABELS[pickerTarget.mealType]} · {pickerTarget.day}
                </p>
                <p className="text-[10px] text-neutral-500">Select a recipe to add</p>
              </div>
            </div>
            <button onClick={closePicker} className="text-neutral-400 hover:text-neutral-600 p-1">
              <X size={16} />
            </button>
          </div>

          <div className="flex h-[calc(60vh-58px)] overflow-hidden">
            {/* Recipe grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <Input
                    data-testid="input-recipe-search"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search recipes…"
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>

              {/* Recipe grid items */}
              <div className="flex-1 overflow-y-auto p-3">
                {recipesLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                  </div>
                ) : filteredPicker.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-400 text-sm gap-2 py-8">
                    <UtensilsCrossed size={24} className="opacity-40" />
                    <p>No recipes match your search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {filteredPicker.map((recipe) => {
                      const plan = getPlanFor(pickerTarget.day);
                      const alreadyInSlot = (plan?.[pickerTarget.mealType] ?? []).includes(recipe.id);
                      return (
                        <button
                          key={recipe.id}
                          data-testid={`picker-item-${recipe.id}`}
                          disabled={alreadyInSlot || addMutation.isPending}
                          onClick={() => {
                            addMutation.mutate({ day: pickerTarget.day, mealType: pickerTarget.mealType, recipeId: recipe.id });
                          }}
                          className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all group ${
                            alreadyInSlot
                              ? "opacity-40 cursor-not-allowed border-neutral-200 bg-neutral-50 dark:bg-neutral-700 dark:border-neutral-600"
                              : "border-neutral-200 dark:border-neutral-700 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 active:scale-95"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                            {recipe.imageUrl && !checkedImgErr.has(recipe.id) ? (
                              <img
                                src={`${recipe.imageUrl}?v=2`}
                                alt={recipe.title}
                                className="w-full h-full object-cover"
                                onError={() => onImgError(recipe.id)}
                              />
                            ) : (
                              <ChefHat size={20} className="text-neutral-400" />
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-200 leading-tight line-clamp-2">
                            {recipe.title}
                          </span>
                          {alreadyInSlot && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Check size={8} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right-side cuisine category filter — exactly like the screenshot */}
            <div className="w-28 sm:w-32 flex-shrink-0 border-l border-neutral-100 dark:border-neutral-700 overflow-y-auto p-2 flex flex-col gap-1">
              {cuisines.map((cuisine) => {
                const isActive = pickerCuisine === cuisine;
                const color = CUISINE_FILTER_COLORS[cuisine] ?? "bg-neutral-600 text-white";
                return (
                  <button
                    key={cuisine}
                    data-testid={`cuisine-filter-${cuisine.replace(/\s+/g, "-").toLowerCase()}`}
                    onClick={() => setPickerCuisine(cuisine)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all truncate ${
                      isActive
                        ? color
                        : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                    }`}
                  >
                    {cuisine}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
