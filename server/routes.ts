import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import OpenAI from "openai";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertRecipeSchema, insertReviewSchema, insertChallengeSchema, CUISINE_TYPES } from "@shared/schema";
import { seedRecipes } from "./seed";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
