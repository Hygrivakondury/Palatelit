import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, Plus, X, Search, Clock, Loader2,
  UtensilsCrossed, Trash2, Wand2, ShoppingCart,
  RotateCcw, Check, ChefHat,
} from "lucide-react";
import type { Recipe, MealPlan } from "@shared/schema";
import { DAYS_OF_WEEK, type DayOfWeek } from "@shared/schema";

// ─── Day labels ──────────────────────────────────────────────
const DAY_ABBR: Record<DayOfWeek, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

// ─── Shopping list: ingredient parsing ───────────────────────

const SKIP_PATTERNS = [
  /\bto\s+taste\b/i,
  /\bas\s+needed\b/i,
  /\bas\s+required\b/i,
  /^(a\s+)?pinch\b/i,
  /^(a\s+)?dash\b/i,
  /\bfor\s+garnish\b/i,
  /\bfor\s+serving\b/i,
  /\boptional\b/i,
];

const SKIP_UNITS = new Set([
  "tsp", "teaspoon", "teaspoons",
]);

const SKIP_INGREDIENT_WORDS = new Set([
  "water", "hot water", "cold water", "warm water", "lukewarm water",
  "boiling water", "ice", "ice cubes", "ice water",
  "salt", "black salt", "rock salt", "pink salt",
]);

const SMALL_MEASURE_RE = /^(¼|½|¾|⅓|⅔|⅛|1\/4|1\/2|3\/4|1\/3|2\/3|1\/8|1|2)?\s*(tsp|teaspoon|teaspoons?)\b/i;
const QTY_UNIT_RE = /^([\d¼½¾⅓⅔⅛⅜⅝⅞]+(?:[½¼¾])?(?:[\s\-\/][\d]+)?)\s*(tsp|teaspoon|teaspoons?|tbsp?|tablespoons?|ml|g|gm|gms|grams?|kg|cup|cups?|oz|lb|lbs|piece|pieces?|no\.?|nos?\.?|bunch|bunches|handful|sprig|sprigs|slice|slices|litre|liter|litres?|liters?|l|packet|packets?)\b\.?\s*/i;
const LEADING_NUMBER_RE = /^[\d¼½¾⅓⅔⅛⅜⅝⅞]+(?:[–\-\/][\d]+)?\s*/;

type ShoppingCategory = "Vegetables" | "Fruits" | "Dairy" | "Grains & Pulses" | "Nuts & Dry Fruits" | "Oils & Condiments" | "Other";

const CATEGORY_ICONS: Record<ShoppingCategory, string> = {
  "Vegetables": "🥦",
  "Fruits": "🍎",
  "Dairy": "🥛",
  "Grains & Pulses": "🌾",
  "Nuts & Dry Fruits": "🥜",
  "Oils & Condiments": "🫙",
  "Other": "🛒",
};

const CATEGORY_ORDER: ShoppingCategory[] = [
  "Vegetables", "Fruits", "Dairy", "Grains & Pulses",
  "Nuts & Dry Fruits", "Oils & Condiments", "Other",
];

const VEGETABLE_WORDS = new Set([
  "onion", "onions", "tomato", "tomatoes", "potato", "potatoes", "carrot", "carrots",
  "spinach", "peas", "cauliflower", "cabbage", "brinjal", "eggplant", "capsicum",
  "cucumber", "pumpkin", "drumstick", "okra", "bhindi", "beans", "broccoli", "garlic",
  "ginger", "mushroom", "zucchini", "gourd", "yam", "taro", "arbi", "methi",
  "fenugreek", "dill", "chilli", "chillies", "chili", "chiles", "spring onion",
  "spring onions", "leek", "fennel", "radish", "turnip", "beetroot", "beet",
  "corn", "sweetcorn", "ladyfinger", "courgette", "ash gourd", "bottle gourd",
  "ridge gourd", "snake gourd", "bitter gourd", "raw banana", "raw mango",
  "green papaya", "lotus stem", "lotus root", "jackfruit", "raw jackfruit",
  "bamboo shoots", "baby corn",
]);

