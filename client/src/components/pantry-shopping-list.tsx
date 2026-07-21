import { useMemo } from "react";
import { ShoppingCart } from "lucide-react";

/**
 * Pantry Shopping List — turns the "missing ingredients" from recipe matches
 * into a shopping list, with Amazon affiliate "Buy" links for shelf-stable
 * pantry staples only. Fresh/perishable items are shown (so the list is honest
 * and complete) but NOT linked, because they don't convert / aren't eligible.
 *
 * Pure frontend. Amazon search URLs are built in the browser with the affiliate
 * tag appended. No backend change.
 *
 * Amazon Associates requires the disclosure line — keep it.
 */

const AMAZON_TAG = "veggenie-21";
const AMAZON_DOMAIN = "https://www.amazon.in";

interface PantryShoppingListProps {
  /** All missing-ingredient strings gathered from recipe suggestions (missingMain + missingSpices). */
  missingItems: string[];
}

// Shelf-stable / packaged goods that genuinely sell on Amazon → get a Buy link.
const BUYABLE_KEYWORDS = [
  // dals & pulses
  "toor dal", "arhar dal", "moong dal", "chana dal", "masoor dal", "urad dal",
  "rajma", "chickpea", "chana", "lobia", "black-eyed", "lentil", "dal",
  // spices & masalas
  "cumin", "jeera", "turmeric", "haldi", "coriander powder", "coriander seeds",
  "garam masala", "masala", "red chilli powder", "chilli powder", "mustard seed",
  "asafoetida", "hing", "cardamom", "elaichi", "clove", "cinnamon", "bay leaf",
  "peppercorn", "black pepper", "fennel", "saunf", "nutmeg", "star anise",
  "dry red chilli", "kasuri methi", "curry powder", "chaat masala", "sambar powder",
  "rasam powder", "pav bhaji masala",
  // flours & grains
  "besan", "gram flour", "atta", "wheat flour", "maida", "rava", "semolina", "sooji",
  "poha", "vermicelli", "rice", "basmati", "cornmeal", "cornflour", "oats",
  // fats & oils (shelf-stable)
  "ghee", "oil", "mustard oil", "sesame oil", "coconut oil", "sunflower oil", "groundnut oil",
  // pantry misc
  "tamarind", "cashew", "kaju", "almond", "raisin", "peanut", "groundnut",
  "coconut milk", "jaggery", "gur", "sugar", "salt", "vinegar", "soy sauce",
  "papad", "dried", "pickle", "honey", "vanilla", "baking soda", "baking powder",
  "yeast", "sabudana", "sago", "makhana", "fox nut", "ginger-garlic paste",
  "ginger garlic paste", "garlic paste", "ginger paste", "chickpea", "chickpeas",
];

// Fresh / perishable → shown but NOT linked. (Includes butter, per decision — perishable.)
const FRESH_KEYWORDS = [
  "onion", "tomato", "potato", "spinach", "palak", "mustard leaves", "coriander leaves",
  "cilantro", "curry leaves", "green chilli", "green chillies", "chilli", "ginger",
  "garlic", "lemon", "lime", "cucumber", "carrot", "peas", "matar", "cabbage",
  "cauliflower", "gobi", "methi", "fenugreek leaves", "drumstick", "capsicum",
  "bell pepper", "banana", "mango", "coconut", "milk", "curd", "dahi", "yogurt",
  "cream", "paneer", "butter", "cheese", "okra", "bhindi", "eggplant", "brinjal",
  "baingan", "bottle gourd", "lauki", "beans", "beetroot", "radish", "mint",
  "pudina", "spring onion", "leek", "celery", "avocado", "tofu", "mushroom",
  "edamame", "hummus", "tortilla", "bread",
];

function stripQuantity(raw: string): string {
  return raw
    // leading numbers, fractions, ranges
    .replace(/^[\d\/¼½¾.\s-]+/, "")
    // units anywhere
    .replace(
      /\b(g|gm|gms|kg|ml|l|ltr|cups?|tbsp|tsp|tablespoons?|teaspoons?|pinch|inch|inches|cloves?|bunch|handful|packet|pkt|can|cans|slices?|pieces?|nos?|nos\.)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function classify(name: string): "buy" | "fresh" {
  const l = name.toLowerCase();
  // Packaged exceptions that would otherwise be caught by a fresh substring
  // (e.g. "chickpeas" contains "peas"; "ginger-garlic paste" contains "ginger"/"garlic").
  const BUY_OVERRIDES = [
    "chickpea", "ginger-garlic paste", "ginger garlic paste", "garlic paste", "ginger paste",
    "coriander powder", "coriander seeds", "dried",
  ];
  if (BUY_OVERRIDES.some((o) => l.includes(o))) return "buy";
  // fresh check next so e.g. "coriander leaves" (fresh) doesn't match "coriander powder" (buy)
  if (FRESH_KEYWORDS.some((f) => l.includes(f))) return "fresh";
  if (BUYABLE_KEYWORDS.some((b) => l.includes(b))) return "buy";
  return "fresh"; // unknown → never fake-link something we can't sell
}

function amazonSearchUrl(term: string): string {
  return `${AMAZON_DOMAIN}/s?k=${encodeURIComponent(term)}&tag=${AMAZON_TAG}`;
}

export function PantryShoppingList({ missingItems }: PantryShoppingListProps) {
  const { buyable, fresh } = useMemo(() => {
    const seen = new Set<string>();
    const buyable: string[] = [];
    const fresh: string[] = [];
    for (const raw of missingItems) {
      const name = stripQuantity(raw);
      if (!name || name.length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (classify(name) === "buy" ? buyable : fresh).push(name);
    }
    return { buyable, fresh };
  }, [missingItems]);

  if (buyable.length === 0 && fresh.length === 0) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <ShoppingCart size={16} className="text-primary" />
        <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">Shopping List</h3>
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">
        Missing ingredients from your matches. Pantry staples link to Amazon.
      </p>

      {/* Buyable pantry staples */}
      {buyable.length > 0 && (
        <div className="space-y-2">
          {buyable.map((name) => (
            <div
              key={name}
              data-testid={`shop-buy-${name}`}
              className="flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2.5"
            >
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{titleCase(name)}</span>
              <a
                href={amazonSearchUrl(name)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap"
              >
                Buy on Amazon
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Fresh / local — shown, not linked */}
      {fresh.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-2">
            Fresh &amp; local — grab at your market
          </p>
          <div className="flex flex-wrap gap-2">
            {fresh.map((name) => (
              <span
                key={name}
                className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-full px-3 py-1 text-xs font-medium"
              >
                {titleCase(name)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* "Shop all" + required Amazon Associates disclosure */}
      {buyable.length > 0 && (
        <>
          <a
            href={amazonSearchUrl("indian cooking essentials spices dal ghee")}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center justify-center gap-2 mt-4 bg-primary hover:bg-primary/90 text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            Shop all pantry staples on Amazon
          </a>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center mt-2">
            As an Amazon Associate, Palate Lit earns from qualifying purchases.
          </p>
        </>
      )}
    </div>
  );
}
