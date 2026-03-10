import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const recipes = pgTable("recipes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ingredients: text("ingredients").array().notNull(),
  instructions: text("instructions").array().notNull(),
  prepTime: integer("prep_time").notNull(),
  cookTime: integer("cook_time").notNull(),
  servings: integer("servings").notNull().default(4),
  cuisineType: varchar("cuisine_type", { length: 50 }).notNull(),
  imageUrl: text("image_url"),
  authorId: varchar("author_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

export const CUISINE_TYPES = [
  "North Indian",
  "South Indian",
  "East Indian",
  "West Indian",
  "Gujarati",
  "Punjabi",
  "Bengali",
  "Rajasthani",
  "Maharashtrian",
  "Fusion",
  "Pan-Indian",
] as const;

export type CuisineType = typeof CUISINE_TYPES[number];
