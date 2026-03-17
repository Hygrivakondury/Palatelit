import {
  recipes, favorites, reviews, challenges, communityMessages, userProfiles, pantryItems, mealPlans, shoppingChecked, affiliateLinks, userFeedback,
  blogPosts, blogComments, adSlots, siteContent,
  type Recipe, type InsertRecipe, type Review, type InsertReview, type Favorite,
  type Challenge, type InsertChallenge, type CommunityMessage, type UserProfile,
  type PantryItem, type MealPlan, type MealType, type AffiliateLink, type AffiliateSlot, AFFILIATE_DEFAULTS, AFFILIATE_SLOTS,
  type UserFeedback, type BlogPost, type InsertBlogPost, type BlogComment, type AdSlot, type SiteContent,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, sql, desc, getTableColumns } from "drizzle-orm";

// Column selection for list queries — omits the large imageData blob so API responses stay small
const { imageData: _imageDataCol, ...recipeListColumns } = getTableColumns(recipes);

export interface IStorage {
  getRecipes(search?: string, cuisine?: string, category?: string): Promise<Recipe[]>;
  getUserRecipes(userId: string): Promise<Recipe[]>;
  getCommunityRecipes(): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  getRecipeImageData(id: number): Promise<string | null>;
  createRecipe(recipe: Partial<InsertRecipe>): Promise<Recipe>;
  updateRecipeImage(id: number, imageUrl: string, imageData?: string): Promise<Recipe | undefined>;
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
  // Admin delete
  deleteRecipe(id: number): Promise<void>;
  deleteCommunityMessage(id: number): Promise<void>;
  updateRecipeMetadata(id: number, cuisineType: string, dietaryTags: string[]): Promise<Recipe | undefined>;
  updateRecipe(id: number, data: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  getAllCommunityMessages(): Promise<{ id: number; recipeId: number; senderName: string | null; content: string; createdAt: Date | null }[]>;
  // Admin category change
  updateRecipeCategory(id: number, category: string): Promise<Recipe | undefined>;
  // Feedback
  createFeedback(data: { userEmail: string; userName: string; userProfileImage: string; message: string }): Promise<UserFeedback>;
  getAllFeedback(): Promise<UserFeedback[]>;
  respondToFeedback(id: number, adminResponse: string): Promise<UserFeedback | undefined>;
  // Blog Posts
  getBlogPosts(publishedOnly?: boolean): Promise<BlogPost[]>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(data: Partial<InsertBlogPost>): Promise<BlogPost>;
  updateBlogPost(id: number, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<void>;
  // Blog Comments
  getCommentsByPost(postId: number, approvedOnly?: boolean): Promise<BlogComment[]>;
  addBlogComment(data: { postId: number; authorId: string; authorName: string | null; authorImageUrl: string | null; content: string }): Promise<BlogComment>;
  deleteBlogComment(id: number): Promise<void>;
  approveBlogComment(id: number): Promise<void>;
  // Ad Slots
  getAdSlots(): Promise<AdSlot[]>;
  upsertAdSlot(slotName: string, data: Partial<Omit<AdSlot, "id" | "slotName">>, updatedBy: string): Promise<AdSlot>;
  // Site Content
  getSiteContent(): Promise<Record<string, string>>;
  upsertSiteContentBulk(entries: Array<{ key: string; value: string }>, updatedBy: string): Promise<void>;
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

    // Always exclude the large imageData blob from list responses to keep API payloads small
    if (conditions.length === 0) {
      return db.select(recipeListColumns).from(recipes).orderBy(recipes.id) as unknown as Recipe[];
    } else if (conditions.length === 1) {
      return db.select(recipeListColumns).from(recipes).where(conditions[0]).orderBy(recipes.id) as unknown as Recipe[];
    } else {
      return db.select(recipeListColumns).from(recipes).where(and(...conditions)).orderBy(recipes.id) as unknown as Recipe[];
    }
  }

  async getUserRecipes(userId: string): Promise<Recipe[]> {
    return db.select(recipeListColumns).from(recipes)
      .where(eq(recipes.submittedBy, userId))
      .orderBy(desc(recipes.createdAt)) as unknown as Recipe[];
  }

  async getCommunityRecipes(): Promise<Recipe[]> {
    return db.select(recipeListColumns).from(recipes)
      .where(eq(recipes.isUserSubmitted, true))
      .orderBy(desc(recipes.createdAt)) as unknown as Recipe[];
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    // Full select including imageData for single-recipe detail views
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe;
  }

  async getRecipeImageData(id: number): Promise<string | null> {
    const [row] = await db.select({ imageData: recipes.imageData }).from(recipes).where(eq(recipes.id, id));
    return row?.imageData ?? null;
  }

  async createRecipe(recipe: Partial<InsertRecipe>): Promise<Recipe> {
    const [created] = await db.insert(recipes).values(recipe as InsertRecipe).returning();
    return created;
  }

  async updateRecipeImage(id: number, imageUrl: string, imageData?: string): Promise<Recipe | undefined> {
    const updateData: { imageUrl: string; imageData?: string } = { imageUrl };
    if (imageData !== undefined) updateData.imageData = imageData;
    const [updated] = await db.update(recipes).set(updateData).where(eq(recipes.id, id)).returning();
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

  async deleteRecipe(id: number): Promise<void> {
    await db.delete(favorites).where(eq(favorites.recipeId, id));
    await db.delete(reviews).where(eq(reviews.recipeId, id));
    await db.delete(communityMessages).where(eq(communityMessages.recipeId, id));
    await db.delete(recipes).where(eq(recipes.id, id));
  }

  async deleteCommunityMessage(id: number): Promise<void> {
    await db.delete(communityMessages).where(eq(communityMessages.id, id));
  }

  async updateRecipeMetadata(id: number, cuisineType: string, dietaryTags: string[]): Promise<Recipe | undefined> {
    const [updated] = await db.update(recipes).set({ cuisineType, dietaryTags }).where(eq(recipes.id, id)).returning();
    return updated;
  }

  async updateRecipe(id: number, data: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const [updated] = await db.update(recipes).set(data).where(eq(recipes.id, id)).returning();
    return updated;
  }

  async getAllCommunityMessages(): Promise<{ id: number; recipeId: number; senderName: string | null; content: string; createdAt: Date | null }[]> {
    return db.select({
      id: communityMessages.id,
      recipeId: communityMessages.recipeId,
      senderName: communityMessages.senderName,
      content: communityMessages.content,
      createdAt: communityMessages.createdAt,
    }).from(communityMessages).orderBy(desc(communityMessages.createdAt)).limit(200);
  }

  async updateRecipeCategory(id: number, category: string): Promise<Recipe | undefined> {
    const [updated] = await db.update(recipes).set({ category }).where(eq(recipes.id, id)).returning();
    return updated;
  }

  async createFeedback(data: { userEmail: string; userName: string; userProfileImage: string; message: string }): Promise<UserFeedback> {
    const [row] = await db.insert(userFeedback).values(data).returning();
    return row;
  }

  async getAllFeedback(): Promise<UserFeedback[]> {
    return db.select().from(userFeedback).orderBy(desc(userFeedback.createdAt));
  }

  async respondToFeedback(id: number, adminResponse: string): Promise<UserFeedback | undefined> {
    const [updated] = await db
      .update(userFeedback)
      .set({ adminResponse, respondedAt: new Date() })
      .where(eq(userFeedback.id, id))
      .returning();
    return updated;
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

  // ─── BLOG POSTS ──────────────────────────────────────────────────────────

  async getBlogPosts(publishedOnly = false): Promise<BlogPost[]> {
    if (publishedOnly) {
      return db.select().from(blogPosts)
        .where(eq(blogPosts.isPublished, true))
        .orderBy(desc(blogPosts.publishedAt));
    }
    return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(data: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db.insert(blogPosts).values(data as InsertBlogPost).returning();
    return post;
  }

  async updateBlogPost(id: number, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const [updated] = await db.update(blogPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogComments).where(eq(blogComments.postId, id));
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  // ─── BLOG COMMENTS ────────────────────────────────────────────────────────

  async getCommentsByPost(postId: number, approvedOnly = true): Promise<BlogComment[]> {
    if (approvedOnly) {
      return db.select().from(blogComments)
        .where(and(eq(blogComments.postId, postId), eq(blogComments.isApproved, true)))
        .orderBy(blogComments.createdAt);
    }
    return db.select().from(blogComments)
      .where(eq(blogComments.postId, postId))
      .orderBy(blogComments.createdAt);
  }

  async addBlogComment(data: { postId: number; authorId: string; authorName: string | null; authorImageUrl: string | null; content: string }): Promise<BlogComment> {
    const [comment] = await db.insert(blogComments).values({
      postId: data.postId,
      authorId: data.authorId,
      authorName: data.authorName,
      authorImageUrl: data.authorImageUrl,
      content: data.content,
      isApproved: true,
    }).returning();
    return comment;
  }

  async deleteBlogComment(id: number): Promise<void> {
    await db.delete(blogComments).where(eq(blogComments.id, id));
  }

  async approveBlogComment(id: number): Promise<void> {
    await db.update(blogComments).set({ isApproved: true }).where(eq(blogComments.id, id));
  }

  // ─── AD SLOTS ────────────────────────────────────────────────────────────

  async getAdSlots(): Promise<AdSlot[]> {
    return db.select().from(adSlots);
  }

  async upsertAdSlot(slotName: string, data: Partial<Omit<AdSlot, "id" | "slotName">>, updatedBy: string): Promise<AdSlot> {
    const existing = await db.select().from(adSlots).where(eq(adSlots.slotName, slotName)).limit(1);
    if (existing.length === 0) {
      const [created] = await db.insert(adSlots).values({
        slotName,
        label: data.label ?? slotName,
        htmlCode: data.htmlCode ?? "",
        isActive: data.isActive ?? false,
        updatedBy,
      }).returning();
      return created;
    }
    const [updated] = await db.update(adSlots)
      .set({ ...data, updatedAt: new Date(), updatedBy })
      .where(eq(adSlots.slotName, slotName))
      .returning();
    return updated;
  }

  async getSiteContent(): Promise<Record<string, string>> {
    const rows = await db.select().from(siteContent);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async upsertSiteContentBulk(entries: Array<{ key: string; value: string }>, updatedBy: string): Promise<void> {
    for (const entry of entries) {
      await db.insert(siteContent)
        .values({ key: entry.key, value: entry.value, updatedBy, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteContent.key,
          set: { value: entry.value, updatedBy, updatedAt: new Date() },
        });
    }
  }
}

export const storage = new DatabaseStorage();
