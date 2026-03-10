import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import OpenAI from "openai";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertRecipeSchema, insertReviewSchema } from "@shared/schema";
import { seedRecipes } from "./seed";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

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

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid recipe ID" });
      const recipe = await storage.getRecipe(id);
      if (!recipe) return res.status(404).json({ message: "Recipe not found" });
      res.json(recipe);
    } catch (err) {
      console.error("Error fetching recipe:", err);
      res.status(500).json({ message: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertRecipeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const recipe = await storage.createRecipe({ ...parsed.data, authorId: req.user.claims.sub });
      res.status(201).json(recipe);
    } catch (err) {
      console.error("Error creating recipe:", err);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  // ─── IMAGE UPLOAD ─────────────────────────────────────────────
  app.post("/api/recipes/:id/upload-image", isAuthenticated, upload.single("image"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid recipe ID" });
      if (!req.file) return res.status(400).json({ message: "No image file provided" });

      // Rename to use original extension
      const ext = path.extname(req.file.originalname) || ".jpg";
      const newName = `recipe-${id}-${Date.now()}${ext}`;
      const newPath = path.join(uploadDir, newName);
      fs.renameSync(req.file.path, newPath);

      const imageUrl = `/uploads/${newName}`;
      const updated = await storage.updateRecipeImage(id, imageUrl);
      if (!updated) return res.status(404).json({ message: "Recipe not found" });
      res.json({ imageUrl, recipe: updated });
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

  app.get("/api/recipes/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      const isFav = await storage.isFavorited(userId, recipeId);
      res.json({ favorited: isFav });
    } catch (err) {
      res.status(500).json({ message: "Failed to check favorite" });
    }
  });

  app.post("/api/recipes/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      const fav = await storage.addFavorite(userId, recipeId);
      res.status(201).json(fav);
    } catch (err) {
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete("/api/recipes/:id/favorite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = parseInt(req.params.id);
      await storage.removeFavorite(userId, recipeId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // ─── REVIEWS ──────────────────────────────────────────────────
  app.get("/api/recipes/:id/reviews", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      if (isNaN(recipeId)) return res.status(400).json({ message: "Invalid recipe ID" });
      const recipeReviews = await storage.getReviewsByRecipe(recipeId);
      res.json(recipeReviews);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/recipes/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const recipeId = parseInt(req.params.id);
      if (isNaN(recipeId)) return res.status(400).json({ message: "Invalid recipe ID" });
      const parsed = insertReviewSchema.safeParse({ ...req.body, recipeId, userId: req.user.claims.sub });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });

      // Fetch author info
      const { authStorage } = await import("./replit_integrations/auth");
      const user = await authStorage.getUser(req.user.claims.sub);
      const authorName = user?.firstName
        ? `${user.firstName} ${user.lastName ?? ""}`.trim()
        : user?.email ?? "Anonymous";

      const review = await storage.addReview({
        ...parsed.data,
        authorName,
        authorImageUrl: user?.profileImageUrl ?? null,
      });
      res.status(201).json(review);
    } catch (err) {
      console.error("Error adding review:", err);
      res.status(500).json({ message: "Failed to add review" });
    }
  });

  // ─── SMART CHEF AI ────────────────────────────────────────────
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

  return httpServer;
}
