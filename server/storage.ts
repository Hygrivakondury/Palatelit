import { recipes, type Recipe, type InsertRecipe } from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, sql } from "drizzle-orm";

export interface IStorage {
  getRecipes(search?: string, cuisine?: string): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  recipeCount(): Promise<number>;
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
        if (termConditions.length === 1) {
          conditions.push(termConditions[0]);
        } else {
          conditions.push(or(...termConditions)!);
        }
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

  async recipeCount(): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(recipes);
    return Number(count);
  }
}

export const storage = new DatabaseStorage();
