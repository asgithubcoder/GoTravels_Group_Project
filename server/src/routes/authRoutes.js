import express from "express";
import jwt from "jsonwebtoken";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

function sendAuth(res, user) {
  res.json({
    token: signToken(user),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      authProvider: user.authProvider,
      clerkUserId: user.clerkUserId,
      preferences: user.preferences
    }
  });
}

async function fetchClerkUser(clerkUserId) {
  const response = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.errors?.[0]?.message || "Could not validate Clerk user";
    const error = new Error(message);
    error.status = 401;
    throw error;
  }

  return data;
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({ name, email, password });
    sendAuth(res, user);
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    sendAuth(res, user);
  } catch (error) {
    next(error);
  }
});

router.get("/me", protect, (req, res) => {
  res.json(req.user);
});

router.post("/clerk-sync", async (req, res, next) => {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      return res.status(503).json({
        message: "Clerk is not configured. Add CLERK_SECRET_KEY and install Clerk SDKs before enabling Clerk auth."
      });
    }

    const { clerkUserId, email, name } = req.body;

    if (!clerkUserId || !email) {
      return res.status(400).json({ message: "Clerk user id and email are required" });
    }

    const clerkUser = await fetchClerkUser(clerkUserId);
    const clerkEmails = (clerkUser.email_addresses || []).map((item) => item.email_address);

    if (!clerkEmails.includes(email)) {
      return res.status(401).json({ message: "Clerk email validation failed" });
    }

    const user = await User.findOneAndUpdate(
      { $or: [{ clerkUserId }, { email }] },
      {
        clerkUserId,
        email,
        name: name || email.split("@")[0],
        authProvider: "clerk"
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    sendAuth(res, user);
  } catch (error) {
    next(error);
  }
});

router.put("/preferences", protect, async (req, res, next) => {
  try {
    const { interests, travelStyle, budgetMin, budgetMax, preferredDestinations } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        preferences: {
          interests,
          travelStyle,
          budgetMin,
          budgetMax,
          preferredDestinations
        }
      },
      { new: true, runValidators: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
