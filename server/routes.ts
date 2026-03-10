import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertRecipeSchema, insertReviewSchema, insertChallengeSchema, CUISINE_TYPES } from "@shared/schema";
import { seedRecipes } from "./seed";
import { sendContributionEmail } from "./email";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const COMMON_SPICES = new Set([
  "cumin", "cumin seeds", "jeera", "garam masala", "coriander powder", "turmeric",
  "turmeric powder", "red chilli powder", "chilli powder", "mustard seeds", "curry leaves",
  "asafoetida", "hing", "bay leaves", "cardamom", "cloves", "cinnamon", "fenugreek",
  "kasuri methi", "amchur", "tamarind", "salt", "oil", "ghee", "butter", "water",
  "pepper", "black pepper", "dried red chillies", "green chillies", "ginger",
  "ginger-garlic paste", "garlic", "lemon juice", "sugar", "fresh coriander",
]);

function classifyMissing(recipeIngredient: string, pantrySet: Set<string>): "main" | "spice" | null {
  const lower = recipeIngredient.toLowerCase();
  const inPantry = [...pantrySet].some((item) => lower.includes(item) || item.includes(lower));
  if (inPantry) return null;
  const isSpice = [...COMMON_SPICES].some((s) => lower.includes(s));
  return isSpice ? "spice" : "main";
}

const ADMIN_EMAILS = new Set([
  "genieflavour@gmail.com",
  "gurumurthy.sastry@gmail.com",
]);

function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase().trim());
}

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── AUTO IMAGE GENERATION HELPERS ────────────────────────────────────────

async function generateAndSaveRecipeImage(id: number, title: string): Promise<void> {
  try {
    const prompt = `A high-quality, realistic food photography photo of ${title}, an Indian vegetarian dish. 
Beautifully plated on a traditional ceramic or copper serving dish, styled with garnishes like fresh coriander, 
lemon wedge, and relevant spices. Warm, natural lighting. Professional restaurant-quality presentation. 
Shot from slightly above, clean background. Photorealistic, appetising.`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const b64 = imageResponse.data[0]?.b64_json;
    if (!b64) throw new Error("No image data returned");

    const filename = `recipe_${id}_${Date.now()}.png`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, Buffer.from(b64, "base64"));
    await storage.updateRecipeImage(id, `/uploads/${filename}`);
    console.log(`[image] Auto-generated image for recipe ${id} (${title})`);
  } catch (err) {
    console.error(`[image] Failed to auto-generate image for recipe ${id}:`, err);
  }
}

