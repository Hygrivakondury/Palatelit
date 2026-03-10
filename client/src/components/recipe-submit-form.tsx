import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { CUISINE_TYPES, DIETARY_TAGS, type Challenge, type Recipe } from "@shared/schema";

const recipeSubmitSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  ingredients: z.array(z.object({ value: z.string().min(1, "Cannot be empty") })).min(2, "Add at least 2 ingredients"),
  instructions: z.array(z.object({ value: z.string().min(1, "Cannot be empty") })).min(2, "Add at least 2 steps"),
  prepTime: z.coerce.number().int().min(1, "Required"),
  cookTime: z.coerce.number().int().min(1, "Required"),
  servings: z.coerce.number().int().min(1, "Required"),
  cuisineType: z.string().min(1, "Select a cuisine type"),
  dietaryTags: z.array(z.string()),
  challengeId: z.number().optional(),
});

type RecipeSubmitValues = z.infer<typeof recipeSubmitSchema>;

interface RecipeSubmitFormProps {
  challenge?: Challenge | null;
  onSuccess: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function RecipeSubmitForm({ challenge, onSuccess, onCancel }: RecipeSubmitFormProps) {
  const qc = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<RecipeSubmitValues>({
    resolver: zodResolver(recipeSubmitSchema),
    defaultValues: {
      title: challenge ? `My ${challenge.suggestedDish} Recipe` : "",
      description: "",
      ingredients: [{ value: "" }, { value: "" }],
      instructions: [{ value: "" }, { value: "" }],
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      cuisineType: "",
      dietaryTags: [],
      challengeId: challenge?.id,
    },
  });

  const { fields: ingredientFields, append: addIngredient, remove: removeIngredient } =
    useFieldArray({ control: form.control, name: "ingredients" });
  const { fields: instructionFields, append: addInstruction, remove: removeInstruction } =
    useFieldArray({ control: form.control, name: "instructions" });

  const createMutation = useMutation({
    mutationFn: async (values: RecipeSubmitValues) => {
      const body = {
        ...values,
        ingredients: values.ingredients.map((i) => i.value),
        instructions: values.instructions.map((i) => i.value),
      };
      const res = await apiRequest("POST", "/api/recipes", body);
      return res.json() as Promise<Recipe>;
    },
    onSuccess: async (recipe) => {
      if (imageFile) {
        const fd = new FormData();
        fd.append("image", imageFile);
        await fetch(`/api/recipes/${recipe.id}/image`, {
          method: "POST",
          credentials: "include",
          body: fd,
        }).then((r) => r.json()).then((updated) => {
          recipe = updated;
        }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
      qc.invalidateQueries({ queryKey: ["/api/recipes/community"] });
      qc.invalidateQueries({ queryKey: ["/api/recipes/mine"] });
      setSubmitted(true);
      onSuccess(recipe);
    },
  });

  const toggleTag = (tag: string) => {
    const current = form.getValues("dietaryTags");
    if (current.includes(tag)) {
      form.setValue("dietaryTags", current.filter((t) => t !== tag));
    } else {
      form.setValue("dietaryTags", [...current, tag]);
    }
  };

  const onSubmit = (values: RecipeSubmitValues) => {
    createMutation.mutate(values);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <CheckCircle2 size={48} className="text-emerald-600" />
        <h3 className="text-xl font-semibold text-neutral-800">Recipe submitted!</h3>
        <p className="text-neutral-500 text-sm">It's now live in the recipe library and community page.</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipe Title</FormLabel>
              <FormControl>
                <Input data-testid="input-recipe-title" placeholder="e.g. Grandma's Palak Paneer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea data-testid="input-recipe-description" placeholder="Tell us about this dish…" rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-3">
          <FormField control={form.control} name="prepTime" render={({ field }) => (
            <FormItem>
              <FormLabel>Prep (min)</FormLabel>
              <FormControl><Input data-testid="input-prep-time" type="number" min={1} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="cookTime" render={({ field }) => (
            <FormItem>
              <FormLabel>Cook (min)</FormLabel>
              <FormControl><Input data-testid="input-cook-time" type="number" min={1} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="servings" render={({ field }) => (
            <FormItem>
              <FormLabel>Servings</FormLabel>
              <FormControl><Input data-testid="input-servings" type="number" min={1} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField
          control={form.control}
          name="cuisineType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cuisine Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-cuisine-type">
                    <SelectValue placeholder="Select cuisine" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CUISINE_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Dietary Tags</FormLabel>
          <div className="flex flex-wrap gap-2 mt-2">
            {DIETARY_TAGS.map((tag) => {
              const selected = form.watch("dietaryTags").includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  data-testid={`tag-${tag}`}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <FormLabel>Ingredients</FormLabel>
            <Button type="button" variant="ghost" size="sm" onClick={() => addIngredient({ value: "" })}>
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {ingredientFields.map((field, i) => (
              <div key={field.id} className="flex gap-2">
                <FormField
                  control={form.control}
                  name={`ingredients.${i}.value`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          data-testid={`input-ingredient-${i}`}
                          placeholder={`Ingredient ${i + 1}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {ingredientFields.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" className="px-2 text-red-500" onClick={() => removeIngredient(i)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <FormLabel>Instructions</FormLabel>
            <Button type="button" variant="ghost" size="sm" onClick={() => addInstruction({ value: "" })}>
              <Plus size={14} className="mr-1" /> Add Step
            </Button>
          </div>
          <div className="space-y-2">
            {instructionFields.map((field, i) => (
              <div key={field.id} className="flex gap-2">
                <span className="text-xs text-emerald-700 font-medium w-5 mt-3 flex-shrink-0">{i + 1}.</span>
                <FormField
                  control={form.control}
                  name={`instructions.${i}.value`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Textarea
                          data-testid={`input-instruction-${i}`}
                          placeholder={`Step ${i + 1}`}
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {instructionFields.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" className="px-2 text-red-500 self-start mt-2" onClick={() => removeInstruction(i)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <FormLabel>Photo of your dish</FormLabel>
          <div className="mt-2">
            <input
              data-testid="input-recipe-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="text-sm text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer"
            />
            {imageFile && <p className="text-xs text-emerald-600 mt-1">Selected: {imageFile.name}</p>}
          </div>
        </div>

        {createMutation.isError && (
          <p className="text-red-500 text-sm">Failed to submit recipe. Please try again.</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="button-submit-recipe"
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {createMutation.isPending ? (
              <><Loader2 size={15} className="animate-spin mr-2" /> Submitting…</>
            ) : "Submit Recipe"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
