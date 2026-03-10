# Flavour Genie

A full-stack vegetarian recipe discovery platform for the Indian community. Users can browse authentic Indian vegetarian recipes and use the **Genie Filter** to find recipes based on ingredients they already have.

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI, TanStack Query, Wouter
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)

## Key Features

- **User Authentication**: Replit Auth (Google, GitHub, email)
- **Recipe Database**: Title, ingredients, step-by-step instructions, prep time, cook time, servings, cuisine type
- **Genie Filter**: Search bar for ingredient-based recipe discovery — matches ingredients across all recipes
- **Cuisine Filter**: Browse by cuisine type (North Indian, South Indian, Gujarati, Punjabi, Bengali, Rajasthani, Maharashtrian, Fusion, Pan-Indian, East Indian, West Indian)
- **Recipe Detail Modal**: Full recipe view with ingredients and numbered instructions
- **Green & Gold theme**: Professional, elegant design using Open Sans + Lora fonts

## Project Structure

```
client/src/
  pages/
    landing.tsx        - Marketing landing page (unauthenticated)
    home.tsx           - Main recipe browse + search page (authenticated)
  components/
    recipe-card.tsx          - Recipe grid card component
    recipe-detail-modal.tsx  - Full recipe detail modal
  hooks/
    use-auth.ts        - Auth state hook

server/
  routes.ts            - API routes (/api/recipes)
  storage.ts           - DatabaseStorage for recipes
  seed.ts              - 12 seed recipes for initial data
  db.ts                - Drizzle DB connection
  replit_integrations/auth/  - Replit Auth integration

shared/
  schema.ts            - Drizzle schema (recipes table) + re-exports auth
  models/auth.ts       - Auth tables (users, sessions)
```

## API Endpoints

- `GET /api/recipes` — List recipes. Query params: `?search=paneer,spinach&cuisine=North+Indian`
- `GET /api/recipes/:id` — Single recipe detail
- `POST /api/recipes` — Create recipe (authenticated)
- `GET /api/auth/user` — Current user
- `GET /api/login` — Begin login flow
- `GET /api/logout` — Logout

## Running

The `Start application` workflow runs `npm run dev` which starts both the Express API and Vite dev server on port 5000.

## Database

PostgreSQL is used for persistence. Run `npm run db:push` to sync schema changes.

Seed data (12 recipes) is inserted automatically on first startup.
