import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera, Plus, Trash2, Loader2, Sparkles, X,
  ShoppingBag, ChefHat, AlertCircle, Check, Image,
  Lightbulb, RefreshCw, RotateCcw, WandSparkles, Clock, Users,
} from "lucide-react";
import type { PantryItem, Recipe } from "@shared/schema";

interface RecipeSuggestion {
  recipe: Recipe;
  matchPct: number;
  missingMain: string[];
  missingSpices: string[];
}

interface AIGeneratedRecipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  cuisineType: string;
  dietaryTags: string[];
  pantryIngredients: string[];
  additionalIngredients: string[];
}

interface PantryGenieTabProps {
  onSelectRecipe: (recipe: Recipe) => void;
}

export function PantryGenieTab({ onSelectRecipe }: PantryGenieTabProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [newItem, setNewItem] = useState("");
  const [identified, setIdentified] = useState<string[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [aiRecipe, setAiRecipe] = useState<AIGeneratedRecipe | null>(null);
  const [hasSuggested, setHasSuggested] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<number | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [expandedAiSteps, setExpandedAiSteps] = useState(false);

  // Camera modal state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Attach stream to video element whenever stream or modal opens
  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream && !capturedDataUrl) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream, capturedDataUrl]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream]);

  const startCamera = useCallback(async (facing: "environment" | "user" = "environment") => {
    setCameraError(null);
    setCapturedDataUrl(null);
    // Stop existing stream
    cameraStream?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing } },
        audio: false,
      });
      setCameraStream(stream);
      setFacingMode(facing);
      setShowCamera(true);
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser settings."
          : "Could not access camera. Your device may not have one, or another app is using it."
      );
      setShowCamera(true); // Show modal with error
    }
  }, [cameraStream]);

  const flipCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    startCamera(next);
  }, [facingMode, startCamera]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setCapturedDataUrl(canvas.toDataURL("image/jpeg", 0.92));
    // Pause the stream (not stop — so user can retake)
    video.pause();
  }, []);

  const retakePhoto = useCallback(() => {
    setCapturedDataUrl(null);
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play();
    }
  }, [cameraStream]);

  const useCapturedPhoto = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
          analyzePhotoMutation.mutate(file);
        }
        closeCamera();
      },
      "image/jpeg",
      0.92,
    );
  }, []);

  const closeCamera = useCallback(() => {
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setShowCamera(false);
    setCapturedDataUrl(null);
    setCameraError(null);
  }, [cameraStream]);

  const { data: pantry = [], isLoading: pantryLoading } = useQuery<PantryItem[]>({
    queryKey: ["/api/pantry"],
  });

  const addItemsMutation = useMutation({
    mutationFn: async (names: string[]) => {
      const res = await fetch("/api/pantry/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ names }),
      });
      if (!res.ok) throw new Error("Failed to add items");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pantry"] });
      setNewItem("");
      setIdentified([]);
      setSelectedToAdd(new Set());
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/pantry/items/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove item");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pantry"] });
      setSuggestions([]);
      setAiRecipe(null);
      setHasSuggested(false);
    },
  });

  const clearPantryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear pantry");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pantry"] });
      setSuggestions([]);
      setAiRecipe(null);
      setHasSuggested(false);
    },
  });

  const analyzePhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/pantry/analyze-photo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message ?? "Failed to analyze photo");
      }
      return res.json() as Promise<{ ingredients: string[] }>;
    },
    onSuccess: (data) => {
      const ingredients = data.ingredients ?? [];
      setIdentified(ingredients);
      setSelectedToAdd(new Set(ingredients));
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry/suggest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to get suggestions");
      return res.json() as Promise<{ suggestions: RecipeSuggestion[] }>;
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      setHasSuggested(true);
    },
  });

  const generateAiRecipeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pantry/generate-recipe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Failed to generate AI recipe");
      }
      return res.json() as Promise<{ recipe: AIGeneratedRecipe }>;
    },
    onSuccess: (data) => {
      setAiRecipe(data.recipe);
      setExpandedAiSteps(false);
    },
  });

  const handleFindRecipes = () => {
    setAiRecipe(null);
    suggestMutation.mutate();
    generateAiRecipeMutation.mutate();
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzePhotoMutation.mutate(file);
    e.target.value = "";
  };

  const handleAddManual = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    addItemsMutation.mutate([trimmed]);
  };

  const handleAddIdentified = () => {
    const toAdd = [...selectedToAdd];
    if (toAdd.length === 0) return;
    addItemsMutation.mutate(toAdd);
  };

  const handleGenerateImage = async (recipe: Recipe) => {
    setGeneratingImageFor(recipe.id);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/generate-image`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate image");
      const data = await res.json();
      const preview = data.imageUrl ?? (data.b64_json ? `data:${data.mimeType};base64,${data.b64_json}` : null);
      if (preview) setGeneratedImages((prev) => ({ ...prev, [recipe.id]: preview }));
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
    } catch (err) {
      console.error("Image generation failed:", err);
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const matchColour = (pct: number) => {
    if (pct >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <span className="text-white font-semibold text-sm">
              {capturedDataUrl ? "Use this photo?" : "Take a Photo"}
            </span>
            <button onClick={closeCamera} className="text-white p-1">
              <X size={22} />
            </button>
          </div>

          {/* Camera error */}
          {cameraError && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
              <AlertCircle size={48} className="text-red-400" />
              <p className="text-white text-center text-sm">{cameraError}</p>
              <Button
                variant="outline"
                onClick={closeCamera}
                className="border-white text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>
          )}

          {/* Live viewfinder */}
          {!cameraError && !capturedDataUrl && (
            <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Flip camera button */}
              <button
                onClick={flipCamera}
                className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2.5"
                title="Flip camera"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          )}

          {/* Captured preview */}
          {!cameraError && capturedDataUrl && (
            <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
              <img src={capturedDataUrl} alt="Captured" className="w-full h-full object-contain" />
            </div>
          )}

          {/* Bottom controls */}
          {!cameraError && (
            <div className="flex items-center justify-center gap-6 px-6 py-6 bg-black/80">
              {capturedDataUrl ? (
                <>
                  <Button
                    variant="outline"
                    onClick={retakePhoto}
                    className="border-white text-white hover:bg-white/10 flex-1 max-w-[140px]"
                  >
                    <RotateCcw size={15} className="mr-1.5" />
                    Retake
                  </Button>
                  <Button
                    onClick={useCapturedPhoto}
                    disabled={analyzePhotoMutation.isPending}
                    className="bg-primary hover:bg-primary/90 flex-1 max-w-[140px]"
                  >
                    {analyzePhotoMutation.isPending ? (
                      <Loader2 size={15} className="animate-spin mr-1.5" />
                    ) : (
                      <Sparkles size={15} className="mr-1.5" />
                    )}
                    Analyse
                  </Button>
                </>
              ) : (
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
                  title="Capture photo"
                >
                  <div className="w-12 h-12 rounded-full bg-white" />
                </button>
              )}
            </div>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
          <ShoppingBag size={24} className="text-primary" />
          Pantry
        </h2>
        <p className="text-neutral-500 text-sm mt-1">
          Tell us what's in your kitchen — we'll find the perfect recipes for you.
        </p>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">
            Current Pantry
            {pantry.length > 0 && (
              <span className="ml-2 text-xs font-normal text-neutral-500">
                ({pantry.length} item{pantry.length !== 1 ? "s" : ""})
              </span>
            )}
          </h3>
          {pantry.length > 0 && (
            <Button
              data-testid="button-clear-pantry"
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-7 px-2 text-xs"
              onClick={() => clearPantryMutation.mutate()}
              disabled={clearPantryMutation.isPending}
            >
              {clearPantryMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              <span className="ml-1">Clear all</span>
            </Button>
          )}
        </div>

        {pantryLoading ? (
          <div className="flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
          </div>
        ) : pantry.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 dark:text-neutral-500">
            <ShoppingBag size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Your pantry is empty. Add ingredients below or scan a photo.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="pantry-items">
            {pantry.map((item) => (
              <Badge
                key={item.id}
                data-testid={`pantry-item-${item.id}`}
                variant="secondary"
                className="flex items-center gap-1 pr-1 py-1 pl-3 text-sm bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 capitalize"
              >
                {item.name}
                <button
                  data-testid={`remove-pantry-${item.id}`}
                  onClick={() => removeItemMutation.mutate(item.id)}
                  className="ml-1 rounded-full hover:bg-green-200 dark:hover:bg-green-800 p-0.5 transition-colors"
                >
                  <X size={10} />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 pt-1">
          <Input
            data-testid="input-pantry-item"
            placeholder="e.g. spinach, paneer, dal…"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddManual()}
            className="flex-1 h-9 text-sm"
          />
          <Button
            data-testid="button-add-item"
            size="sm"
            onClick={handleAddManual}
            disabled={!newItem.trim() || addItemsMutation.isPending}
            className="h-9 bg-primary hover:bg-primary/90"
          >
            <Plus size={14} />
          </Button>

          {/* Gallery button — file picker only, no camera */}
          <Button
            data-testid="button-scan-gallery"
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={analyzePhotoMutation.isPending}
            className="h-9 border-primary text-primary hover:bg-primary/5"
            title="Choose a photo from your gallery"
          >
            {analyzePhotoMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Image size={14} />
            )}
            <span className="ml-1 hidden sm:inline">Gallery</span>
          </Button>

          {/* Camera button — uses getUserMedia */}
          <Button
            data-testid="button-scan-camera"
            size="sm"
            variant="outline"
            onClick={() => startCamera("environment")}
            disabled={analyzePhotoMutation.isPending}
            className="h-9 border-primary text-primary hover:bg-primary/5"
            title="Take a photo with your camera"
          >
            <Camera size={14} />
            <span className="ml-1 hidden sm:inline">Camera</span>
          </Button>

          {/* Hidden file input for gallery — no capture attribute */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleGalleryChange}
          />
        </div>
      </div>

      {/* Analyzing indicator */}
      {analyzePhotoMutation.isPending && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3 text-blue-700 dark:text-blue-300">
          <Loader2 size={18} className="animate-spin flex-shrink-0" />
          <p className="text-sm">Gemini is scanning your photo for ingredients…</p>
        </div>
      )}

      {/* Analysis error */}
      {analyzePhotoMutation.isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3 text-red-700 dark:text-red-300">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Photo analysis failed</p>
            <p className="text-xs mt-0.5 opacity-80">
              {(analyzePhotoMutation.error as Error)?.message ?? "Please try again with a clearer photo."}
            </p>
            <button
              className="text-xs underline mt-1 opacity-70 hover:opacity-100"
              onClick={() => analyzePhotoMutation.reset()}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Identified ingredients from photo */}
      {identified.length > 0 && !analyzePhotoMutation.isPending && (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-blue-200 dark:border-blue-700 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Sparkles size={16} />
              <h3 className="font-semibold text-sm">
                Gemini found {identified.length} ingredient{identified.length !== 1 ? "s" : ""}
              </h3>
            </div>
            <button
              onClick={() => { setIdentified([]); setSelectedToAdd(new Set()); }}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-xs text-neutral-500">Tap to deselect any you don't want to add.</p>
          <div className="flex flex-wrap gap-2">
            {identified.map((ing) => (
              <button
                key={ing}
                data-testid={`identified-${ing}`}
                onClick={() =>
                  setSelectedToAdd((prev) => {
                    const next = new Set(prev);
                    next.has(ing) ? next.delete(ing) : next.add(ing);
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border transition-all ${
                  selectedToAdd.has(ing)
                    ? "bg-primary text-white border-primary"
                    : "bg-neutral-50 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-600 line-through opacity-50"
                }`}
              >
                {selectedToAdd.has(ing) && <Check size={11} />}
                {ing}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              data-testid="button-add-identified"
              size="sm"
              onClick={handleAddIdentified}
              disabled={selectedToAdd.size === 0 || addItemsMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {addItemsMutation.isPending ? (
                <Loader2 size={13} className="animate-spin mr-1" />
              ) : (
                <Plus size={13} className="mr-1" />
              )}
              Add {selectedToAdd.size > 0 ? `${selectedToAdd.size} ` : ""}selected to Pantry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setIdentified([]); setSelectedToAdd(new Set()); }}
            >
              Dismiss all
            </Button>
          </div>
        </div>
      )}

      {/* No ingredients found from photo */}
      {identified.length === 0 && analyzePhotoMutation.isSuccess && !analyzePhotoMutation.isPending && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 text-amber-700 dark:text-amber-300">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">No ingredients detected</p>
            <p className="text-xs mt-0.5 opacity-80">
              Try a clearer, well-lit photo of your vegetables, fruits, or pantry items.
            </p>
          </div>
        </div>
      )}

      {/* Find recipes button */}
      {pantry.length > 0 && (
        <Button
          data-testid="button-find-recipes"
          className="w-full bg-primary hover:bg-primary/90 py-5 text-base font-semibold"
          onClick={handleFindRecipes}
          disabled={suggestMutation.isPending || generateAiRecipeMutation.isPending}
        >
          {suggestMutation.isPending || generateAiRecipeMutation.isPending ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              {generateAiRecipeMutation.isPending && !suggestMutation.isPending
                ? "Creating your AI recipe…"
                : "Finding recipes for your pantry…"}
            </>
          ) : (
            <>
              <ChefHat size={18} className="mr-2" />
              {hasSuggested ? "Refresh Suggestions" : "Find Recipes from My Pantry"}
            </>
          )}
        </Button>
      )}

      {/* ── SECTION 1: Recipes from Our Library ── */}
      {hasSuggested && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-700 pb-2">
            <ChefHat size={18} className="text-primary" />
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 text-base">
              From Our Recipe Library
            </h3>
            <span className="text-xs font-normal text-neutral-500 ml-1">
              {suggestions.length} match{suggestions.length !== 1 ? "es" : ""}
            </span>
          </div>

          {suggestMutation.isPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 text-center text-neutral-500">
              <AlertCircle size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recipe matches found. Try adding more ingredients to your pantry.</p>
            </div>
          ) : (
            suggestions.map(({ recipe, matchPct, missingMain, missingSpices }) => (
              <div
                key={recipe.id}
                data-testid={`suggestion-card-${recipe.id}`}
                className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm"
              >
                {generatedImages[recipe.id] ? (
                  <img src={generatedImages[recipe.id]} alt={recipe.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center">
                    <ChefHat size={36} className="text-amber-300 dark:text-amber-600" />
                  </div>
                )}

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4
                        data-testid={`suggestion-title-${recipe.id}`}
                        className="font-bold text-neutral-800 dark:text-neutral-100 text-base leading-tight"
                      >
                        {recipe.title}
                      </h4>
                      <p className="text-xs text-neutral-500 mt-0.5">{recipe.cuisineType}</p>
                    </div>
                    <div className={`text-right flex-shrink-0 ${matchColour(matchPct)}`}>
                      <div className="text-lg font-bold">{matchPct}%</div>
                      <div className="text-xs">match</div>
                    </div>
                  </div>

                  {missingMain.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-100 dark:border-orange-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={13} className="text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">Missing main ingredients</p>
                          <p className="text-xs text-orange-600 dark:text-orange-400">{missingMain.join(", ")}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {missingSpices.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-100 dark:border-amber-800">
                      <div className="flex items-start gap-2">
                        <Lightbulb size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Add these to elevate the dish</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">{missingSpices.join(", ")}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      data-testid={`button-view-recipe-${recipe.id}`}
                      size="sm"
                      className="flex-1 bg-primary hover:bg-primary/90 text-sm"
                      onClick={() => onSelectRecipe(recipe)}
                    >
                      View Recipe
                    </Button>
                    <Button
                      data-testid={`button-gen-image-${recipe.id}`}
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs"
                      onClick={() => handleGenerateImage(recipe)}
                      disabled={generatingImageFor === recipe.id}
                      title="Generate AI dish photo"
                    >
                      {generatingImageFor === recipe.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : generatedImages[recipe.id] ? (
                        <RefreshCw size={13} />
                      ) : (
                        <Image size={13} />
                      )}
                      <span className="ml-1 hidden sm:inline">
                        {generatedImages[recipe.id] ? "Regenerate" : "AI Photo"}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── SECTION 2: AI-Generated Recipe ── */}
      {hasSuggested && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-violet-200 dark:border-violet-800 pb-2">
            <WandSparkles size={18} className="text-violet-500" />
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 text-base">
              AI-Created Recipe Just for You
            </h3>
            <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-medium">New</span>
          </div>

          {generateAiRecipeMutation.isPending ? (
            <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-violet-200 dark:border-violet-800 p-6 flex flex-col items-center gap-3 text-violet-600 dark:text-violet-400">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <WandSparkles size={20} className="animate-pulse" />
              </div>
              <p className="text-sm font-medium">AI is crafting a personalised recipe with your ingredients…</p>
              <p className="text-xs text-neutral-400">This takes a few seconds</p>
            </div>
          ) : generateAiRecipeMutation.isError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3 text-red-700 dark:text-red-300">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Could not generate AI recipe</p>
                <p className="text-xs mt-0.5 opacity-80">{(generateAiRecipeMutation.error as Error)?.message}</p>
                <button className="text-xs underline mt-1 opacity-70 hover:opacity-100" onClick={() => generateAiRecipeMutation.mutate()}>
                  Try again
                </button>
              </div>
            </div>
          ) : aiRecipe ? (
            <div
              data-testid="ai-recipe-card"
              className="bg-white dark:bg-neutral-800 rounded-2xl border-2 border-violet-200 dark:border-violet-800 overflow-hidden shadow-sm"
            >
              {/* AI badge header */}
              <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-3 flex items-center gap-2">
                <WandSparkles size={16} className="text-white" />
                <span className="text-white text-sm font-semibold">AI-Generated Recipe</span>
                <span className="ml-auto text-violet-200 text-xs">{aiRecipe.cuisineType}</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Title + meta */}
                <div>
                  <h4
                    data-testid="ai-recipe-title"
                    className="font-bold text-neutral-800 dark:text-neutral-100 text-lg leading-tight"
                  >
                    {aiRecipe.title}
                  </h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">{aiRecipe.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Clock size={11} />
                      Prep {aiRecipe.prepTime ?? "—"}m · Cook {aiRecipe.cookTime ?? "—"}m
                    </span>
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Users size={11} />
                      Serves {aiRecipe.servings ?? "—"}
                    </span>
                    {aiRecipe.dietaryTags?.map((tag) => (
                      <span key={tag} className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Pantry ingredients used */}
                {aiRecipe.pantryIngredients?.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-100 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-1.5">
                      <Check size={12} className="text-green-600" />
                      From your pantry ({aiRecipe.pantryIngredients.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiRecipe.pantryIngredients.map((ing) => (
                        <span key={ing} className="text-xs bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional ingredients needed */}
                {aiRecipe.additionalIngredients?.length > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-100 dark:border-orange-800">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-1.5">
                      <ShoppingBag size={12} />
                      You'll also need ({aiRecipe.additionalIngredients.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiRecipe.additionalIngredients.map((ing) => (
                        <span key={ing} className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded-full">{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full ingredients list */}
                <div>
                  <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">All Ingredients</p>
                  <ul className="space-y-1">
                    {aiRecipe.ingredients?.map((ing, i) => (
                      <li key={i} className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions — collapsed/expanded */}
                <div>
                  <button
                    className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline"
                    onClick={() => setExpandedAiSteps((v) => !v)}
                    data-testid="button-toggle-ai-steps"
                  >
                    {expandedAiSteps ? "Hide" : "Show"} step-by-step instructions ({aiRecipe.instructions?.length} steps)
                  </button>
                  {expandedAiSteps && (
                    <ol className="space-y-2 mt-2">
                      {aiRecipe.instructions?.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* Regenerate button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-violet-300 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  onClick={() => generateAiRecipeMutation.mutate()}
                  disabled={generateAiRecipeMutation.isPending}
                  data-testid="button-regenerate-ai-recipe"
                >
                  <RefreshCw size={13} className={`mr-1.5 ${generateAiRecipeMutation.isPending ? "animate-spin" : ""}`} />
                  Create a Different AI Recipe
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
