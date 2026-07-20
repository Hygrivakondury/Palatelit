import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Check, Sparkles } from "lucide-react";

/**
 * Pick & Mix — visual ingredient grid for the Pantry tab.
 *
 * How it works:
 *  - Tiles are grouped by category tabs (All / Vegetables / Dals & Pulses / Dairy / Spices / Grains / Fruits).
 *  - Tapping a tile stages it in a local selection (highlighted terracotta + check).
 *  - "Add to pantry" sends the whole selection in ONE call via the parent's onAddItems([...names]),
 *    which is the same addItemsMutation the text box already uses. No new backend needed.
 *  - Ingredients already in the pantry render as "added" (disabled, green tick) so users
 *    don't double-add. Everything then flows into the existing /suggest + /generate-recipe engines
 *    through the existing "Find Recipes from My Pantry" button.
 */

interface PantryPickMixProps {
  /** Names already saved in the pantry (lower-cased match), so we can show them as "added". */
  existingNames: string[];
  /** Adds the selected ingredient names to the pantry in one call. */
  onAddItems: (names: string[]) => void;
  /** True while the add call is in flight. */
  isAdding: boolean;
}

type Item = { name: string; emoji: string };

const CATEGORIES: Record<string, Item[]> = {
  Vegetables: [
    { name: "Onion", emoji: "🧅" },
    { name: "Tomato", emoji: "🍅" },
    { name: "Potato", emoji: "🥔" },
    { name: "Spinach", emoji: "🥬" },
    { name: "Cauliflower", emoji: "🥦" },
    { name: "Okra", emoji: "🌿" },
    { name: "Eggplant", emoji: "🍆" },
    { name: "Peas", emoji: "🟢" },
    { name: "Carrot", emoji: "🥕" },
    { name: "Capsicum", emoji: "🫑" },
    { name: "Green Beans", emoji: "🫘" },
    { name: "Bottle Gourd", emoji: "🥒" },
    { name: "Cabbage", emoji: "🥬" },
    { name: "Fenugreek", emoji: "🌿" },
    { name: "Drumstick", emoji: "🌱" },
    { name: "Cucumber", emoji: "🥒" },
  ],
  "Dals & Pulses": [
    { name: "Toor Dal", emoji: "🟡" },
    { name: "Moong Dal", emoji: "🟢" },
    { name: "Chana Dal", emoji: "🟠" },
    { name: "Masoor Dal", emoji: "🔴" },
    { name: "Urad Dal", emoji: "⚪" },
    { name: "Rajma", emoji: "🫘" },
    { name: "Chickpeas", emoji: "🟤" },
    { name: "Lobia", emoji: "⚪" },
  ],
  Dairy: [
    { name: "Paneer", emoji: "🧀" },
    { name: "Curd", emoji: "🥛" },
    { name: "Ghee", emoji: "🧈" },
    { name: "Butter", emoji: "🧈" },
    { name: "Milk", emoji: "🥛" },
    { name: "Cream", emoji: "🥛" },
    { name: "Cheese", emoji: "🧀" },
  ],
  Spices: [
    { name: "Cumin", emoji: "🟤" },
    { name: "Turmeric", emoji: "🟡" },
    { name: "Coriander", emoji: "🌿" },
    { name: "Garam Masala", emoji: "🥄" },
    { name: "Mustard Seeds", emoji: "🟤" },
    { name: "Red Chilli", emoji: "🌶️" },
    { name: "Curry Leaves", emoji: "🍃" },
    { name: "Ginger", emoji: "🫚" },
    { name: "Garlic", emoji: "🧄" },
    { name: "Green Chilli", emoji: "🌶️" },
    { name: "Asafoetida", emoji: "🥄" },
    { name: "Cardamom", emoji: "🟢" },
  ],
  Grains: [
    { name: "Rice", emoji: "🍚" },
    { name: "Wheat Flour", emoji: "🌾" },
    { name: "Besan", emoji: "🟡" },
    { name: "Semolina", emoji: "🥣" },
    { name: "Poha", emoji: "⚪" },
    { name: "Vermicelli", emoji: "🍜" },
  ],
  Fruits: [
    { name: "Lemon", emoji: "🍋" },
    { name: "Raw Mango", emoji: "🥭" },
    { name: "Coconut", emoji: "🥥" },
    { name: "Banana", emoji: "🍌" },
    { name: "Tamarind", emoji: "🟤" },
  ],
};

const TABS = ["All", ...Object.keys(CATEGORIES)];

export function PantryPickMix({ existingNames, onAddItems, isAdding }: PantryPickMixProps) {
  const [activeTab, setActiveTab] = useState<string>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const existingSet = new Set(existingNames.map((n) => n.trim().toLowerCase()));

  const itemsFor = (tab: string): Item[] =>
    tab === "All" ? Object.values(CATEGORIES).flat() : CATEGORIES[tab] ?? [];

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd = [...selected];
    if (toAdd.length === 0) return;
    onAddItems(toAdd);
    setSelected(new Set());
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">Pick &amp; Mix</h3>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">Tap what you have</span>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const on = tab === activeTab;
          return (
            <button
              key={tab}
              data-testid={`pickmix-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                on
                  ? "bg-primary text-white"
                  : "bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-primary/40"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Ingredient grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
        {itemsFor(activeTab).map((item) => {
          const already = existingSet.has(item.name.trim().toLowerCase());
          const picked = selected.has(item.name);
          return (
            <button
              key={item.name}
              data-testid={`pickmix-tile-${item.name}`}
              disabled={already}
              onClick={() => toggle(item.name)}
              className={`relative flex flex-col items-center gap-1 py-3 px-1.5 rounded-xl border transition-all ${
                already
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 cursor-not-allowed"
                  : picked
                  ? "bg-primary/10 border-2 border-primary"
                  : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-primary/40"
              }`}
            >
              <span className="text-2xl leading-none">{item.emoji}</span>
              <span
                className={`text-[11px] font-medium text-center leading-tight ${
                  already
                    ? "text-green-700 dark:text-green-300"
                    : picked
                    ? "text-primary"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {item.name}
              </span>
              {(picked || already) && (
                <span
                  className={`absolute top-1 right-1 w-4 h-4 rounded-full text-white flex items-center justify-center ${
                    already ? "bg-green-500" : "bg-primary"
                  }`}
                >
                  <Check size={10} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add-to-pantry action */}
      {selected.size > 0 && (
        <Button
          data-testid="pickmix-add"
          onClick={handleAdd}
          disabled={isAdding}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {isAdding ? (
            <Loader2 size={15} className="animate-spin mr-1.5" />
          ) : (
            <Plus size={15} className="mr-1.5" />
          )}
          Add {selected.size} to pantry
        </Button>
      )}
    </div>
  );
}