const FRUIT_WORDS = new Set([
  "mango", "banana", "bananas", "apple", "apples", "lemon", "lemons", "lime", "limes",
  "coconut", "tamarind", "kokum", "grape", "grapes", "kiwi", "strawberry", "strawberries",
  "orange", "oranges", "pineapple", "watermelon", "papaya", "guava", "pomegranate",
  "chikoo", "sapodilla", "avocado", "peach", "plum", "cherry", "cherries",
  "blueberry", "raspberry", "fig", "figs", "apricot", "apricots", "pear",
  "dragonfruit", "jackfruit",
]);

const DAIRY_WORDS = new Set([
  "milk", "yogurt", "curd", "paneer", "ghee", "butter", "cream", "cheese",
  "ice cream", "khoya", "mava", "condensed milk", "fresh cream", "malai",
  "buttermilk", "chaas", "lassi", "rabdi", "rabri", "dahi",
]);

const GRAIN_WORDS = new Set([
  "rice", "wheat", "flour", "maida", "besan", "gram flour", "cornflour", "cornstarch",
  "dal", "dhal", "lentil", "lentils", "chickpea", "chickpeas", "rajma", "chana",
  "moong", "toor", "urad", "semolina", "rava", "suji", "bread", "pasta",
  "noodle", "noodles", "oats", "quinoa", "millet", "bajra", "jowar", "sorghum",
  "poha", "flattened rice", "vermicelli", "sevai", "sago", "sabudana",
  "tapioca", "arrowroot", "barley",
]);

const NUT_WORDS = new Set([
  "cashew", "cashews", "almond", "almonds", "peanut", "peanuts", "pistachio",
  "pistachios", "walnut", "walnuts", "raisin", "raisins", "dates", "date",
  "medjool", "coconut flakes", "dessicated coconut", "chironji", "makhana",
  "fox nuts", "pine nuts", "sesame seeds", "poppy seeds", "sunflower seeds",
  "pumpkin seeds", "chia seeds", "flaxseeds", "hemp seeds",
]);

const OIL_WORDS = new Set([
  "oil", "olive oil", "coconut oil", "mustard oil", "sesame oil",
  "sunflower oil", "vegetable oil", "groundnut oil",
  "vinegar", "soy sauce", "worcestershire sauce", "tamari",
]);

function categorize(name: string): ShoppingCategory {
  const n = name.toLowerCase();
  for (const w of VEGETABLE_WORDS) { if (n.includes(w)) return "Vegetables"; }
  for (const w of FRUIT_WORDS) { if (n.includes(w)) return "Fruits"; }
  for (const w of DAIRY_WORDS) { if (n.includes(w)) return "Dairy"; }
  for (const w of GRAIN_WORDS) { if (n.includes(w)) return "Grains & Pulses"; }
  for (const w of NUT_WORDS) { if (n.includes(w)) return "Nuts & Dry Fruits"; }
  for (const w of OIL_WORDS) { if (n.includes(w)) return "Oils & Condiments"; }
  return "Other";
}

interface ShoppingItem {
  key: string;
  display: string;
  category: ShoppingCategory;
  recipes: string[];
}

