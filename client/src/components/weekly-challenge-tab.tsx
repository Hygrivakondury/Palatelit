import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy, Plus, X, ChevronDown, ChevronUp, Loader2,
  Flame, CheckCircle2, Clock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { RecipeSubmitForm } from "@/components/recipe-submit-form";
import type { Challenge, Recipe, UserProfile } from "@shared/schema";

const challengeSchema = z.object({
  title: z.string().min(5, "At least 5 characters"),
  description: z.string().min(10, "At least 10 characters"),
  suggestedDish: z.string().min(2, "Name a dish"),
});

type ChallengeValues = z.infer<typeof challengeSchema>;

interface WeeklyChallengeTabProps {
  profile: UserProfile | null;
  currentUserId: string;
}

export function WeeklyChallengeTab({ profile, currentUserId }: WeeklyChallengeTabProps) {
  const qc = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showAllChallenges, setShowAllChallenges] = useState(false);
  const [submittedRecipe, setSubmittedRecipe] = useState<Recipe | null>(null);

  const isAdmin = profile?.isAdmin === true;

  const { data: activeChallenge, isLoading: loadingActive } = useQuery<Challenge | null>({
    queryKey: ["/api/challenges/active"],
    queryFn: async () => {
      const res = await fetch("/api/challenges/active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load challenge");
      return res.json();
    },
  });

  const { data: allChallenges = [], isLoading: loadingAll } = useQuery<Challenge[]>({
    queryKey: ["/api/challenges"],
    queryFn: async () => {
      const res = await fetch("/api/challenges", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load challenges");
      return res.json();
    },
    enabled: showAllChallenges,
  });

  const { data: myRecipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes/mine"],
    queryFn: async () => {
      const res = await fetch("/api/recipes/mine", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load your recipes");
      return res.json();
    },
  });

  const form = useForm<ChallengeValues>({
    resolver: zodResolver(challengeSchema),
    defaultValues: { title: "", description: "", suggestedDish: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ChallengeValues) => {
      const res = await apiRequest("POST", "/api/challenges", values);
      return res.json() as Promise<Challenge>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/challenges/active"] });
      qc.invalidateQueries({ queryKey: ["/api/challenges"] });
      form.reset();
      setShowCreateForm(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/challenges/${id}/toggle`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/challenges/active"] });
      qc.invalidateQueries({ queryKey: ["/api/challenges"] });
    },
  });

  const myChallenge = activeChallenge
    ? myRecipes.find((r) => r.challengeId === activeChallenge.id)
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <Trophy size={24} className="text-amber-500" />
            Weekly Challenge
          </h2>
          <p className="text-neutral-500 text-sm mt-1">Cook it, plate it, share it!</p>
        </div>
        {isAdmin && (
          <Button
            data-testid="button-create-challenge"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1"
          >
            {showCreateForm ? <X size={14} /> : <Plus size={14} />}
            {showCreateForm ? "Cancel" : "New Challenge"}
          </Button>
        )}
      </div>

      {isAdmin && showCreateForm && (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-amber-200 p-5 shadow-sm">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Plus size={16} className="text-amber-500" />
            Create a New Challenge
          </h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Challenge Title</FormLabel>
                  <FormControl>
                    <Input data-testid="input-challenge-title" placeholder="e.g. Monsoon Comfort Bowl Challenge" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="suggestedDish" render={({ field }) => (
                <FormItem>
                  <FormLabel>Suggested Dish</FormLabel>
                  <FormControl>
                    <Input data-testid="input-suggested-dish" placeholder="e.g. Dal Khichdi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description / Rules</FormLabel>
                  <FormControl>
                    <Textarea data-testid="input-challenge-description" placeholder="Describe the challenge…" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {createMutation.isError && (
                <p className="text-red-500 text-sm">Failed to create challenge.</p>
              )}
              <Button
                data-testid="button-publish-challenge"
                type="submit"
                disabled={createMutation.isPending}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                {createMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Publishing…</> : "Publish Challenge"}
              </Button>
            </form>
          </Form>
        </div>
      )}

      {loadingActive ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : activeChallenge ? (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-2xl border border-amber-200 dark:border-amber-800 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-amber-500 flex-shrink-0" />
              <Badge className="bg-amber-500 text-white text-xs">Active Now</Badge>
            </div>
            {isAdmin && (
              <Button
                data-testid={`button-toggle-challenge-${activeChallenge.id}`}
                variant="outline"
                size="sm"
                className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => toggleMutation.mutate(activeChallenge.id)}
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "End Challenge"}
              </Button>
            )}
          </div>
          <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mt-3">{activeChallenge.title}</h3>
          <p className="text-neutral-600 dark:text-neutral-300 text-sm mt-1">{activeChallenge.description}</p>

          <div className="mt-4 p-3 bg-white dark:bg-neutral-800 rounded-xl border border-amber-100 dark:border-amber-900">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">This week's dish</p>
            <p className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mt-0.5">{activeChallenge.suggestedDish}</p>
          </div>

          {myChallenge ? (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">You've submitted!</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">"{myChallenge.title}" is live in the community.</p>
              </div>
            </div>
          ) : (
            <Button
              data-testid="button-submit-for-challenge"
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowSubmitForm(!showSubmitForm)}
            >
              {showSubmitForm ? "Cancel Submission" : "Submit Your Recipe"}
            </Button>
          )}

          {showSubmitForm && !myChallenge && (
            <div className="mt-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
              <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
                Submit your {activeChallenge.suggestedDish}
              </h4>
              <RecipeSubmitForm
                challenge={activeChallenge}
                onSuccess={(recipe) => {
                  setShowSubmitForm(false);
                  setSubmittedRecipe(recipe);
                }}
                onCancel={() => setShowSubmitForm(false)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-8 text-center">
          <Trophy size={36} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">No active challenge right now</p>
          <p className="text-neutral-400 text-sm mt-1">
            {isAdmin ? "Create a new challenge above to get the community cooking!" : "Check back soon — the admin will post a new challenge."}
          </p>
        </div>
      )}

      {myRecipes.length > 0 && (
        <div>
          <h3 className="font-semibold text-neutral-700 dark:text-neutral-200 mb-3">My Submitted Recipes</h3>
          <div className="space-y-2">
            {myRecipes.map((recipe) => (
              <div
                key={recipe.id}
                data-testid={`my-recipe-${recipe.id}`}
                className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-emerald-50 flex-shrink-0">
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Trophy size={16} className="text-emerald-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-neutral-800 dark:text-neutral-100 truncate">{recipe.title}</p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Clock size={10} />
                    <span>{(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)}m</span>
                    <span>·</span>
                    <span>{recipe.cuisineType}</span>
                    {recipe.challengeId && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs py-0">Challenge</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          data-testid="button-toggle-past-challenges"
          onClick={() => setShowAllChallenges(!showAllChallenges)}
          className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
        >
          {showAllChallenges ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showAllChallenges ? "Hide" : "View"} past challenges
        </button>

        {showAllChallenges && (
          <div className="mt-3 space-y-2">
            {loadingAll ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : allChallenges.length === 0 ? (
              <p className="text-neutral-400 text-sm">No challenges yet.</p>
            ) : (
              allChallenges.map((c) => (
                <div key={c.id} data-testid={`past-challenge-${c.id}`}
                  className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{c.title}</p>
                    <p className="text-xs text-neutral-500">{c.suggestedDish}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}>
                      {c.isActive ? "Active" : "Ended"}
                    </Badge>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => toggleMutation.mutate(c.id)}
                        disabled={toggleMutation.isPending}
                      >
                        {c.isActive ? "End" : "Reactivate"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
