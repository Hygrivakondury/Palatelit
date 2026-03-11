import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Search, ChefHat, Star, ArrowRight, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-bold text-foreground tracking-tight">Palate Lit</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#cuisines" className="hover:text-foreground transition-colors">Cuisines</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Community</a>
          </div>
          <a href="/api/login">
            <Button variant="default" size="sm" data-testid="button-login-nav" className="gap-2">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent rounded-full border border-accent-border">
              <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
              <span className="text-xs font-medium text-accent-foreground">100% Vegetarian • Made for India</span>
            </div>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.05] tracking-tight">
              Cook What You Love,
              <span className="block text-primary"> with What You Have</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Illuminating Flavor. Elevating Mood — Palate Lit finds authentic Indian vegetarian recipes perfectly matched to what's in your kitchen.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started-hero" className="gap-2 px-8 h-12 text-base font-medium shadow-lg">
                  Start Cooking <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="#features">
                <Button size="lg" variant="outline" data-testid="button-learn-more" className="h-12 text-base font-medium px-8">
                  See How It Works
                </Button>
              </a>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex -space-x-2">
                {["🧑‍🍳", "👩‍🍳", "👨‍🍳", "🧑‍🍳"].map((emoji, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-sm">
                    {emoji}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Trusted by 1000s</span> of home cooks
              </p>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative">
            <div className="relative bg-card border border-card-border rounded-2xl p-6 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Search className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Genie Filter</p>
                    <p className="text-sm font-medium text-foreground">What's in your kitchen?</p>
                  </div>
                </div>
                <div className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground font-mono">
                  paneer, spinach, tomatoes...
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { title: "Palak Paneer", cuisine: "North Indian", time: "30 min", match: "98%" },
                    { title: "Paneer Bhurji", cuisine: "Punjabi", time: "20 min", match: "94%" },
                    { title: "Saag Paneer", cuisine: "North Indian", time: "45 min", match: "91%" },
                  ].map((recipe, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl hover-elevate cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                        {i === 0 ? "🥬" : i === 1 ? "🧀" : "🍃"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{recipe.title}</p>
                        <p className="text-xs text-muted-foreground">{recipe.cuisine} • {recipe.time}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs bg-accent text-accent-foreground border-0 flex-shrink-0">
                        {recipe.match}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Floating accent cards */}
            <div className="absolute -top-4 -right-4 bg-accent border border-accent-border rounded-xl px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-accent-foreground fill-accent-foreground" />
                <span className="text-xs font-semibold text-accent-foreground">100s of Recipes</span>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 bg-primary rounded-xl px-4 py-2 shadow-lg">
              <span className="text-xs font-semibold text-primary-foreground">11 Cuisine Types</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">How It Works</Badge>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground">Simple. Delicious. Indian.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Three steps from pantry to plate.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Search className="w-6 h-6 text-primary" />,
                step: "01",
                title: "Enter Your Ingredients",
                desc: "Type in what you have — paneer, dal, vegetables, spices. The Genie Filter understands natural language.",
              },
              {
                icon: <Sparkles className="w-6 h-6 text-primary" />,
                step: "02",
                title: "Discover Matches",
                desc: "Instantly see recipes ranked by how well they match your available ingredients. No missing items frustration.",
              },
              {
                icon: <ChefHat className="w-6 h-6 text-primary" />,
                step: "03",
                title: "Cook with Confidence",
                desc: "Follow step-by-step instructions crafted for Indian home kitchens, with exact measurements and tips.",
              },
            ].map((feature, i) => (
              <div key={i} className="relative bg-card border border-card-border rounded-2xl p-8 hover-elevate cursor-default">
                <div className="absolute top-6 right-6 text-5xl font-bold text-border/60 font-mono select-none">{feature.step}</div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="font-serif text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cuisine Types Section */}
      <section id="cuisines" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">Cuisine Coverage</Badge>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground">From Kashmir to Kanyakumari</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Explore the rich diversity of India's vegetarian culinary traditions.</p>
          </div>
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
              <div key={cuisine.name} className="flex items-center gap-2 px-5 py-3 bg-card border border-card-border rounded-full hover-elevate cursor-pointer">
                <span className="text-lg">{cuisine.emoji}</span>
                <span className="text-sm font-medium text-foreground">{cuisine.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">Community Love</Badge>
            <h2 className="font-serif text-4xl font-bold text-foreground">What Cooks Are Saying</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Priya S.", location: "Bengaluru", quote: "I finally stopped wasting vegetables. Palate Lit always has a recipe for whatever's in my fridge!", stars: 5 },
              { name: "Rahul M.", location: "Delhi", quote: "The Genie Filter is magic. I typed 'dal and some spices' and got 12 authentic recipes instantly.", stars: 5 },
              { name: "Meera K.", location: "Mumbai", quote: "As a Gujarati, I was skeptical. But the regional recipe accuracy is truly impressive.", stars: 5 },
            ].map((t, i) => (
              <div key={i} className="bg-card border border-card-border rounded-2xl p-6 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-foreground leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border">
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

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="font-serif text-5xl font-bold text-foreground leading-tight">
            Ready to cook something <span className="text-primary">wonderful?</span>
          </h2>
          <p className="text-muted-foreground text-lg">Join thousands of Indian home cooks who've transformed their kitchens.</p>
          <a href="/api/login">
            <Button size="lg" data-testid="button-cta-final" className="gap-2 px-10 h-14 text-base font-medium shadow-lg">
              Join Palate Lit — It's Free <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <p className="text-sm text-muted-foreground">No credit card required • 100% free to use</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Leaf className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-foreground">Palate Lit</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Palate Lit. Celebrating India's vegetarian heritage.</p>
        </div>
      </footer>
    </div>
  );
}
