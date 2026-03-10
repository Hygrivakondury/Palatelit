# Flavour Genie

A full-stack vegetarian recipe discovery platform for the Indian community. Users can browse authentic Indian vegetarian recipes and use the **Genie Filter** to find recipes based on ingredients they already have.

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI, TanStack Query, Wouter
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)
- **File Uploads**: Multer (dish photos stored in /uploads/)

## Key Features

- **User Authentication**: Replit Auth (Google, GitHub, email)
- **Recipe Database**: Title, ingredients, step-by-step instructions, prep/cook time, servings, cuisine type, dietary tags
- **Dietary Tags**: Each recipe tagged with Vegan, Gluten-Free, and/or Jain Friendly — filterable on the home page
- **Genie Filter**: Ingredient-based recipe search — matches ingredients across all recipes
- **Cuisine Filter**: Browse by 11 cuisine types (North Indian, South Indian, Gujarati, Punjabi, Bengali, Rajasthani, Maharashtrian, Fusion, Pan-Indian, East Indian, West Indian)
- **Favourites**: Logged-in users can heart/save recipes; favourites accessible via filter
- **Reviews & Ratings**: Logged-in users can post star-rated reviews; displayed in recipe detail
- **Image Upload**: Users can upload a dish photo (JPEG/PNG/WebP, max 5MB) to any recipe
- **Smart Scaling**: Servings multiplier in recipe modal (0.5×–4×) auto-scales all ingredient quantities
- **Green & Gold theme**: Professional, elegant design using Open Sans + Lora fonts

## Project Structure

```
client/src/
  pages/
    landing.tsx        - Marketing landing page (unauthenticated)
    home.tsx           - Main recipe browse + search + filter page (authenticated)
  components/
    recipe-card.tsx          - Recipe grid card (shows dietary tags, favourite indicator)
    recipe-detail-modal.tsx  - Full recipe detail (scaling, tabs, favourites, reviews, image upload)
  hooks/
    use-auth.ts        - Auth state hook

server/
  routes.ts            - API routes (/api/recipes, /api/favorites, /api/reviews, /api/upload)
  storage.ts           - DatabaseStorage for all entities
  seed.ts              - 12 seed recipes with dietary tags
  db.ts                - Drizzle DB connection
  replit_integrations/auth/  - Replit Auth integration

uploads/               - User-uploaded dish photos (served at /uploads/)

shared/
  schema.ts            - Drizzle schema (recipes, favorites, reviews tables)
  models/auth.ts       - Auth tables (users, sessions)
```

## API Endpoints

- `GET  /api/recipes` — List recipes. Query: `?search=paneer,spinach&cuisine=North+Indian`
- `GET  /api/recipes/:id` — Single recipe detail
- `POST /api/recipes` — Create recipe (authenticated)
- `POST /api/recipes/:id/upload-image` — Upload dish photo (multipart/form-data, auth required)
- `GET  /api/recipes/:id/favorite` — Check if user has favorited (authenticated)
- `POST /api/recipes/:id/favorite` — Add to favorites (authenticated)
- `DEL  /api/recipes/:id/favorite` — Remove from favorites (authenticated)
- `GET  /api/favorites` — Get all user's favorites (authenticated)
- `GET  /api/recipes/:id/reviews` — Get reviews for a recipe
- `POST /api/recipes/:id/reviews` — Post a review (authenticated)
- `GET  /api/auth/user` — Current user
- `GET  /api/login` — Begin login flow
- `GET  /api/logout` — Logout

## Running

The `Start application` workflow runs `npm run dev` which starts both Express API and Vite dev server on port 5000.

## Database

PostgreSQL is used for persistence. Run `npm run db:push` to sync schema changes.

Seed data (12 recipes with dietary tags) is inserted automatically on first startup.
