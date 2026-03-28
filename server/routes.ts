import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertRecipeSchema, insertReviewSchema, insertChallengeSchema, CUISINE_TYPES, DIETARY_TAGS, AFFILIATE_SLOTS, type AffiliateSlot } from "@shared/schema";
import { seedRecipes } from "./seed";
import { sendContributionEmail, sendFeedbackResponseEmail } from "./email";

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

    // Store raw base64 in imageData column, serve through a dedicated route.
    // This keeps list API payloads small while making images fully persistent in the DB.
    const imageUrl = `/api/recipes/${id}/image`;
    await storage.updateRecipeImage(id, imageUrl, b64);
    console.log(`[image] Auto-generated image for recipe ${id} (${title}) — saved to DB`);
  } catch (err) {
    console.error(`[image] Failed to auto-generate image for recipe ${id}:`, err);
  }
}

async function enrichRecipeMetadata(
  id: number,
  title: string,
  description: string,
  ingredients: string[]
): Promise<void> {
  try {
    const cuisineList = CUISINE_TYPES.join(", ");
    const tagList = DIETARY_TAGS.join(", ");
    const ingredientSample = ingredients.slice(0, 20).join(", ");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in Indian vegetarian cuisine. Given a recipe, identify:
1. The regional Indian cuisine type — choose EXACTLY one from: ${cuisineList}
2. Which dietary labels apply — choose ANY that are truly applicable from: ${tagList}

Rules:
- "Vegan": no dairy, no honey, no animal products whatsoever
- "Gluten-Free": no wheat, no maida, no semolina/rava, no barley, no rye
- "Jain Friendly": no root vegetables (onion, garlic, potato, carrot, beet, ginger)

Respond in JSON: {"cuisineType": "...", "dietaryTags": ["...", "..."]}
Return ONLY the JSON, no extra text.`,
        },
        {
          role: "user",
          content: `Recipe: ${title}\nDescription: ${description}\nIngredients: ${ingredientSample}`,
        },
      ],
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const cuisineType = (CUISINE_TYPES as readonly string[]).includes(parsed.cuisineType)
      ? parsed.cuisineType
      : "Pan-Indian";

    const dietaryTags = Array.isArray(parsed.dietaryTags)
      ? parsed.dietaryTags.filter((t: string) => (DIETARY_TAGS as readonly string[]).includes(t))
      : [];

    await storage.updateRecipeMetadata(id, cuisineType, dietaryTags);
    console.log(`[enrich] Recipe ${id} (${title}): cuisine=${cuisineType}, tags=[${dietaryTags.join(", ")}]`);
  } catch (err) {
    console.error(`[enrich] Failed to enrich metadata for recipe ${id}:`, err);
  }
}

async function migrateUserRecipeImages(): Promise<void> {
  try {
    const allRecipes = await storage.getRecipes();

    // 1. Migrate legacy file-based /uploads/ images to DB (if the file exists on disk)
    const legacyFileRecipes = allRecipes.filter(r => r.imageUrl?.startsWith("/uploads/"));
    let migrated = 0;
    for (const recipe of legacyFileRecipes) {
      try {
        const filepath = path.join(uploadDir, path.basename(recipe.imageUrl!));
        if (fs.existsSync(filepath)) {
          const b64 = fs.readFileSync(filepath).toString("base64");
          const newImageUrl = `/api/recipes/${recipe.id}/image`;
          await storage.updateRecipeImage(recipe.id, newImageUrl, b64);
          fs.unlinkSync(filepath); // clean up file — image now lives in DB
          migrated++;
        }
      } catch (e) {
        console.error(`[image] Failed to migrate legacy image for recipe ${recipe.id}:`, e);
      }
    }
    if (migrated > 0) {
      console.log(`[image] Migrated ${migrated} legacy file-based image(s) to DB storage`);
    }

    // 2. Generate AI images for user-submitted recipes with no image at all
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

  // Serve uploaded images (setHeaders only fires on 200, not 404)
  app.use("/uploads", (await import("express")).default.static(uploadDir, {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  }));

  // Serve stock images (setHeaders only fires on 200, not 404)
  const stockImgDir = path.join(process.cwd(), "attached_assets", "stock_images");
  if (!fs.existsSync(stockImgDir)) fs.mkdirSync(stockImgDir, { recursive: true });
  app.use("/stock-images", (await import("express")).default.static(stockImgDir, {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  }));

  // Seed on startup
  await seedRecipes();

  // ─── RECIPES ──────────────────────────────────────────────────
  app.get("/api/recipes", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const search = req.query.search as string | undefined;
      const cuisine = req.query.cuisine as string | undefined;
      const category = req.query.category as string | undefined;
      const recipeList = await storage.getRecipes(search, cuisine, category);
      res.json(recipeList);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  });

  app.get("/api/recipes/community", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
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

      // Background: generate AI photo + enrich cuisine/tags in parallel
      generateAndSaveRecipeImage(recipe.id, recipe.title);
      enrichRecipeMetadata(recipe.id, recipe.title, recipe.description ?? "", recipe.ingredients ?? []);

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

  // Public image endpoint — serves recipe image PNG from the imageData DB column.
  // No auth required; images are public. Works across all deployments (no filesystem dependency).
  app.get("/api/recipes/:id/image", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipe = await storage.getRecipe(id);
      if (!recipe) return res.status(404).send("Not found");

      const imageData = recipe.imageData;
      if (!imageData) return res.status(404).send("No image");

      const buffer = Buffer.from(imageData, "base64");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    } catch (err) {
      res.status(500).send("Error");
    }
  });

  app.post("/api/recipes/:id/image", isAuthenticated, upload.single("image"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      // Convert uploaded file to base64, store in imageData column, serve via dedicated route
      const b64 = fs.readFileSync(req.file.path).toString("base64");
      fs.unlinkSync(req.file.path); // clean up — image lives in DB now
      const imageUrl = `/api/recipes/${id}/image`;
      const updated = await storage.updateRecipeImage(id, imageUrl, b64);
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

  // ─── USER FEEDBACK ──────────────────────────────────────────────────
  app.post("/api/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const claims = req.user.claims;
      const { message } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }
      const row = await storage.createFeedback({
        userEmail: claims.email,
        userName: [claims.first_name, claims.last_name].filter(Boolean).join(" ") || "Anonymous",
        userProfileImage: claims.profile_image_url ?? "",
        message: message.trim(),
      });
      res.json(row);
    } catch (err) {
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  app.get("/api/admin/feedback", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) return res.status(403).json({ message: "Admin only" });
      const rows = await storage.getAllFeedback();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.post("/api/admin/feedback/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { adminResponse } = req.body;
      if (!adminResponse || typeof adminResponse !== "string" || !adminResponse.trim()) {
        return res.status(400).json({ message: "Response is required" });
      }
      const updated = await storage.respondToFeedback(id, adminResponse.trim());
      if (!updated) return res.status(404).json({ message: "Feedback not found" });
      await sendFeedbackResponseEmail(updated.userEmail, updated.userName, updated.message, adminResponse.trim());
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to send response" });
    }
  });

  // ─── ADMIN CATEGORY UPDATE ──────────────────────────────────────────
  app.patch("/api/admin/recipes/:id/category", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { category } = req.body;
      const valid = ["main", "dessert", "mocktail"];
      if (!valid.includes(category)) return res.status(400).json({ message: "Invalid category" });
      const updated = await storage.updateRecipeCategory(id, category);
      if (!updated) return res.status(404).json({ message: "Recipe not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // ─── ADMIN DELETE ──────────────────────────────────────────────────
  app.delete("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) {
        return res.status(403).json({ message: "Admin only" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deleteRecipe(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  });

  app.delete("/api/community/messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) {
        return res.status(403).json({ message: "Admin only" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deleteCommunityMessage(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // ─── ADMIN RECIPE CRUD ────────────────────────────────────────
  app.get("/api/admin/recipes", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) return res.status(403).json({ message: "Admin only" });
      const all = await storage.getRecipes();
      res.json(all);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  });

  app.patch("/api/admin/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { title, description, ingredients, instructions, prepTime, cookTime, servings, cuisineType, dietaryTags, category, youtubeUrl, imageUrl } = req.body;
      const updated = await storage.updateRecipe(id, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(ingredients !== undefined && { ingredients }),
        ...(instructions !== undefined && { instructions }),
        ...(prepTime !== undefined && { prepTime: Number(prepTime) }),
        ...(cookTime !== undefined && { cookTime: Number(cookTime) }),
        ...(servings !== undefined && { servings: Number(servings) }),
        ...(cuisineType !== undefined && { cuisineType }),
        ...(dietaryTags !== undefined && { dietaryTags }),
        ...(category !== undefined && { category }),
        ...(youtubeUrl !== undefined && { youtubeUrl }),
        ...(imageUrl !== undefined && { imageUrl }),
      });
      if (!updated) return res.status(404).json({ message: "Recipe not found" });
      res.json(updated);
    } catch (err) {
      console.error("Admin update recipe error:", err);
      res.status(500).json({ message: "Failed to update recipe" });
    }
  });

  app.post("/api/admin/recipes", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) return res.status(403).json({ message: "Admin only" });
      const { title, description, ingredients, instructions, prepTime, cookTime, servings, cuisineType, dietaryTags, category, youtubeUrl } = req.body;
      if (!title?.trim() || !ingredients?.length || !instructions?.length) {
        return res.status(400).json({ message: "Title, ingredients and instructions are required" });
      }
      const recipe = await storage.createRecipe({
        title: title.trim(),
        description: description?.trim() || "",
        ingredients: Array.isArray(ingredients) ? ingredients : [ingredients],
        instructions: Array.isArray(instructions) ? instructions : [instructions],
        prepTime: Number(prepTime) || 15,
        cookTime: Number(cookTime) || 20,
        servings: Number(servings) || 4,
        cuisineType: cuisineType || "Pan-Indian",
        dietaryTags: Array.isArray(dietaryTags) ? dietaryTags : [],
        category: ["main", "dessert", "mocktail"].includes(category) ? category : "main",
        youtubeUrl: youtubeUrl || null,
        isUserSubmitted: false,
        authorId: req.user.claims.sub,
      });
      res.status(201).json(recipe);
      generateAndSaveRecipeImage(recipe.id, recipe.title);
      enrichRecipeMetadata(recipe.id, recipe.title, recipe.description ?? "", recipe.ingredients ?? []);
    } catch (err) {
      console.error("Admin create recipe error:", err);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  app.get("/api/admin/community-messages", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user.claims.email)) return res.status(403).json({ message: "Admin only" });
      const msgs = await storage.getAllCommunityMessages();
      res.json(msgs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch community messages" });
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

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageData}` },
              },
              {
                type: "text",
                text: `You are an expert at identifying food ingredients.
Look at this photo carefully and list ALL visible vegetables, fruits, legumes, grains, dairy products, meats, and cooking ingredients.
Return ONLY a valid JSON array of ingredient names in English, lowercase, singular form.
Example: ["spinach", "potato", "tomato", "onion", "garlic", "paneer", "lentil"]
Do NOT include cooking utensils, packaging, or non-food items.
Do NOT wrap the JSON in markdown code fences. Return raw JSON only.`,
              },
            ],
          },
        ],
      });

      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      const rawText = response.choices?.[0]?.message?.content ?? "[]";
      console.log("[Pantry] OpenAI vision response:", rawText?.slice(0, 200));
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

  // ─── AI RECIPE GENERATION ──────────────────────────────────────
  app.post("/api/pantry/generate-recipe", isAuthenticated, async (req: any, res) => {
    try {
      const pantry = await storage.getPantryItems(req.user.claims.sub);
      if (pantry.length === 0) {
        return res.status(400).json({ message: "Add ingredients to your pantry first" });
      }

      const pantryList = pantry.map((p) => p.name).join(", ");

      const prompt = `You are an expert Indian vegetarian recipe creator. A user has these ingredients in their pantry: ${pantryList}.

Create ONE original, delicious Indian vegetarian recipe that uses as many of these pantry ingredients as possible. The recipe must be 100% vegetarian (no meat, fish, or eggs).

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "title": "Recipe Name",
  "description": "One or two sentence description of the dish",
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1", "Step 2", "Step 3"],
  "prepTime": 15,
  "cookTime": 25,
  "servings": 4,
  "cuisineType": "North Indian",
  "dietaryTags": ["Vegan"],
  "pantryIngredients": ["ingredients from user's pantry used"],
  "additionalIngredients": ["extra ingredients needed not in pantry"]
}

dietaryTags must be an array containing only items from: ["Vegan", "Gluten-Free", "Jain Friendly"] — only include if truly applicable.
cuisineType must be one of: North Indian, South Indian, Gujarati, Punjabi, Bengali, Rajasthani, Maharashtrian, Pan-Indian, East Indian, West Indian, Fusion.
pantryIngredients should list which of the user's pantry items are used in the recipe.
additionalIngredients should list any extra ingredients needed beyond the pantry.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.8,
      });

      const raw = aiResponse.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);

      res.json({ recipe: parsed });
    } catch (err) {
      console.error("AI recipe generation error:", err);
      res.status(500).json({ message: "Failed to generate AI recipe" });
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
      const { recipeId, mealType } = req.body;
      if (!email) return res.status(400).json({ message: "User email not available" });
      if (typeof recipeId !== "number") return res.status(400).json({ message: "recipeId must be a number" });
      const plan = await storage.addRecipeToMealPlan(email, day, recipeId, mealType ?? "dinner");
      res.json(plan);
    } catch (err) {
      res.status(500).json({ message: "Failed to add recipe to meal plan" });
    }
  });

  app.delete("/api/meal-plans/:day/recipes/:recipeId", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email;
      const { day, recipeId } = req.params;
      const mealType = req.query.mealType as string | undefined;
      if (!email) return res.status(400).json({ message: "User email not available" });
      const plan = await storage.removeRecipeFromMealPlan(email, day, parseInt(recipeId), mealType as any);
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
      const pick = (offset: number) => shuffled[offset % shuffled.length].id;

      const dayPlans = days.map((day, i) => ({
        day,
        breakfast: [pick(i * 4)],
        lunch: [pick(i * 4 + 1)],
        dinner: [pick(i * 4 + 2)],
        snacks: [pick(i * 4 + 3)],
      }));

      const plans = await storage.smartfillMealPlan(email, dayPlans);
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

      // Store raw base64 in imageData column, serve through dedicated route
      const imageUrl = `/api/recipes/${id}/image`;
      await storage.updateRecipeImage(id, imageUrl, b64);

      res.json({ imageUrl, b64_json: b64, mimeType: "image/png" });
    } catch (err) {
      console.error("Image generation error:", err);
      res.status(500).json({ message: "Failed to generate image" });
    }
  });

  // Admin: regenerate images for ALL recipes missing a picture
  app.post("/api/admin/regenerate-missing-images", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) {
        return res.status(403).json({ message: "Admin only" });
      }
      const all = await storage.getRecipes("", "", "");
      // Regenerate if: no image, OR imageUrl points to a local file that no longer exists (legacy /uploads/ path)
      const missing = all.filter(r => {
        if (!r.imageUrl) return true;
        if (r.imageUrl.startsWith("/uploads/")) {
          const filepath = path.join(uploadDir, path.basename(r.imageUrl));
          return !fs.existsSync(filepath);
        }
        return false; // data URLs and external URLs are fine
      });
      console.log(`[admin] Generating images for ${missing.length} recipes without valid pictures`);
      res.json({ triggered: missing.length });
      for (const r of missing) {
        await generateAndSaveRecipeImage(r.id, r.title);
      }
    } catch (err) {
      console.error("Admin regenerate images error:", err);
      res.status(500).json({ message: "Failed to start regeneration" });
    }
  });

  // Admin: scan all recipe images for mismatches and regenerate bad ones
  app.post("/api/admin/scan-and-fix-images", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) {
        return res.status(403).json({ message: "Admin only" });
      }
      const all = await storage.getRecipes("", "", "");
      // Scan any recipe that has an image URL
      const withImages = all.filter(r => r.imageUrl && r.imageUrl.length > 0);
      res.json({ scanning: withImages.length, message: "Scan started in background" });

      let mismatched = 0;
      for (const recipe of withImages) {
        try {
          let b64: string;
          const url = recipe.imageUrl!;

          if (url.startsWith("/api/recipes/")) {
            // New DB-stored image — fetch imageData directly from DB
            const imageData = await storage.getRecipeImageData(recipe.id);
            if (!imageData) {
              await generateAndSaveRecipeImage(recipe.id, recipe.title);
              mismatched++;
              continue;
            }
            b64 = imageData;
          } else if (url.startsWith("data:")) {
            // Legacy data URL — extract base64 after the comma
            b64 = url.split(",")[1] ?? "";
          } else if (url.startsWith("/uploads/")) {
            // Legacy file-based — read from disk if it exists, else regenerate
            const filepath = path.join(uploadDir, path.basename(url));
            if (!fs.existsSync(filepath)) {
              await generateAndSaveRecipeImage(recipe.id, recipe.title);
              mismatched++;
              continue;
            }
            b64 = fs.readFileSync(filepath).toString("base64");
          } else {
            // External URL or stock image — skip
            continue;
          }

          if (!b64) {
            await generateAndSaveRecipeImage(recipe.id, recipe.title);
            mismatched++;
            continue;
          }

          const check = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 20,
            messages: [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:image/png;base64,${b64}`, detail: "low" } },
                { type: "text", text: `Does this image clearly show the food dish called "${recipe.title}"? Reply only YES or NO.` },
              ],
            }],
          });
          const answer = check.choices[0]?.message?.content?.trim().toUpperCase() ?? "NO";
          if (!answer.startsWith("YES")) {
            console.log(`[scan] Mismatch detected for recipe ${recipe.id} (${recipe.title}) — regenerating`);
            await generateAndSaveRecipeImage(recipe.id, recipe.title);
            mismatched++;
          }
        } catch (err) {
          console.error(`[scan] Error checking recipe ${recipe.id}:`, err);
        }
      }
      console.log(`[scan] Done. ${mismatched} image(s) regenerated out of ${withImages.length} checked.`);
    } catch (err) {
      console.error("Scan-and-fix error:", err);
    }
  });

  // Admin: get scan status (check how many recipes need images)
  app.get("/api/admin/image-stats", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      const all = await storage.getRecipes("", "", "");
      const total = all.length;
      const withImage = all.filter(r => r.imageUrl && r.imageUrl.length > 0).length;
      const noImage = all.filter(r => !r.imageUrl).length;
      res.json({ total, withImage, noImage });
    } catch (err) {
      res.status(500).json({ message: "Failed to get stats" });
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
- category: string (IMPORTANT: classify the recipe into exactly one of these three values:
    "dessert" — for sweets, mithai, halwa, kheer, ladoo, barfi, pudding, cake, ice cream, or any sweet dish
    "mocktail" — for juices, lassi, sherbets, shakes, smoothies, nimbu pani, drinks, beverages, or any drinkable recipe
    "main" — for everything else: curries, rice dishes, breads, snacks, dals, sabzi, street food, breakfast items, etc.)

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

      const validCategories = ["main", "dessert", "mocktail"];
      const detectedCategory = validCategories.includes(recipeData.category) ? recipeData.category : "main";

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
        category: detectedCategory,
        youtubeUrl,
        isUserSubmitted: true,
        authorId: req.user.claims.sub,
        submittedBy: req.user.claims.sub,
        submittedByName,
        submittedByImage: req.user.claims.profile_image_url ?? null,
      });

      res.json({ recipe: newRecipe, alreadyExists: false });

      // Background: generate AI photo + enrich cuisine/tags in parallel
      generateAndSaveRecipeImage(newRecipe.id, newRecipe.title);
      enrichRecipeMetadata(newRecipe.id, newRecipe.title, newRecipe.description ?? "", newRecipe.ingredients ?? []);

      const recipientEmail = req.user.claims.email;
      if (recipientEmail) {
        sendContributionEmail(recipientEmail, submittedByName, newRecipe.title, "chatbot").catch(() => {});
      }
    } catch (err) {
      console.error("Save recipe from chat error:", err);
      res.status(500).json({ message: "Failed to save recipe" });
    }
  });

  // Auto-save Smart Chef Q&A as a blog post
  app.post("/api/chef-chat/save-to-blog", isAuthenticated, async (req: any, res) => {
    try {
      const { question, answer } = req.body;
      if (!question || !answer) {
        return res.status(400).json({ message: "question and answer are required" });
      }

      const user = req.user?.claims;
      const authorId = user?.sub || "system";
      const authorName = user?.name || user?.email?.split("@")[0] || "Smart Chef User";

      const title = question.trim().replace(/\?+$/, "").trim() + "?";
      const truncatedTitle = title.length > 100 ? title.slice(0, 97) + "..." : title;
      const slug = truncatedTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + `-${Date.now()}`;

      const excerpt = answer.replace(/\n/g, " ").slice(0, 180).trim() + "…";

      const content = `## ${truncatedTitle}\n\n*Asked by **${authorName}** · Answered by Smart Chef AI*\n\n---\n\n${answer}\n\n---\n\n*This answer was generated by Smart Chef AI, Palate Lit's Indian vegetarian cooking assistant.*`;

      const post = await storage.createBlogPost({
        slug,
        title: truncatedTitle,
        excerpt,
        content,
        coverImageData: null,
        authorId,
        authorName,
        isPublished: true,
        publishedAt: new Date(),
        readTimeMinutes: 1,
        tags: ["Smart Chef Q&A", "Cooking Tips", "Indian Vegetarian"],
      });

      res.json({ success: true, postId: post.id, slug: post.slug });
    } catch (err) {
      console.error("Save Q&A to blog error:", err);
      res.status(500).json({ message: "Failed to save to blog" });
    }
  });

  app.post("/api/chef-chat", isAuthenticated, async (req, res) => {
    try {
      const { messages: userMessages, recipeContext } = req.body;

      if (!Array.isArray(userMessages) || userMessages.length === 0) {
        return res.status(400).json({ message: "Messages are required" });
      }

      const systemPrompt = `You are Smart Chef, a knowledgeable and friendly vegetarian cooking assistant for Palate Lit — an Indian vegetarian recipe discovery app.

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

  // Affiliate links — public read
  app.get("/api/affiliate-links", async (_req, res) => {
    try {
      const links = await storage.getAffiliateLinks();
      res.json(links);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch affiliate links" });
    }
  });

  // Affiliate links — admin update
  app.put("/api/affiliate-links/:slot", isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user?.claims?.email;
      if (!isAdminEmail(email)) return res.status(403).json({ message: "Admin only" });
      const slot = req.params.slot as AffiliateSlot;
      if (!AFFILIATE_SLOTS.includes(slot)) return res.status(400).json({ message: "Invalid slot" });
      const { label, buttonText, webUrl, deepLinkUrl, isActive } = req.body;
      const updated = await storage.upsertAffiliateLink(slot, { label, buttonText, webUrl, deepLinkUrl, isActive }, email);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update affiliate link" });
    }
  });

  // Background: fix any existing user-submitted recipes with missing/broken images
  migrateUserRecipeImages();

  // ─── BLOG POSTS ─────────────────────────────────────────────────
  // Public: list published posts (no auth needed)
  app.get("/api/blog", async (req: any, res) => {
    try {
      const adminMode = req.query.admin === "1" && isAdminEmail(req.user?.claims?.email);
      const posts = await storage.getBlogPosts(!adminMode);
      // Strip coverImageData from list to keep payload small
      res.json(posts.map(p => ({ ...p, coverImageData: p.coverImageData ? "has_image" : null })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.get("/api/blog/:slug", async (_req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(_req.params.slug);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (!post.isPublished) {
        const email = (_req as any).user?.claims?.email;
        if (!isAdminEmail(email)) return res.status(404).json({ message: "Post not found" });
      }
      res.json(post);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  app.post("/api/blog", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      const { title, excerpt, content, coverImageData, isPublished, readTimeMinutes, tags } = req.body;
      if (!title?.trim()) return res.status(400).json({ message: "Title required" });
      const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
      const post = await storage.createBlogPost({
        slug,
        title: title.trim(),
        excerpt: excerpt?.trim() || "",
        content: content?.trim() || "",
        coverImageData: coverImageData || null,
        authorId: req.user.claims.sub,
        authorName: req.user.claims.first_name ? `${req.user.claims.first_name} ${req.user.claims.last_name || ""}`.trim() : "Admin",
        isPublished: !!isPublished,
        publishedAt: isPublished ? new Date() : undefined,
        readTimeMinutes: readTimeMinutes || Math.max(1, Math.ceil((content || "").split(/\s+/).length / 200)),
        tags: Array.isArray(tags) ? tags : [],
      });
      res.status(201).json(post);
    } catch (err) {
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.patch("/api/blog/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      const id = parseInt(req.params.id);
      const existing = await storage.getBlogPost(id);
      if (!existing) return res.status(404).json({ message: "Post not found" });
      const { title, excerpt, content, coverImageData, isPublished, readTimeMinutes, tags } = req.body;
      const wasPublished = existing.isPublished;
      const nowPublished = isPublished ?? existing.isPublished;
      const updated = await storage.updateBlogPost(id, {
        ...(title !== undefined && { title: title.trim(), slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + existing.id }),
        ...(excerpt !== undefined && { excerpt: excerpt.trim() }),
        ...(content !== undefined && { content: content.trim(), readTimeMinutes: readTimeMinutes ?? Math.max(1, Math.ceil(content.split(/\s+/).length / 200)) }),
        ...(coverImageData !== undefined && { coverImageData }),
        ...(tags !== undefined && { tags }),
        isPublished: nowPublished,
        publishedAt: nowPublished && !wasPublished ? new Date() : existing.publishedAt ?? undefined,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update post" });
    }
  });

  app.delete("/api/blog/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      await storage.deleteBlogPost(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // ─── BLOG COMMENTS ──────────────────────────────────────────────
  app.get("/api/blog/:postId/comments", async (req: any, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const adminMode = isAdminEmail(req.user?.claims?.email);
      const comments = await storage.getCommentsByPost(postId, !adminMode);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/blog/:postId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const post = await storage.getBlogPost(postId);
      if (!post || !post.isPublished) return res.status(404).json({ message: "Post not found" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Comment content required" });
      const comment = await storage.addBlogComment({
        postId,
        authorId: req.user.claims.sub,
        authorName: req.user.claims.first_name ? `${req.user.claims.first_name} ${req.user.claims.last_name || ""}`.trim() : null,
        authorImageUrl: req.user.claims.profile_image_url ?? null,
        content: content.trim(),
      });
      res.status(201).json(comment);
    } catch (err) {
      res.status(500).json({ message: "Failed to post comment" });
    }
  });

  app.delete("/api/blog/comments/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      await storage.deleteBlogComment(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Admin: list all comments across all posts for moderation
  app.get("/api/admin/blog-comments", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      const allPosts = await storage.getBlogPosts(false);
      const allComments = await Promise.all(allPosts.map(p => storage.getCommentsByPost(p.id, false)));
      const flat = allComments.flat().sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      res.json(flat);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // ─── AD SLOTS ───────────────────────────────────────────────────
  app.get("/api/ad-slots", async (_req, res) => {
    try {
      const slots = await storage.getAdSlots();
      res.json(slots);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch ad slots" });
    }
  });

  app.put("/api/ad-slots/:slotName", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      const { slotName } = req.params;
      const { label, htmlCode, isActive } = req.body;
      const updated = await storage.upsertAdSlot(slotName, { label, htmlCode, isActive }, req.user.claims.email);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update ad slot" });
    }
  });

  // ─── SITE CONTENT ────────────────────────────────────────────────
  app.get("/api/site-content", async (_req, res) => {
    try {
      const content = await storage.getSiteContent();
      res.json(content);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch site content" });
    }
  });

  app.put("/api/site-content", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdminEmail(req.user?.claims?.email)) return res.status(403).json({ message: "Admin only" });
      const entries = req.body as Array<{ key: string; value: string }>;
      if (!Array.isArray(entries)) return res.status(400).json({ message: "Expected array of {key, value}" });
      await storage.upsertSiteContentBulk(entries, req.user.claims.email);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to update site content" });
    }
  });

  return httpServer;
}
