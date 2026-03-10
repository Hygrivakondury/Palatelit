import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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
  dietaryTags: text("dietary_tags").array().notNull().default([]),
  imageUrl: text("image_url"),
  authorId: varchar("author_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favorites = pgTable("favorites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  recipeId: integer("recipe_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  recipeId: integer("recipe_id").notNull(),
  comment: text("comment").notNull(),
  rating: integer("rating").notNull().default(5),
  authorName: text("author_name"),
  authorImageUrl: text("author_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recipesRelations = relations(recipes, ({ many }) => ({
  favorites: many(favorites),
  reviews: many(reviews),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  recipe: one(recipes, { fields: [favorites.recipeId], references: [recipes.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  recipe: one(recipes, { fields: [reviews.recipeId], references: [recipes.id] }),
}));

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
  authorName: true,
  authorImageUrl: true,
}).extend({
  comment: z.string().min(5, "Review must be at least 5 characters").max(500, "Review too long"),
  rating: z.number().int().min(1).max(5),
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export type Favorite = typeof favorites.$inferSelect;

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

export const DIETARY_TAGS = ["Vegan", "Gluten-Free", "Jain Friendly"] as const;

export type CuisineType = typeof CUISINE_TYPES[number];
export type DietaryTag = typeof DIETARY_TAGS[number];
