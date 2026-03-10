import {
  recipes, favorites, reviews, challenges, communityMessages, userProfiles,
  type Recipe, type InsertRecipe, type Review, type InsertReview, type Favorite,
  type Challenge, type InsertChallenge, type CommunityMessage, type UserProfile,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";

export interface IStorage {
  getRecipes(search?: string, cuisine?: string): Promise<Recipe[]>;
  getUserRecipes(userId: string): Promise<Recipe[]>;
  getCommunityRecipes(): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  createRecipe(recipe: Partial<InsertRecipe>): Promise<Recipe>;
  updateRecipeImage(id: number, imageUrl: string): Promise<Recipe | undefined>;
  recipeCount(): Promise<number>;
  // Favorites
  getFavoritesByUser(userId: string): Promise<Favorite[]>;
  isFavorited(userId: string, recipeId: number): Promise<boolean>;
  addFavorite(userId: string, recipeId: number): Promise<Favorite>;
  removeFavorite(userId: string, recipeId: number): Promise<void>;
  // Reviews
  getReviewsByRecipe(recipeId: number): Promise<Review[]>;
  addReview(review: InsertReview & { authorName?: string; authorImageUrl?: string | null }): Promise<Review>;
  // Challenges
  getChallenges(): Promise<Challenge[]>;
  getActiveChallenge(): Promise<Challenge | undefined>;
  createChallenge(challenge: InsertChallenge, createdBy: string): Promise<Challenge>;
  toggleChallengeActive(id: number): Promise<Challenge | undefined>;
  // Community Messages
  getMessagesByRecipe(recipeId: number): Promise<CommunityMessage[]>;
  addCommunityMessage(recipeId: number, senderId: string, senderName: string | null, senderImageUrl: string | null, content: string): Promise<CommunityMessage>;
  // User Profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  adminExists(): Promise<boolean>;
  claimAdmin(userId: string, displayName?: string): Promise<UserProfile>;
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

  async getUserRecipes(userId: string): Promise<Recipe[]> {
    return db.select().from(recipes)
      .where(eq(recipes.submittedBy, userId))
      .orderBy(desc(recipes.createdAt));
  }

  async getCommunityRecipes(): Promise<Recipe[]> {
    return db.select().from(recipes)
      .where(eq(recipes.isUserSubmitted, true))
      .orderBy(desc(recipes.createdAt));
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe;
  }

  async createRecipe(recipe: Partial<InsertRecipe>): Promise<Recipe> {
    const [created] = await db.insert(recipes).values(recipe as InsertRecipe).returning();
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

  async addReview(review: InsertReview & { authorName?: string; authorImageUrl?: string | null }): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async getChallenges(): Promise<Challenge[]> {
    return db.select().from(challenges).orderBy(desc(challenges.createdAt));
  }

  async getActiveChallenge(): Promise<Challenge | undefined> {
    const [challenge] = await db.select().from(challenges)
      .where(eq(challenges.isActive, true))
      .orderBy(desc(challenges.createdAt))
      .limit(1);
    return challenge;
  }

  async createChallenge(challenge: InsertChallenge, createdBy: string): Promise<Challenge> {
    const [created] = await db.insert(challenges).values({ ...challenge, createdBy }).returning();
    return created;
  }

  async toggleChallengeActive(id: number): Promise<Challenge | undefined> {
    const [current] = await db.select().from(challenges).where(eq(challenges.id, id));
    if (!current) return undefined;
    const [updated] = await db.update(challenges)
      .set({ isActive: !current.isActive })
      .where(eq(challenges.id, id))
      .returning();
    return updated;
  }

  async getMessagesByRecipe(recipeId: number): Promise<CommunityMessage[]> {
    return db.select().from(communityMessages)
      .where(eq(communityMessages.recipeId, recipeId))
      .orderBy(communityMessages.createdAt);
  }

  async addCommunityMessage(recipeId: number, senderId: string, senderName: string | null, senderImageUrl: string | null, content: string): Promise<CommunityMessage> {
    const [msg] = await db.insert(communityMessages).values({
      recipeId, senderId, senderName, senderImageUrl, content,
    }).returning();
    return msg;
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const [profile] = await db.insert(userProfiles)
      .values({ userId, ...data })
      .onConflictDoUpdate({ target: userProfiles.userId, set: data })
      .returning();
    return profile;
  }

  async adminExists(): Promise<boolean> {
    const [result] = await db.select().from(userProfiles).where(eq(userProfiles.isAdmin, true)).limit(1);
    return !!result;
  }

  async claimAdmin(userId: string, displayName?: string): Promise<UserProfile> {
    const [profile] = await db.insert(userProfiles)
      .values({ userId, isAdmin: true, displayName: displayName ?? null })
      .onConflictDoUpdate({ target: userProfiles.userId, set: { isAdmin: true } })
      .returning();
    return profile;
  }
}

export const storage = new DatabaseStorage();