function parseIngredient(raw: string): { skip: boolean; display: string; key: string; category: ShoppingCategory } {
  const line = raw.trim();

  // Skip by pattern
  for (const pat of SKIP_PATTERNS) {
    if (pat.test(line)) return { skip: true, display: "", key: "", category: "Other" };
  }

  // Skip small measure units
  if (SMALL_MEASURE_RE.test(line)) return { skip: true, display: "", key: "", category: "Other" };

  // Extract quantity + unit from start
  const qtyMatch = QTY_UNIT_RE.exec(line);
  let qty = "";
  let rest = line;
  if (qtyMatch) {
    qty = `${qtyMatch[1]} ${qtyMatch[2]}`.trim();
    rest = line.slice(qtyMatch[0].length);
  } else {
    // Try stripping a bare leading number (count: "15 almonds")
    const numMatch = LEADING_NUMBER_RE.exec(line);
    if (numMatch) {
      qty = numMatch[0].trim();
      rest = line.slice(numMatch[0].length);
    }
  }

  // Clean up ingredient name: remove descriptions after comma
  let name = rest
    .split(",")[0]           // drop "soaked and peeled" etc.
    .replace(/\b(fresh|dried|frozen|raw|ripe|peeled|deseeded|chopped|sliced|minced|grated|diced|crushed|coarsely|finely|roughly|thinly|thickly|large|medium|small|whole|full-fat|skimmed|low-fat|boneless|seedless|unsalted|salted|roasted|toasted|organic|full fat)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) return { skip: true, display: "", key: "", category: "Other" };

  // Capitalize first letter
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  const display = qty ? `${displayName} (${qty})` : displayName;
  const key = name.toLowerCase();

  // Check skip words after name extraction
  if (SKIP_INGREDIENT_WORDS.has(key)) return { skip: true, display: "", key: "", category: "Other" };

  const category = categorize(name);
  return { skip: false, display, key, category };
}

function buildShoppingList(allWeekRecipes: Recipe[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const recipe of allWeekRecipes) {
    for (const raw of recipe.ingredients) {
      const { skip, display, key, category } = parseIngredient(raw);
      if (skip || !key) continue;
      if (!map.has(key)) {
        map.set(key, { key, display, category, recipes: [] });
      }
      const entry = map.get(key)!;
      if (!entry.recipes.includes(recipe.title)) entry.recipes.push(recipe.title);
    }
  }
  return Array.from(map.values());
}

// ─── Component ───────────────────────────────────────────────

interface MealPlanTabProps {
  onViewRecipe: (recipe: Recipe) => void;
}

const CUISINE_FILTER_COLORS: Record<string, string> = {
  "All": "bg-neutral-800 text-white",
  "North Indian": "bg-orange-600 text-white",
  "South Indian": "bg-green-700 text-white",
  "Gujarati": "bg-yellow-600 text-white",
  "Maharashtrian": "bg-red-700 text-white",
  "Rajasthani": "bg-pink-700 text-white",
  "Bengali": "bg-blue-700 text-white",
  "Pan-Indian": "bg-teal-700 text-white",
  "Punjabi": "bg-orange-700 text-white",
  "Keralan": "bg-emerald-700 text-white",
  "Tamil": "bg-rose-700 text-white",
  "Andhra": "bg-red-600 text-white",
  "Fusion": "bg-purple-600 text-white",
};

