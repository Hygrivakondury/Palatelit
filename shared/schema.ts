import { pgTable, text, varchar, integer, timestamp, boolean, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";
export * from "./models/chat";

export const RECIPE_CATEGORIES = ["main", "dessert", "mocktail", "no-cook"] as const;
export type RecipeCategory = typeof RECIPE_CATEGORIES[number];

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
  category: varchar("category", { length: 20 }).notNull().default("main"),
  imageUrl: text("image_url"),
  imageData: text("image_data"),
  youtubeUrl: text("youtube_url"),
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

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks"] as const;
export type MealType = typeof MEAL_TYPES[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export const MEAL_TYPE_EMOJIS: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snacks: "🍽️",
};

export const mealPlans = pgTable("meal_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userEmail: varchar("user_email").notNull(),
  day: varchar("day", { length: 20 }).notNull(),
  recipeIds: integer("recipe_ids").array().notNull().default([]),
  breakfast: integer("breakfast").array().notNull().default([]),
  lunch: integer("lunch").array().notNull().default([]),
  dinner: integer("dinner").array().notNull().default([]),
  snacks: integer("snacks").array().notNull().default([]),
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

export const shoppingChecked = pgTable("shopping_checked", {
  userEmail: varchar("user_email").primaryKey(),
  checkedKeys: text("checked_keys").array().notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ShoppingChecked = typeof shoppingChecked.$inferSelect;

export const affiliateLinks = pgTable("affiliate_links", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slot: varchar("slot", { length: 20 }).notNull().unique(),
  label: text("label").notNull(),
  buttonText: text("button_text").notNull(),
  webUrl: text("web_url").notNull(),
  deepLinkUrl: text("deep_link_url").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const insertAffiliateLinkSchema = createInsertSchema(affiliateLinks).omit({
  id: true,
  updatedAt: true,
  updatedBy: true,
});

export type AffiliateLink = typeof affiliateLinks.$inferSelect;
export type InsertAffiliateLink = z.infer<typeof insertAffiliateLinkSchema>;

export const AFFILIATE_SLOTS = ["amazon", "blinkit", "flipkart"] as const;
export type AffiliateSlot = typeof AFFILIATE_SLOTS[number];

export const AFFILIATE_DEFAULTS: Record<AffiliateSlot, Omit<AffiliateLink, "id" | "updatedAt" | "updatedBy">> = {
  amazon: {
    slot: "amazon",
    label: "Amazon",
    buttonText: "Buy Spices on Amazon",
    webUrl: "https://www.amazon.in/s?k=indian+spices+masala",
    deepLinkUrl: "amzn://link.amazon.in/redirect?url=https%3A%2F%2Fwww.amazon.in%2Fs%3Fk%3Dindian%2Bspices",
    isActive: true,
  },
  blinkit: {
    slot: "blinkit",
    label: "Blinkit",
    buttonText: "Order Fresh Veggies on Blinkit",
    webUrl: "https://blinkit.com/s/?q=fresh+vegetables",
    deepLinkUrl: "blinkit://search?q=fresh+vegetables",
    isActive: true,
  },
  flipkart: {
    slot: "flipkart",
    label: "Flipkart",
    buttonText: "Kitchen Essentials on Flipkart",
    webUrl: "https://www.flipkart.com/search?q=kitchen+essentials+cookware",
    deepLinkUrl: "flipkart://search?q=kitchen+essentials",
    isActive: true,
  },
};

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

export const userFeedback = pgTable("user_feedback", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userEmail: varchar("user_email").notNull(),
  userName: text("user_name").notNull().default(""),
  userProfileImage: text("user_profile_image").notNull().default(""),
  message: text("message").notNull(),
  adminResponse: text("admin_response"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
  adminResponse: true,
  respondedAt: true,
  createdAt: true,
});

export type UserFeedback = typeof userFeedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

// ─── BLOG ──────────────────────────────────────────────────────────────────

export const blogPosts = pgTable("blog_posts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull().default(""),
  coverImageData: text("cover_image_data"),
  authorId: varchar("author_id").notNull(),
  authorName: text("author_name").notNull().default("Admin"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  readTimeMinutes: integer("read_time_minutes").notNull().default(5),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export const blogComments = pgTable("blog_comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  postId: integer("post_id").notNull(),
  authorId: varchar("author_id").notNull(),
  authorName: text("author_name"),
  authorImageUrl: text("author_image_url"),
  content: text("content").notNull(),
  isApproved: boolean("is_approved").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBlogCommentSchema = createInsertSchema(blogComments).omit({
  id: true,
  isApproved: true,
  createdAt: true,
});

export type BlogComment = typeof blogComments.$inferSelect;
export type InsertBlogComment = z.infer<typeof insertBlogCommentSchema>;

export const adSlots = pgTable("ad_slots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slotName: varchar("slot_name", { length: 50 }).notNull().unique(),
  label: text("label").notNull().default(""),
  htmlCode: text("html_code").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export type AdSlot = typeof adSlots.$inferSelect;

export const AD_SLOT_NAMES = ["blog_banner_top", "blog_inline", "blog_banner_bottom", "recipe_sidebar"] as const;
export type AdSlotName = typeof AD_SLOT_NAMES[number];

// ─── SITE CONTENT ──────────────────────────────────────────────────────────

export const siteContent = pgTable("site_content", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export type SiteContent = typeof siteContent.$inferSelect;

export const SITE_CONTENT_DEFAULTS: Record<string, string> = {
  hero_badge: "100% Vegetarian · Mouth Watering Indian Foods",
  hero_headline_1: "Extraordinary",
  hero_headline_accent: "flavour,",
  hero_headline_2: "on your terms",
  hero_description: "Palate Lit finds authentic Indian vegetarian recipes perfectly matched to what's already in your kitchen — from pantry to plate in under 30 minutes.",
  hero_cta_primary: "Start Cooking — It's Free",
  hero_cta_secondary: "See How It Works",
  section_how_title: "Simple. Delicious. Indian.",
  section_cuisines_title: "From Kashmir to Kanyakumari",
  section_cuisines_description: "Explore the rich diversity of India's vegetarian culinary traditions — 11 regional cuisines, 200+ recipes.",
  section_community_title: "More than 50,000 meals enjoyed",
  section_community_description: "Join the thousands who've discovered the secret to sensational weeknight cooking.",
  cta_headline_main: "Ready to cook something",
  cta_headline_accent: "wonderful?",
  cta_description: "Join thousands of Indian home cooks who've transformed their weeknight dinners.",
  cta_button: "Join Palate Lit — It's Free",
  footer_tagline: "Celebrating India's vegetarian heritage.",
};
