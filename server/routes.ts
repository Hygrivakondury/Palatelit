import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertRecipeSchema } from "@shared/schema";
import { seedRecipes } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Seed on startup
  await seedRecipes();

  // GET /api/recipes - list recipes with optional search + cuisine filter
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

  // GET /api/recipes/:id - single recipe
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

  // POST /api/recipes - create recipe (auth required)
  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertRecipeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const recipe = await storage.createRecipe({
        ...parsed.data,
        authorId: req.user.claims.sub,
      });
      res.status(201).json(recipe);
    } catch (err) {
      console.error("Error creating recipe:", err);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  return httpServer;
}
