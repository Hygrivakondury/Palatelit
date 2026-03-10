import { pgTable, text, varchar, integer, timestamp, boolean, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";
export * from "./models/chat";

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
  submittedBy: varchar("submitted_by"),
  submittedByName: text("submitted_by_name"),
  submittedByImage: text("submitted_by_image"),
  isUserSubmitted: boolean("is_user_submitted").notNull().default(false),
  challengeId: integer("challenge_id"),
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

export const challenges = pgTable("challenges", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  suggestedDish: text("suggested_dish").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityMessages = pgTable("community_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  recipeId: integer("recipe_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name"),
  senderImageUrl: text("sender_image_url"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey(),
  isAdmin: boolean("is_admin").notNull().default(false),
  displayName: text("display_name"),
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

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
  createdBy: true,
});

export const insertCommunityMessageSchema = createInsertSchema(communityMessages).omit({
  id: true,
  createdAt: true,
  senderId: true,
  senderName: true,
  senderImageUrl: true,
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export type Favorite = typeof favorites.$inferSelect;

export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;

export type CommunityMessage = typeof communityMessages.$inferSelect;
export type InsertCommunityMessage = z.infer<typeof insertCommunityMessageSchema>;

export type UserProfile = typeof userProfiles.$inferSelect;

export const pantryItems = pgTable("pantry_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const insertPantryItemSchema = createInsertSchema(pantryItems).omit({
  id: true,
  addedAt: true,
});

export type PantryItem = typeof pantryItems.$inferSelect;
export type InsertPantryItem = z.infer<typeof insertPantryItemSchema>;

export const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const mealPlans = pgTable("meal_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userEmail: varchar("user_email").notNull(),
  day: varchar("day", { length: 20 }).notNull(),
  recipeIds: integer("recipe_ids").array().notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userEmailDayUnique: unique().on(table.userEmail, table.day),
}));

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
  updatedAt: true,
}).extend({
  day: z.enum(DAYS_OF_WEEK),
  recipeIds: z.array(z.number().int().positive()),
});

export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;

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
