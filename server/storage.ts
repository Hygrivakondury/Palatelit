import { recipes, favorites, reviews, type Recipe, type InsertRecipe, type Review, type InsertReview, type Favorite } from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, sql } from "drizzle-orm";

export interface IStorage {
  getRecipes(search?: string, cuisine?: string): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipeImage(id: number, imageUrl: string): Promise<Recipe | undefined>;
  recipeCount(): Promise<number>;
  // Favorites
  getFavoritesByUser(userId: string): Promise<Favorite[]>;
  isFavorited(userId: string, recipeId: number): Promise<boolean>;
  addFavorite(userId: string, recipeId: number): Promise<Favorite>;
  removeFavorite(userId: string, recipeId: number): Promise<void>;
  // Reviews
  getReviewsByRecipe(recipeId: number): Promise<Review[]>;
  addReview(review: InsertReview & { authorName?: string; authorImageUrl?: string }): Promise<Review>;
}

export class DatabaseStorage implements IStorage {
  async getRecipes(search?: string, cuisine?: string): Promise<Recipe[]> {
    const conditions = [];

    if (cuisine) {
      conditions.push(eq(recipes.cuisineType, cuisine));
    }

    if (search) {
      const terms = search
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (terms.length > 0) {
        const termConditions = terms.map((term) =>
          or(
            sql`EXISTS (SELECT 1 FROM unnest(${recipes.ingredients}) AS ing WHERE ing ILIKE ${"%" + term + "%"})`,
            ilike(recipes.title, `%${term}%`),
            ilike(recipes.description, `%${term}%`)
          )!
        );
        conditions.push(termConditions.length === 1 ? termConditions[0] : or(...termConditions)!);
      }
    }

    if (conditions.length === 0) {
      return db.select().from(recipes).orderBy(recipes.id);
    } else if (conditions.length === 1) {
      return db.select().from(recipes).where(conditions[0]).orderBy(recipes.id);
    } else {
      return db.select().from(recipes).where(and(...conditions)).orderBy(recipes.id);
    }
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe;
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const [created] = await db.insert(recipes).values(recipe).returning();
    return created;
  }

  async updateRecipeImage(id: number, imageUrl: string): Promise<Recipe | undefined> {
    const [updated] = await db.update(recipes).set({ imageUrl }).where(eq(recipes.id, id)).returning();
    return updated;
  }

  async recipeCount(): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(recipes);
    return Number(count);
  }

  async getFavoritesByUser(userId: string): Promise<Favorite[]> {
    return db.select().from(favorites).where(eq(favorites.userId, userId));
  }

  async isFavorited(userId: string, recipeId: number): Promise<boolean> {
    const [fav] = await db.select().from(favorites).where(
      and(eq(favorites.userId, userId), eq(favorites.recipeId, recipeId))
    );
    return !!fav;
  }

  async addFavorite(userId: string, recipeId: number): Promise<Favorite> {
    const [fav] = await db.insert(favorites).values({ userId, recipeId }).returning();
    return fav;
  }

  async removeFavorite(userId: string, recipeId: number): Promise<void> {
    await db.delete(favorites).where(
      and(eq(favorites.userId, userId), eq(favorites.recipeId, recipeId))
    );
  }

  async getReviewsByRecipe(recipeId: number): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.recipeId, recipeId)).orderBy(reviews.createdAt);
  }

  async addReview(review: InsertReview & { authorName?: string; authorImageUrl?: string }): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