async function migrateUserRecipeImages(): Promise<void> {
  try {
    const allRecipes = await storage.getRecipes();
    // Find user-submitted recipes with null or broken stock-image URLs
    const needsImage = allRecipes.filter(
      (r) => r.isUserSubmitted && (!r.imageUrl || r.imageUrl.startsWith("/stock-images/"))
    );
    if (needsImage.length === 0) return;
    console.log(`[image] Generating AI images for ${needsImage.length} user-submitted recipe(s) in background...`);
    for (const recipe of needsImage) {
      await generateAndSaveRecipeImage(recipe.id, recipe.title);
    }
  } catch (err) {
    console.error("[image] Migration error:", err);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Serve uploaded images
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    next();
  }, (await import("express")).default.static(uploadDir));

  // Serve stock images
  const stockImgDir = path.join(process.cwd(), "attached_assets", "stock_images");
  if (!fs.existsSync(stockImgDir)) fs.mkdirSync(stockImgDir, { recursive: true });
  app.use("/stock-images", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    next();
  }, (await import("express")).default.static(stockImgDir));

  // Seed on startup
  await seedRecipes();

  // ─── RECIPES ──────────────────────────────────────────────────
  app.get("/api/recipes", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const cuisine = req.query.cuisine as string | undefined;
      const recipeList = await storage.getRecipes(search, cuisine);
      res.json(recipeList);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  });

  app.get("/api/recipes/community", async (_req, res) => {
    try {
      const communityRecipes = await storage.getCommunityRecipes();
      res.json(communityRecipes);
    } catch (err) {
      console.error("Error fetching community recipes:", err);
      res.status(500).json({ message: "Failed to fetch community recipes" });
    }
  });

  app.get("/api/recipes/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const myRecipes = await storage.getUserRecipes(userId);
      res.json(myRecipes);
    } catch (err) {
      console.error("Error fetching user recipes:", err);
      res.status(500).json({ message: "Failed to fetch your recipes" });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipe = await storage.getRecipe(id);
      if (!recipe) return res.status(404).json({ message: "Recipe not found" });
      res.json(recipe);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      const userId = user.sub;

      const body = {
        ...req.body,
        submittedBy: userId,
        submittedByName: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Community Member",
        submittedByImage: user.profile_image_url ?? null,
        isUserSubmitted: true,
        authorId: userId,
      };

      const recipe = await storage.createRecipe(body);
      res.status(201).json(recipe);

      // Background: generate an AI photo for the new community recipe
      generateAndSaveRecipeImage(recipe.id, recipe.title);

      const source = req.body.challengeId ? "challenge" : "community";
      const recipientEmail = user.email;
      if (recipientEmail) {
        sendContributionEmail(recipientEmail, body.submittedByName, recipe.title, source).catch(() => {});
      }
    } catch (err) {
      console.error("Error creating recipe:", err);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  app.post("/api/recipes/:id/image", isAuthenticated, upload.single("image"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const imageUrl = `/uploads/${req.file.filename}`;
      const updated = await storage.updateRecipeImage(id, imageUrl);
      if (!updated) return res.status(404).json({ message: "Recipe not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error uploading image:", err);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // ─── FAVORITES ────────────────────────────────────────────────
  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favs = await storage.getFavoritesByUser(userId);
      res.json(favs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recipeId } = req.body;
      if (!recipeId) return res.status(400).json({ message: "recipeId required" });
      const already = await storage.isFavorited(userId, recipeId);
      if (already) return res.status(409).json({ message: "Already favorited" });
      const fav = await storage.addFavorite(userId, recipeId);
      res.status(201).json(fav);
    } catch (err) {
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete("/api/favorites/:recipeId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.recipeId);
      await storage.removeFavorite(userId, recipeId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // ─── REVIEWS ──────────────────────────────────────────────────
  app.get("/api/recipes/:id/reviews", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      const reviewList = await storage.getReviewsByRecipe(recipeId);
      res.json(reviewList);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/recipes/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      const user = req.user.claims;
      const parsed = insertReviewSchema.safeParse({ ...req.body, userId: user.sub, recipeId });
      if (!parsed.success) return res.status(400).json({ message: "Invalid review data" });

      const authorName = user.first_name
        ? `${user.first_name} ${user.last_name ?? ""}`.trim()
        : user?.email ?? "Anonymous";

      const review = await storage.addReview({
        ...parsed.data,
        authorName,
        authorImageUrl: user?.profile_image_url ?? null,
      });
      res.status(201).json(review);
    } catch (err) {
      console.error("Error adding review:", err);
      res.status(500).json({ message: "Failed to add review" });
    }
  });

  // ─── CHALLENGES ───────────────────────────────────────────────
  app.get("/api/challenges", async (_req, res) => {
    try {
      const all = await storage.getChallenges();
      res.json(all);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch challenges" });
    }
  });

  app.get("/api/challenges/active", async (_req, res) => {
    try {
      const challenge = await storage.getActiveChallenge();
      res.json(challenge ?? null);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch active challenge" });
    }
  });

  app.post("/api/challenges", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      if (!isAdminEmail(user.email)) {
        return res.status(403).json({ message: "Admin only" });
      }

      const parsed = insertChallengeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid challenge data" });

      const challenge = await storage.createChallenge(parsed.data, user.sub);
      res.status(201).json(challenge);
    } catch (err) {
      console.error("Error creating challenge:", err);
      res.status(500).json({ message: "Failed to create challenge" });
    }
  });

  app.patch("/api/challenges/:id/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      if (!isAdminEmail(user.email)) {
        return res.status(403).json({ message: "Admin only" });
      }

      const id = parseInt(req.params.id);
      const updated = await storage.toggleChallengeActive(id);
      if (!updated) return res.status(404).json({ message: "Challenge not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle challenge" });
    }
  });

  // ─── COMMUNITY MESSAGES ───────────────────────────────────────
  app.get("/api/community-messages/:recipeId", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.recipeId);
      const messages = await storage.getMessagesByRecipe(recipeId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/community-messages/:recipeId", isAuthenticated, async (req: any, res) => {
    try {
      const recipeId = parseInt(req.params.recipeId);
      const user = req.user.claims;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content required" });

      const senderName = user.first_name
        ? `${user.first_name} ${user.last_name ?? ""}`.trim()
        : user.email ?? "Community Member";
      const senderImageUrl = user.profile_image_url ?? null;

      const msg = await storage.addCommunityMessage(
        recipeId, user.sub, senderName, senderImageUrl, content.trim()
      );
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ─── USER PROFILE / ADMIN ─────────────────────────────────────
  app.get("/api/my-profile", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user.claims;
      res.json({
        userId: user.sub,
        isAdmin: isAdminEmail(user.email),
        email: user.email,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/claim-admin", isAuthenticated, (_req, res) => {
    res.status(403).json({ message: "Admin access is restricted to authorised accounts only." });
  });

  // ─── PANTRY ────────────────────────────────────────────────────
  app.get("/api/pantry", isAuthenticated, async (req: any, res) => {
    try {
      const items = await storage.getPantryItems(req.user.claims.sub);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pantry" });
    }
  });

  app.post("/api/pantry/items", isAuthenticated, async (req: any, res) => {
    try {
      const { names } = req.body;
      if (!Array.isArray(names) || names.length === 0) {
        return res.status(400).json({ message: "names array required" });
      }
      const items = await storage.addPantryItems(req.user.claims.sub, names);
      res.status(201).json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to add pantry items" });
    }
  });

  app.delete("/api/pantry/items/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.removePantryItem(req.user.claims.sub, parseInt(req.params.id));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to remove item" });
    }
  });

  app.delete("/api/pantry", isAuthenticated, async (req: any, res) => {
    try {
      await storage.clearPantry(req.user.claims.sub);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to clear pantry" });
    }
  });

  app.post("/api/pantry/analyze-photo", isAuthenticated, upload.single("photo"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Photo required" });

      const imageData = fs.readFileSync(req.file.path).toString("base64");
      const mimeType = req.file.mimetype as string;

      const response = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: { mimeType, data: imageData },
              },
              {
                text: `You are a vegetable and ingredient identification expert.
Look at this image carefully and identify ALL vegetables, fruits, legumes, grains, dairy products, and cooking ingredients visible.
Return ONLY a valid JSON array of ingredient names in English, lowercase, singular form.
Example: ["spinach", "potato", "tomato", "onion", "garlic", "paneer", "lentil"]
Do NOT include non-food items, cooking utensils, or packaging text.
Do NOT wrap the JSON in markdown code fences. Return raw JSON only.`,
              },
            ],
          },
        ],
      });

      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      const rawText = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      console.log("[Pantry] Gemini raw response:", rawText?.slice(0, 200));
      let ingredients: string[] = [];
      try {
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        ingredients = JSON.parse(cleaned);
        if (!Array.isArray(ingredients)) ingredients = [];
      } catch {
        ingredients = [];
      }

      res.json({ ingredients });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error("Photo analysis error:", err);
      res.status(500).json({ message: "Failed to analyse photo" });
    }
  });

  app.post("/api/pantry/suggest", isAuthenticated, async (req: any, res) => {
    try {
      const pantry = await storage.getPantryItems(req.user.claims.sub);
      if (pantry.length === 0) {
        return res.json({ suggestions: [] });
      }
      const pantrySet = new Set(pantry.map((p) => p.name.toLowerCase()));
      const allRecipes = await storage.getRecipes();

      const scored = allRecipes.map((recipe) => {
        let matches = 0;
        const missingMain: string[] = [];
        const missingSpices: string[] = [];

        for (const ingredient of recipe.ingredients) {
          const type = classifyMissing(ingredient, pantrySet);
          if (type === null) {
            matches++;
          } else if (type === "main") {
            missingMain.push(ingredient.replace(/\(.*?\)/g, "").split(",")[0].trim());
          } else {
            missingSpices.push(ingredient.replace(/\(.*?\)/g, "").split(",")[0].trim());
          }
        }

        const matchPct = Math.round((matches / Math.max(recipe.ingredients.length, 1)) * 100);
        return { recipe, matchPct, missingMain: missingMain.slice(0, 4), missingSpices: missingSpices.slice(0, 4) };
      });

      const top = scored
        .filter((s) => s.matchPct > 0)
        .sort((a, b) => b.matchPct - a.matchPct)
        .slice(0, 6);

      res.json({ suggestions: top });
    } catch (err) {
      console.error("Suggest error:", err);
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  // ─── MEAL PLANS ────────────────────────────────────────────────
  app.get("/api/meal-plans", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      if (!email) return res.status(400).json({ message: "User email not available" });
      const plans = await storage.getMealPlansByEmail(email);
      res.json(plans);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch meal plans" });
    }
  });

  app.get("/api/meal-plans/:day", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      const { day } = req.params;
      if (!email) return res.status(400).json({ message: "User email not available" });
      const plan = await storage.getMealPlan(email, day);
      res.json(plan ?? { userEmail: email, day, recipeIds: [] });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch meal plan" });
    }
  });

  app.post("/api/meal-plans/:day/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      const { day } = req.params;
      const { recipeId } = req.body;
      if (!email) return res.status(400).json({ message: "User email not available" });
      if (typeof recipeId !== "number") return res.status(400).json({ message: "recipeId must be a number" });
      const plan = await storage.addRecipeToMealPlan(email, day, recipeId);
      res.json(plan);
    } catch (err) {
      res.status(500).json({ message: "Failed to add recipe to meal plan" });
    }
  });

  app.delete("/api/meal-plans/:day/recipes/:recipeId", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      const { day, recipeId } = req.params;
      if (!email) return res.status(400).json({ message: "User email not available" });
      const plan = await storage.removeRecipeFromMealPlan(email, day, parseInt(recipeId));
      res.json(plan);
    } catch (err) {
      res.status(500).json({ message: "Failed to remove recipe from meal plan" });
    }
  });

  app.delete("/api/meal-plans/:day", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      const { day } = req.params;
      if (!email) return res.status(400).json({ message: "User email not available" });
      await storage.clearMealPlanDay(email, day);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to clear meal plan day" });
    }
  });

  // ─── MEAL PLAN SMARTFILL + CLEAR WEEK ─────────────────────────
  app.post("/api/meal-plans/smartfill", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      if (!email) return res.status(400).json({ message: "User email not available" });
      const allRecipes = await storage.getRecipes();
      if (allRecipes.length === 0) return res.status(400).json({ message: "No recipes available" });
      const shuffled = [...allRecipes].sort(() => Math.random() - 0.5);
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const mealsPerDay = 2;
      const totalSlots = days.length * mealsPerDay;
      const slots: number[] = [];
      for (let i = 0; i < totalSlots; i++) {
        slots.push(shuffled[i % shuffled.length].id);
      }
      for (let i = 0; i < days.length; i++) {
        await storage.upsertMealPlan(email, days[i], [slots[i * 2], slots[i * 2 + 1]]);
      }
      const plans = await storage.getMealPlansByEmail(email);
      res.json(plans);
    } catch (err) {
      res.status(500).json({ message: "Failed to smartfill meal plan" });
    }
  });

  app.delete("/api/meal-plans", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      if (!email) return res.status(400).json({ message: "User email not available" });
      await storage.clearWeekPlan(email);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to clear week plan" });
    }
  });

  // ─── SHOPPING CHECKED ──────────────────────────────────────────
  app.get("/api/shopping-checked", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      if (!email) return res.status(400).json({ message: "User email not available" });
      const checkedKeys = await storage.getShoppingChecked(email);
      res.json({ checkedKeys });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch shopping checked state" });
    }
  });

  app.post("/api/shopping-checked/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      if (!email) return res.status(400).json({ message: "User email not available" });
      const { key } = req.body;
      if (typeof key !== "string") return res.status(400).json({ message: "key must be a string" });
      const checkedKeys = await storage.toggleShoppingItem(email, key);
      res.json({ checkedKeys });
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle shopping item" });
    }
  });

  app.delete("/api/shopping-checked", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      if (!email) return res.status(400).json({ message: "User email not available" });
      await storage.clearShoppingChecked(email);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to clear shopping checked state" });
    }
  });

  // ─── AI IMAGE GENERATION ───────────────────────────────────────
  app.post("/api/recipes/:id/generate-image", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipe = await storage.getRecipe(id);
      if (!recipe) return res.status(404).json({ message: "Recipe not found" });

      const prompt = `A high-quality, realistic food photography photo of ${recipe.title}, an Indian vegetarian dish. 
Beautifully plated on a traditional ceramic or copper serving dish, styled with garnishes like fresh coriander, 
lemon wedge, and relevant spices. Warm, natural lighting. Professional restaurant-quality presentation. 
Shot from slightly above, clean background. Photorealistic, appetising.`;

      const imageResponse = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      });

      const b64 = imageResponse.data[0]?.b64_json;
      if (!b64) return res.status(500).json({ message: "No image returned" });

      const filename = `recipe_${id}_${Date.now()}.png`;
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, Buffer.from(b64, "base64"));
      const imageUrl = `/uploads/${filename}`;
      await storage.updateRecipeImage(id, imageUrl);

      res.json({ imageUrl, b64_json: b64, mimeType: "image/png" });
    } catch (err) {
      console.error("Image generation error:", err);
      res.status(500).json({ message: "Failed to generate image" });
    }
  });

  // ─── SMART CHEF AI ────────────────────────────────────────────
  app.post("/api/chef-chat/save-recipe", isAuthenticated, async (req: any, res) => {
    try {
      const { messageText } = req.body;
      if (!messageText) return res.status(400).json({ message: "messageText required" });

      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Extract the recipe from the following cooking assistant message and return it as a single JSON object with these exact fields:
- title: string (the recipe name, e.g. "Palak Paneer")
- description: string (1-2 sentence description of the dish)
- ingredients: string[] (each as "quantity ingredient", e.g. ["200g paneer", "2 cups spinach"])
- instructions: string[] (each step as a complete sentence, no numbering)
- prepTime: number (prep time in minutes, integer)
- cookTime: number (cook time in minutes, integer)
- servings: number (number of servings, integer, default 4)
- cuisineType: string (one of: North Indian, South Indian, Gujarati, Punjabi, Bengali, Rajasthani, Maharashtrian, Pan-Indian, Fusion)
- dietaryTags: string[] (subset of exactly these values: ["Vegan", "Gluten-Free", "Jain Friendly"])

Return ONLY valid raw JSON. No markdown fences. No extra explanation.`,
          },
          { role: "user", content: messageText },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });

      const rawJson = extraction.choices[0]?.message?.content ?? "{}";
      let recipeData: any;
      try {
        const cleaned = rawJson.replace(/```json|```/g, "").trim();
        recipeData = JSON.parse(cleaned);
      } catch {
        return res.status(422).json({ message: "Could not parse recipe from message" });
      }

      if (!recipeData.title || !Array.isArray(recipeData.ingredients) || !Array.isArray(recipeData.instructions)) {
        return res.status(422).json({ message: "Incomplete recipe data extracted" });
      }

      const allRecipes = await storage.getRecipes();
      const existing = allRecipes.find(
        (r) => r.title.toLowerCase().trim() === recipeData.title.toLowerCase().trim()
      );
      if (existing) return res.json({ recipe: existing, alreadyExists: true });

      const slug = recipeData.title.toLowerCase().replace(/[^a-z0-9]+/g, "+");
      const youtubeUrl = `https://www.youtube.com/results?search_query=${slug}+recipe+indian+vegetarian`;

      const submittedByName =
        `${req.user.claims.first_name || ""} ${req.user.claims.last_name || ""}`.trim() ||
        req.user.claims.email?.split("@")[0] ||
        "Community Member";

      const newRecipe = await storage.createRecipe({
        title: recipeData.title,
        description: recipeData.description || "",
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        prepTime: Number(recipeData.prepTime) || 15,
        cookTime: Number(recipeData.cookTime) || 20,
        servings: Number(recipeData.servings) || 4,
        cuisineType: recipeData.cuisineType || "Pan-Indian",
        dietaryTags: Array.isArray(recipeData.dietaryTags) ? recipeData.dietaryTags : [],
        youtubeUrl,
        isUserSubmitted: true,
        authorId: req.user.claims.sub,
        submittedBy: req.user.claims.sub,
        submittedByName,
        submittedByImage: req.user.claims.profile_image_url ?? null,
      });

      res.json({ recipe: newRecipe, alreadyExists: false });

      // Background: generate an AI photo for the chatbot-saved recipe
      generateAndSaveRecipeImage(newRecipe.id, newRecipe.title);

      const recipientEmail = req.user.claims.email;
      if (recipientEmail) {
        sendContributionEmail(recipientEmail, submittedByName, newRecipe.title, "chatbot").catch(() => {});
      }
    } catch (err) {
      console.error("Save recipe from chat error:", err);
      res.status(500).json({ message: "Failed to save recipe" });
    }
  });

  app.post("/api/chef-chat", isAuthenticated, async (req, res) => {
    try {
      const { messages: userMessages, recipeContext } = req.body;

      if (!Array.isArray(userMessages) || userMessages.length === 0) {
        return res.status(400).json({ message: "Messages are required" });
      }

      const systemPrompt = `You are Smart Chef, a knowledgeable and friendly vegetarian cooking assistant for Flavour Genie — an Indian vegetarian recipe discovery app.

Your expertise:
- Indian vegetarian and vegan cuisine (North Indian, South Indian, Gujarati, Maharashtrian, Rajasthani, Bengali, etc.)
- Ingredient substitutions that keep dishes vegetarian or vegan
- Spice blends, cooking techniques, and regional flavor profiles
- Dietary adaptations: Jain (no root vegetables), gluten-free, low-oil, etc.
- Seasonal ingredients and traditional methods

STRICT RULES:
- ONLY suggest vegetarian or vegan alternatives — NEVER recommend meat, fish, or eggs as ingredients
- If asked about non-vegetarian options, politely explain you specialize in vegetarian cooking only
- Keep all advice suitable for the Indian vegetarian community
- Be warm, encouraging, and practical

${recipeContext ? `Current recipe context: ${recipeContext}` : ""}

Keep responses concise (3-5 sentences unless a recipe is requested). Use bullet points for ingredient lists or steps.`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...userMessages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        stream: true,
        max_tokens: 600,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      console.error("Smart Chef AI error:", err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "AI request failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to get AI response" });
      }
    }
  });

  // Background: fix any existing user-submitted recipes with missing/broken images
  migrateUserRecipeImages();

  return httpServer;
}
