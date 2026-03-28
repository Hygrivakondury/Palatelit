import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Share2 } from "lucide-react";
import { SiWhatsapp, SiFacebook, SiTelegram, SiInstagram, SiReddit } from "react-icons/si";
import type { Recipe } from "@shared/schema";

interface ShareRecipeSheetProps {
  recipe: Recipe;
  onClose: () => void;
}

function buildShareUrl(recipeId: number): string {
  return `${window.location.origin}/?recipe=${recipeId}`;
}

function buildShareText(recipe: Recipe): string {
  return `🍽️ ${recipe.title} — a delicious Indian vegetarian recipe on Palate Lit!\n\n${recipe.description}\n\n⏱ ${recipe.prepTime + recipe.cookTime} min • ${recipe.cuisineType}`;
}

const PLATFORMS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: SiWhatsapp,
    color: "bg-[#25D366] hover:bg-[#1ebe5d] text-white",
    getUrl: (text: string, url: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: SiTelegram,
    color: "bg-[#0088cc] hover:bg-[#0077b3] text-white",
    getUrl: (text: string, url: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: SiFacebook,
    color: "bg-[#1877F2] hover:bg-[#1466d4] text-white",
    getUrl: (_text: string, url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    icon: SiReddit,
    color: "bg-[#FF4500] hover:bg-[#e03d00] text-white",
    getUrl: (text: string, url: string) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
];

export function ShareRecipeSheet({ recipe, onClose }: ShareRecipeSheetProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareUrl(recipe.id);
  const shareText = buildShareText(recipe);

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, text: shareText, url: shareUrl });
      } catch {
        // user cancelled — ignore
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!", description: "Paste it anywhere to share this recipe." });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const handlePlatform = (getUrl: (text: string, url: string) => string) => {
    window.open(getUrl(shareText, shareUrl), "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const isNativeShareAvailable = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="modal-share-recipe"
        className="max-w-sm w-full rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Recipe
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipe preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-xl">
                🍽️
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{recipe.title}</p>
              <p className="text-xs text-muted-foreground">{recipe.cuisineType} • {recipe.prepTime + recipe.cookTime} min</p>
            </div>
          </div>

          {/* Native share button (mobile) */}
          {isNativeShareAvailable && (
            <Button
              onClick={handleNativeShare}
              className="w-full gap-2"
              data-testid="button-native-share"
            >
              <Share2 className="w-4 h-4" />
              Share via…
            </Button>
          )}

          {/* Platform grid */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Share on
            </p>
            <div className="grid grid-cols-5 gap-2">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handlePlatform(platform.getUrl)}
                  data-testid={`button-share-${platform.id}`}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all text-xs font-medium ${platform.color}`}
                >
                  <platform.icon className="w-5 h-5" />
                  <span className="text-[10px] leading-tight text-center">{platform.label}</span>
                </button>
              ))}

              {/* Instagram — copy link for Instagram Stories */}
              <button
                onClick={handleCopy}
                data-testid="button-share-instagram"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all text-xs font-medium bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#dc2743] hover:opacity-90 text-white"
              >
                <SiInstagram className="w-5 h-5" />
                <span className="text-[10px] leading-tight text-center">Instagram</span>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Instagram: copies the link — paste it in your story or bio.
            </p>
          </div>

          {/* Copy link */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recipe link
            </p>
            <div className="flex gap-2 items-center p-2.5 rounded-xl bg-muted/40 border border-border">
              <span className="flex-1 text-xs text-muted-foreground truncate font-mono">{shareUrl}</span>
              <button
                onClick={handleCopy}
                data-testid="button-copy-link"
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
