import { Button } from "@/components/ui/button";
import { ArrowRight, Star, ChefHat, Sparkles, Search } from "lucide-react";
import logoImg from "@assets/Palate_Lit_1773224307175.jpg";
import { useQuery } from "@tanstack/react-query";
import { SITE_CONTENT_DEFAULTS } from "@shared/schema";

function useSiteContent() {
  const { data } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-content"],
  });
  return (key: string) => (data?.[key] ?? SITE_CONTENT_DEFAULTS[key] ?? "");
}

export default function LandingPage() {
  const sc = useSiteContent();

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Palate Lit logo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-serif text-xl font-bold text-foreground tracking-tight">Palate <strong>Lit</strong></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#cuisines" className="hover:text-foreground transition-colors">Cuisines</a>
            <a href="#community" className="hover:text-foreground transition-colors">Community</a>
          </div>
          <a href="/api/login">
            <Button variant="default" size="sm" data-testid="button-login-nav" className="gap-2 font-medium">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero — full-width, dark, immersive */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#1c1410]">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 30% 50%, hsl(16 72% 48% / 0.4) 0%, transparent 60%), radial-gradient(circle at 75% 20%, hsl(36 80% 55% / 0.25) 0%, transparent 50%)`
        }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/8 text-white/70 text-xs font-medium mb-10 tracking-wide uppercase">
            <Sparkles className="w-3 h-3" />
            {sc("hero_badge")}
          </div>

          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.04] tracking-tight mb-8">
            {sc("hero_headline_1")} <br />
            <span style={{ color: "hsl(16 72% 62%)" }}>{sc("hero_headline_accent")}</span> {sc("hero_headline_2")}
          </h1>

          <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-12 font-light">
            {sc("hero_description")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="/api/login">
              <Button
                size="lg"
                data-testid="button-get-started-hero"
                className="gap-2 px-10 text-base font-semibold shadow-xl"
                style={{ height: "52px", minWidth: "200px" }}
              >
                {sc("hero_cta_primary")} <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <a href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                data-testid="button-learn-more"
                className="text-base font-medium px-8 border-white/20 text-white/80 bg-white/5 hover:bg-white/10"
                style={{ height: "52px" }}
              >
                {sc("hero_cta_secondary")}
              </Button>
            </a>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex -space-x-2">
              {["🧑‍🍳", "👩‍🍳", "👨‍🍳", "🧑‍🍳", "👩‍🍳"].map((emoji, i) => (
                <div key={i} className="w-9 h-9 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-sm">
                  {emoji}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex gap-0.5 mb-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-white/50 text-xs">Loved by <span className="text-white/80 font-medium">1,000s</span> of home cooks</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-28 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-4">How It Works</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground">{sc("section_how_title")}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: <Search className="w-7 h-7 text-primary" />, step: "01", title: "Tell us what you have", desc: "Type the ingredients sitting in your fridge or pantry — paneer, dal, vegetables, spices. Our smart filter understands natural language." },
              { icon: <Sparkles className="w-7 h-7 text-primary" />, step: "02", title: "Discover perfect matches", desc: "Instantly see recipes ranked by how well they fit your ingredients. No missing items, no mid-recipe supermarket dashes." },
              { icon: <ChefHat className="w-7 h-7 text-primary" />, step: "03", title: "Cook with confidence", desc: "Step-by-step instructions crafted for Indian home kitchens, with exact measurements and expert tips built in." },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-6 border border-primary/12">
                  {feature.icon}
                </div>
                <p className="text-xs font-bold text-primary/60 uppercase tracking-[0.15em] mb-2">{feature.step}</p>
                <h3 className="font-serif text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cuisines */}
      <section id="cuisines" className="py-24 px-6 bg-muted/40">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-4">Cuisine Coverage</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            {sc("section_cuisines_title")}
          </h2>
          <p className="text-muted-foreground text-base mb-14 max-w-xl mx-auto leading-relaxed">
            {sc("section_cuisines_description")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: "North Indian", emoji: "🌶️" },
              { name: "South Indian", emoji: "🥥" },
              { name: "Gujarati", emoji: "🫓" },
              { name: "Punjabi", emoji: "🫘" },
              { name: "Bengali", emoji: "🍚" },
              { name: "Rajasthani", emoji: "🏜️" },
              { name: "Maharashtrian", emoji: "🌿" },
              { name: "East Indian", emoji: "🐟" },
              { name: "West Indian", emoji: "🫚" },
              { name: "Fusion", emoji: "✨" },
              { name: "Pan-Indian", emoji: "🇮🇳" },
            ].map((cuisine) => (
              <div key={cuisine.name} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border rounded-full shadow-sm hover-elevate cursor-pointer">
                <span className="text-base">{cuisine.emoji}</span>
                <span className="text-sm font-medium text-foreground">{cuisine.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="community" className="py-28 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-4">Community Love</p>
            <h2 className="font-serif text-4xl font-bold text-foreground">{sc("section_community_title")}</h2>
            <p className="text-muted-foreground mt-3 text-base">{sc("section_community_description")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Priya S.", location: "Bengaluru", quote: "I finally stopped wasting vegetables. Palate Lit always has a recipe for whatever's in my fridge!", stars: 5 },
              { name: "Rahul M.", location: "Delhi", quote: "The Recipe Filter is magic. I typed 'dal and some spices' and got 12 authentic recipes instantly.", stars: 5 },
              { name: "Meera K.", location: "Mumbai", quote: "As a Gujarati, I was skeptical. But the regional recipe accuracy is truly impressive.", stars: 5 },
            ].map((t, i) => (
              <div key={i} className="bg-white border border-card-border rounded-2xl p-7 space-y-4 shadow-sm">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-foreground leading-relaxed text-sm">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 px-6 bg-[#1c1410]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            {sc("cta_headline_main")} <span style={{ color: "hsl(16 72% 62%)" }}>{sc("cta_headline_accent")}</span>
          </h2>
          <p className="text-white/55 text-lg mb-10 leading-relaxed">
            {sc("cta_description")}
          </p>
          <a href="/api/login">
            <Button size="lg" data-testid="button-cta-final" className="gap-2 px-12 text-base font-semibold shadow-xl" style={{ height: "56px" }}>
              {sc("cta_button")} <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <p className="text-white/30 text-sm mt-5">No credit card required · 100% free to use</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 bg-background">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Palate Lit logo" className="w-6 h-6 rounded-md object-cover" />
            <span className="font-serif font-bold text-foreground">Palate Lit</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Palate Lit. {sc("footer_tagline")}</p>
        </div>
      </footer>
    </div>
  );
}