export function MealPlanTab({ onViewRecipe }: MealPlanTabProps) {
  const qc = useQueryClient();

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("Monday");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCuisine, setPickerCuisine] = useState("All");
  const [showShopping, setShowShopping] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

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

  const planForDay = (day: DayOfWeek) => allPlans.find((p) => p.day === day);

  const dayRecipes = useMemo(() => {
    const plan = planForDay(selectedDay);
    const ids = plan?.recipeIds ?? [];
    return ids.map((id) => recipeMap.get(id)).filter(Boolean) as Recipe[];
  }, [allPlans, selectedDay, recipeMap]);

  const allWeekRecipes = useMemo(() => {
    const ids = new Set(allPlans.flatMap((p) => p.recipeIds ?? []));
    return allRecipes.filter((r) => ids.has(r.id));
  }, [allPlans, allRecipes]);

  const shoppingList = useMemo(() => buildShoppingList(allWeekRecipes), [allWeekRecipes]);

  const groupedShopping = useMemo(() => {
    const groups: Partial<Record<ShoppingCategory, ShoppingItem[]>> = {};
    for (const item of shoppingList) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category]!.push(item);
    }
    return groups;
  }, [shoppingList]);

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
    mutationFn: async ({ day, recipeId }: { day: string; recipeId: number }) => {
      const res = await fetch(`/api/meal-plans/${day}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipeId }),
      });
      if (!res.ok) throw new Error("Failed to add recipe");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ day, recipeId }: { day: string; recipeId: number }) => {
      const res = await fetch(`/api/meal-plans/${day}/recipes/${recipeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove recipe");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meal-plans"] }),
  });

  const clearDayMutation = useMutation({
    mutationFn: async (day: string) => {
      const res = await fetch(`/api/meal-plans/${day}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear");
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

  const onImgError = useCallback((id: number) => setImgErrors(prev => new Set([...prev, id])), []);

  const totalChecked = shoppingList.filter((item) => checkedKeys.has(item.key)).length;
  const totalItems = shoppingList.length;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <CalendarDays size={22} className="text-primary" />
            Weekly Meal Plan
          </h2>
          <p className="text-neutral-500 text-sm mt-0.5">Plan your week's meals and generate a smart shopping list.</p>
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
            Smartfill Week
          </Button>
          <Button
            data-testid="button-clear-week"
            size="sm"
            variant="outline"
            onClick={() => clearWeekMutation.mutate()}
            disabled={clearWeekMutation.isPending}
            className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs h-9"
          >
            {clearWeekMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <RotateCcw size={13} className="mr-1.5" />}
            Clear Week
          </Button>
        </div>
      </div>

      {/* Day Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {DAYS_OF_WEEK.map((day) => {
          const plan = planForDay(day);
          const count = plan?.recipeIds?.length ?? 0;
          const isActive = selectedDay === day;
          return (
            <button
              key={day}
              data-testid={`day-pill-${day.toLowerCase()}`}
              onClick={() => { setSelectedDay(day); setShowPicker(false); }}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary/40 hover:text-primary"
              }`}
            >
              <span>{DAY_ABBR[day]}</span>
              {count > 0 && (
                <span className={`text-[9px] font-medium rounded-full px-1 ${isActive ? "bg-white/30 text-white" : "bg-primary/10 text-primary"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Card */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm mb-5">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700">
          <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-base">{selectedDay}</h3>
          <div className="flex items-center gap-2">
            {dayRecipes.length > 0 && (
              <button
                data-testid={`button-clear-day-${selectedDay.toLowerCase()}`}
                onClick={() => clearDayMutation.mutate(selectedDay)}
                disabled={clearDayMutation.isPending}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={12} />
                Clear day
              </button>
            )}
            <button
              data-testid={`button-add-${selectedDay.toLowerCase()}`}
              onClick={() => setShowPicker((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                showPicker
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-primary/30 text-primary hover:bg-primary/5"
              }`}
            >
              {showPicker ? <X size={12} /> : <Plus size={12} />}
              {showPicker ? "Close" : "Add Recipe"}
            </button>
          </div>
        </div>

        {plansLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : dayRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-neutral-400">
            <UtensilsCrossed size={28} className="mb-2 opacity-40" />
            <p className="text-sm">No meals planned for {selectedDay}.</p>
            <button onClick={() => setShowPicker(true)} className="mt-2 text-xs text-primary hover:underline">
              + Add recipes
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {dayRecipes.map((recipe) => (
              <div
                key={recipe.id}
                data-testid={`meal-card-${selectedDay.toLowerCase()}-${recipe.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all cursor-pointer group"
                onClick={() => onViewRecipe(recipe)}
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                  {recipe.imageUrl && !imgErrors.has(recipe.id) ? (
                    <img
                      src={`${recipe.imageUrl}?v=2`}
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                      onError={() => onImgError(recipe.id)}
                    />
                  ) : (
                    <ChefHat size={22} className="text-neutral-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm line-clamp-1">{recipe.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{recipe.cuisineType}</p>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-neutral-400">
                    <Clock size={10} />
                    {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min
                  </div>
                </div>
                <button
                  data-testid={`button-remove-${recipe.id}`}
                  onClick={(e) => { e.stopPropagation(); removeMutation.mutate({ day: selectedDay, recipeId: recipe.id }); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipe Picker */}
      {showPicker && (
        <div
          data-testid="recipe-picker"
          className="bg-white dark:bg-neutral-800 rounded-2xl border border-primary/20 shadow-lg mb-5 overflow-hidden"
          style={{ maxHeight: 480 }}
        >
          <div className="flex h-full">
            {/* Left: search + recipe grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700">
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
              <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: 400 }}>
                {recipesLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                    {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                  </div>
                ) : filteredPicker.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-neutral-400 text-sm gap-2">
                    <UtensilsCrossed size={22} className="opacity-40" />
                    <p>No recipes found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                    {filteredPicker.map((recipe) => {
                      const plan = planForDay(selectedDay);
                      const added = (plan?.recipeIds ?? []).includes(recipe.id);
                      return (
                        <button
                          key={recipe.id}
                          data-testid={`picker-item-${recipe.id}`}
                          disabled={added || addMutation.isPending}
                          onClick={() => addMutation.mutate({ day: selectedDay, recipeId: recipe.id })}
                          className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all ${
                            added
                              ? "opacity-40 cursor-not-allowed border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700"
                              : "border-neutral-200 dark:border-neutral-700 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 active:scale-95"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                            {recipe.imageUrl && !imgErrors.has(recipe.id) ? (
                              <img
                                src={`${recipe.imageUrl}?v=2`}
                                alt={recipe.title}
                                className="w-full h-full object-cover"
                                onError={() => onImgError(recipe.id)}
                              />
                            ) : (
                              <ChefHat size={18} className="text-neutral-400" />
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-200 leading-tight line-clamp-2">
                            {recipe.title}
                          </span>
                          {added && (
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

            {/* Right: cuisine category filter */}
            <div className="w-28 sm:w-32 flex-shrink-0 border-l border-neutral-100 dark:border-neutral-700 overflow-y-auto p-2 flex flex-col gap-1" style={{ maxHeight: 480 }}>
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

      {/* Shopping List Toggle Button */}
      <button
        data-testid="button-shopping-list"
        onClick={() => setShowShopping((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all mb-3 ${
          showShopping
            ? "bg-primary text-white border-primary shadow-md"
            : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-primary/40"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <ShoppingCart size={17} />
          <span className="font-semibold text-sm">Shopping List</span>
          {totalItems > 0 && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              showShopping ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            }`}>
              {totalItems - totalChecked} remaining
            </span>
          )}
        </div>
        <span className="text-xs opacity-70">{showShopping ? "Hide" : "View list →"}</span>
      </button>

      {/* Shopping List Panel */}
      {showShopping && (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
          {totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <ShoppingCart size={28} className="mb-2 opacity-40" />
              <p className="text-sm">Add meals to your plan to generate a shopping list.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 dark:border-neutral-700">
                <p className="text-xs text-neutral-500">
                  {totalChecked} of {totalItems} items checked off
                </p>
                {totalChecked > 0 && (
                  <button
                    onClick={() => clearChecksMutation.mutate()}
                    className="text-xs text-neutral-400 hover:text-neutral-600 underline"
                  >
                    Clear checks
                  </button>
                )}
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {CATEGORY_ORDER.map((category) => {
                  const items = groupedShopping[category];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={category} className="px-5 py-4">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
                        <span className="text-base">{CATEGORY_ICONS[category]}</span>
                        {category}
                        <span className="normal-case font-normal text-neutral-400">({items.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                        {items.map((item) => {
                          const checked = checkedKeys.has(item.key);
                          return (
                            <button
                              key={item.key}
                              data-testid={`shopping-item-${item.key}`}
                              onClick={() => toggleCheckMutation.mutate(item.key)}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                                checked
                                  ? "bg-neutral-50 dark:bg-neutral-700/50 text-neutral-400 dark:text-neutral-500 line-through"
                                  : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-200"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                checked
                                  ? "bg-primary border-primary"
                                  : "border-neutral-300 dark:border-neutral-500"
                              }`}>
                                {checked && <Check size={10} className="text-white" />}
                              </div>
                              <span className="truncate text-[13px]">{item.display}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
