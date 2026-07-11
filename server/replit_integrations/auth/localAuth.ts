import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { authStorage } from "./storage";

const scrypt = promisify(_scrypt);

// ─── Password hashing (Node built-in scrypt, no external dependency) ────────
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${derived.toString("hex")}.${salt}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [hashHex, salt] = stored.split(".");
  if (!hashHex || !salt) return false;
  const hashBuf = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

// ─── Session (mirrors the original Replit setup, Postgres-backed) ───────────
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Railway sits behind a proxy; needed for secure cookies to be set
    cookie: {
      httpOnly: true,
      // secure requires HTTPS. Railway serves HTTPS in production.
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

// Build the `claims` object shape the rest of the app expects
// (matches the old Replit Auth: req.user.claims.sub / .email / .first_name ...)
function toSessionUser(user: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}) {
  return {
    claims: {
      sub: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_image_url: user.profileImageUrl,
    },
  };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await authStorage.getUserByEmail(email.toLowerCase().trim());
          if (!user || !user.password) {
            return done(null, false, { message: "Invalid email or password" });
          }
          const ok = await verifyPassword(password, user.password);
          if (!ok) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, toSessionUser(user));
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // ─── Google login (only active if credentials are configured) ─────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const callbackURL = `${process.env.APP_URL || ""}/api/auth/google/callback`;
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value?.toLowerCase();
            if (!email) return done(new Error("No email in Google profile"));

            // 1) already linked by googleId?
            let user = await authStorage.getUserByGoogleId(profile.id);
            // 2) else match by email and link
            if (!user) {
              const byEmail = await authStorage.getUserByEmail(email);
              if (byEmail) {
                await authStorage.linkGoogleId(byEmail.id, profile.id);
                user = { ...byEmail, googleId: profile.id };
              }
            }
            // 3) else create a new account
            if (!user) {
              user = await authStorage.createUser({
                email,
                password: null,
                googleId: profile.id,
                firstName: profile.displayName || email.split("@")[0],
                lastName: null,
                profileImageUrl: profile.photos?.[0]?.value || null,
              });
            }
            return done(null, toSessionUser(user));
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // ─── Register ─────────────────────────────────────────────────────────────
  app.post("/api/register", async (req, res, next) => {
    try {
      const email = String(req.body.email || "").toLowerCase().trim();
      const password = String(req.body.password || "");
      const displayName = String(req.body.displayName || "").trim();

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const hashed = await hashPassword(password);
      const firstName = displayName || email.split("@")[0];

      const user = await authStorage.createUser({
        email,
        password: hashed,
        firstName,
        lastName: null,
        profileImageUrl: null,
      });

      req.login(toSessionUser(user), (err) => {
        if (err) return next(err);
        res.json({ id: user.id, email: user.email, firstName: user.firstName });
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Login ────────────────────────────────────────────────────────────────
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Login failed" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json({
          id: user.claims.sub,
          email: user.claims.email,
          firstName: user.claims.first_name,
        });
      });
    })(req, res, next);
  });

  // ─── Google auth routes (no-op friendly if not configured) ────────────────
  app.get("/api/auth/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ message: "Google login is not configured" });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
      if (!process.env.GOOGLE_CLIENT_ID) return res.redirect("/auth");
      passport.authenticate("google", { failureRedirect: "/auth" })(req, res, next);
    },
    (req, res) => {
      // success → send them into the app
      res.redirect("/");
    }
  );

  // ─── Logout ───────────────────────────────────────────────────────────────
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });
}

// ─── Route guard (same name/signature the app already imports) ──────────────
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated() && (req.user as any)?.claims?.sub) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
