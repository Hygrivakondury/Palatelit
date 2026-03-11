import {
  recipes, favorites, reviews, challenges, communityMessages, userProfiles, pantryItems, mealPlans, shoppingChecked, affiliateLinks,
  type Recipe, type InsertRecipe, type Review, type InsertReview, type Favorite,
  type Challenge, type InsertChallenge, type CommunityMessage, type UserProfile,
  type PantryItem, type MealPlan, type MealType, type AffiliateLink, type AffiliateSlot, AFFILIATE_DEFAULTS, AFFILIATE_SLOTS,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";

export interface IStorage {
  getRecipes(search?: string, cuisine?: string, category?: string): Promise<Recipe[]>;
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
  // Pantry
  getPantryItems(userId: string): Promise<PantryItem[]>;
  addPantryItems(userId: string, names: string[]): Promise<PantryItem[]>;
  removePantryItem(userId: string, id: number): Promise<void>;
  clearPantry(userId: string): Promise<void>;
  // Meal Plans
  getMealPlansByEmail(userEmail: string): Promise<MealPlan[]>;
  getMealPlan(userEmail: string, day: string): Promise<MealPlan | undefined>;
  upsertMealPlan(userEmail: string, day: string, recipeIds: number[]): Promise<MealPlan>;
  addRecipeToMealPlan(userEmail: string, day: string, recipeId: number, mealType?: MealType): Promise<MealPlan>;
  removeRecipeFromMealPlan(userEmail: string, day: string, recipeId: number, mealType?: MealType): Promise<MealPlan>;
  clearMealPlanDay(userEmail: string, day: string): Promise<void>;
  clearWeekPlan(userEmail: string): Promise<void>;
  smartfillMealPlan(userEmail: string, dayPlans: Array<{ day: string; breakfast: number[]; lunch: number[]; dinner: number[]; snacks: number[] }>): Promise<MealPlan[]>;
  // Shopping Checked
  getShoppingChecked(userEmail: string): Promise<string[]>;
  toggleShoppingItem(userEmail: string, key: string): Promise<string[]>;
  clearShoppingChecked(userEmail: string): Promise<void>;
  // Affiliate Links
  getAffiliateLinks(): Promise<AffiliateLink[]>;
  upsertAffiliateLink(slot: AffiliateSlot, data: Partial<Omit<AffiliateLink, "id" | "slot">>, updatedBy: string): Promise<AffiliateLink>;
}

export class DatabaseStorage implements IStorage {
  async getRecipes(search?: string, cuisine?: string, category?: string): Promise<Recipe[]> {
    const conditions = [];

    if (category) {
      conditions.push(eq(recipes.category, category));
    }

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

  async getPantryItems(userId: string): Promise<PantryItem[]> {
    return db.select().from(pantryItems)
      .where(eq(pantryItems.userId, userId))
      .orderBy(desc(pantryItems.addedAt));
  }

  async addPantryItems(userId: string, names: string[]): Promise<PantryItem[]> {
    const unique = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
    if (unique.length === 0) return [];
    const rows = await db.insert(pantryItems)
      .values(unique.map((name) => ({ userId, name })))
      .returning();
    return rows;
  }

  async removePantryItem(userId: string, id: number): Promise<void> {
    await db.delete(pantryItems).where(
      and(eq(pantryItems.id, id), eq(pantryItems.userId, userId))
    );
  }

  async clearPantry(userId: string): Promise<void> {
    await db.delete(pantryItems).where(eq(pantryItems.userId, userId));
  }

  async getMealPlansByEmail(userEmail: string): Promise<MealPlan[]> {
    return db.select().from(mealPlans).where(eq(mealPlans.userEmail, userEmail));
  }

  async getMealPlan(userEmail: string, day: string): Promise<MealPlan | undefined> {
    const [plan] = await db.select().from(mealPlans)
      .where(and(eq(mealPlans.userEmail, userEmail), eq(mealPlans.day, day)));
    return plan;
  }

  async upsertMealPlan(userEmail: string, day: string, recipeIds: number[]): Promise<MealPlan> {
    const [plan] = await db.insert(mealPlans)
      .values({ userEmail, day, recipeIds, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [mealPlans.userEmail, mealPlans.day],
        set: { recipeIds, updatedAt: new Date() },
      })
      .returning();
    return plan;
  }

  async addRecipeToMealPlan(userEmail: string, day: string, recipeId: number, mealType: MealType = "dinner"): Promise<MealPlan> {
    const existing = await this.getMealPlan(userEmail, day);
    const catCurrent = existing?.[mealType] ?? [];
    const catUpdated = catCurrent.includes(recipeId) ? catCurrent : [...catCurrent, recipeId];
    const breakfast = mealType === "breakfast" ? catUpdated : (existing?.breakfast ?? []);
    const lunch = mealType === "lunch" ? catUpdated : (existing?.lunch ?? []);
    const dinner = mealType === "dinner" ? catUpdated : (existing?.dinner ?? []);
    const snacks = mealType === "snacks" ? catUpdated : (existing?.snacks ?? []);
    const recipeIds = [...new Set([...breakfast, ...lunch, ...dinner, ...snacks])];
    const [plan] = await db.insert(mealPlans)
      .values({ userEmail, day, breakfast, lunch, dinner, snacks, recipeIds, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [mealPlans.userEmail, mealPlans.day],
        set: { breakfast, lunch, dinner, snacks, recipeIds, updatedAt: new Date() },
      })
      .returning();
    return plan;
  }

  async removeRecipeFromMealPlan(userEmail: string, day: string, recipeId: number, mealType?: MealType): Promise<MealPlan> {
    const existing = await this.getMealPlan(userEmail, day);
    const filter = (arr: number[]) => arr.filter((id) => id !== recipeId);
    const breakfast = mealType === "breakfast" || !mealType ? filter(existing?.breakfast ?? []) : (existing?.breakfast ?? []);
    const lunch = mealType === "lunch" || !mealType ? filter(existing?.lunch ?? []) : (existing?.lunch ?? []);
    const dinner = mealType === "dinner" || !mealType ? filter(existing?.dinner ?? []) : (existing?.dinner ?? []);
    const snacks = mealType === "snacks" || !mealType ? filter(existing?.snacks ?? []) : (existing?.snacks ?? []);
    const recipeIds = [...new Set([...breakfast, ...lunch, ...dinner, ...snacks])];
    const [plan] = await db.insert(mealPlans)
      .values({ userEmail, day, breakfast, lunch, dinner, snacks, recipeIds, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [mealPlans.userEmail, mealPlans.day],
        set: { breakfast, lunch, dinner, snacks, recipeIds, updatedAt: new Date() },
      })
      .returning();
    return plan;
  }

  async clearMealPlanDay(userEmail: string, day: string): Promise<void> {
    await db.delete(mealPlans)
      .where(and(eq(mealPlans.userEmail, userEmail), eq(mealPlans.day, day)));
  }

  async clearWeekPlan(userEmail: string): Promise<void> {
    await db.delete(mealPlans).where(eq(mealPlans.userEmail, userEmail));
  }

  async smartfillMealPlan(userEmail: string, dayPlans: Array<{ day: string; breakfast: number[]; lunch: number[]; dinner: number[]; snacks: number[] }>): Promise<MealPlan[]> {
    for (const { day, breakfast, lunch, dinner, snacks } of dayPlans) {
      const recipeIds = [...new Set([...breakfast, ...lunch, ...dinner, ...snacks])];
      await db.insert(mealPlans)
        .values({ userEmail, day, breakfast, lunch, dinner, snacks, recipeIds, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [mealPlans.userEmail, mealPlans.day],
          set: { breakfast, lunch, dinner, snacks, recipeIds, updatedAt: new Date() },
        });
    }
    return this.getMealPlansByEmail(userEmail);
  }

  async getShoppingChecked(userEmail: string): Promise<string[]> {
    const [row] = await db.select().from(shoppingChecked).where(eq(shoppingChecked.userEmail, userEmail));
    return row?.checkedKeys ?? [];
  }

  async toggleShoppingItem(userEmail: string, key: string): Promise<string[]> {
    const current = await this.getShoppingChecked(userEmail);
    const updated = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    await db.insert(shoppingChecked)
      .values({ userEmail, checkedKeys: updated, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: shoppingChecked.userEmail,
        set: { checkedKeys: updated, updatedAt: new Date() },
      });
    return updated;
  }

  async clearShoppingChecked(userEmail: string): Promise<void> {
    await db.delete(shoppingChecked).where(eq(shoppingChecked.userEmail, userEmail));
  }

  async getAffiliateLinks(): Promise<AffiliateLink[]> {
    const existing = await db.select().from(affiliateLinks);
    if (existing.length === AFFILIATE_SLOTS.length) return existing;
    for (const slot of AFFILIATE_SLOTS) {
      const found = existing.find((l) => l.slot === slot);
      if (!found) {
        const defaults = AFFILIATE_DEFAULTS[slot];
        await db.insert(affiliateLinks).values({
          slot: defaults.slot,
          label: defaults.label,
          buttonText: defaults.buttonText,
          webUrl: defaults.webUrl,
          deepLinkUrl: defaults.deepLinkUrl,
          isActive: defaults.isActive,
        }).onConflictDoNothing();
      }
    }
    return await db.select().from(affiliateLinks);
  }

  async upsertAffiliateLink(slot: AffiliateSlot, data: Partial<Omit<AffiliateLink, "id" | "slot">>, updatedBy: string): Promise<AffiliateLink> {
    const existing = await db.select().from(affiliateLinks).where(eq(affiliateLinks.slot, slot)).limit(1);
    if (existing.length === 0) {
      const defaults = AFFILIATE_DEFAULTS[slot];
      const [created] = await db.insert(affiliateLinks).values({
        slot,
        label: data.label ?? defaults.label,
        buttonText: data.buttonText ?? defaults.buttonText,
        webUrl: data.webUrl ?? defaults.webUrl,
        deepLinkUrl: data.deepLinkUrl ?? defaults.deepLinkUrl,
        isActive: data.isActive ?? defaults.isActive,
        updatedBy,
      }).returning();
      return created;
    }
    const [updated] = await db.update(affiliateLinks)
      .set({ ...data, updatedAt: new Date(), updatedBy })
      .where(eq(affiliateLinks.slot, slot))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
