import express from "express";
import OpenAI from "openai";
import { protect } from "../middleware/auth.js";
import Package from "../models/Package.js";
import { personalizePackages } from "../utils/recommendPackages.js";

const router = express.Router();

function findPackageMatches({ message, tripScope }, packages) {
  const query = String(message || "").toLowerCase();
  const scope = tripScope && tripScope !== "all" ? tripScope : "";
  const budgetMatch = query.match(/(?:under|below|less than|budget)\s*(?:inr|rs\.?)?\s*(\d+)/i);
  const maxBudget = budgetMatch ? Number(budgetMatch[1]) : null;
  const stopWords = new Set([
    "a",
    "ai",
    "an",
    "and",
    "below",
    "budget",
    "find",
    "for",
    "guide",
    "in",
    "less",
    "me",
    "package",
    "rs",
    "suggest",
    "than",
    "trip",
    "under"
  ]);
  const words = query.split(/[^a-z0-9]+/).filter((word) => word && !stopWords.has(word));

  return packages.filter((travelPackage) => {
    const haystack = [
      travelPackage.title,
      travelPackage.destination,
      travelPackage.description,
      travelPackage.travelStyle,
      travelPackage.tripScope,
      ...(travelPackage.tags || [])
    ]
      .join(" ")
      .toLowerCase();
    const matchesScope = !scope || travelPackage.tripScope === scope;
    const matchesBudget = maxBudget === null || travelPackage.price <= maxBudget;
    const matchesWords = words.length === 0 || words.some((word) => haystack.includes(word));
    return matchesScope && matchesBudget && matchesWords;
  });
}

function buildLocalTravelAnswer({ message, promptType, tripScope }, packages) {
  const budgetMatch = String(message || "").match(
    /(?:under|below|less than|budget)\s*(?:inr|rs\.?)?\s*(\d+)/i
  );
  const maxBudget = budgetMatch ? Number(budgetMatch[1]) : null;
  const matches = findPackageMatches({ message, tripScope }, packages);

  if (matches.length === 0) {
    return "No match found";
  }

  const top = matches.slice(0, 3);
  const intro =
    promptType === "itinerary"
      ? "Here is a practical itinerary direction:"
      : promptType === "budget"
        ? "Here are the best budget-fit options:"
        : "Here are GoTravels packages that match your request:";
  const lines = top.map(
    (travelPackage) =>
      `${travelPackage.title} in ${travelPackage.destination}: INR ${travelPackage.price}, ${travelPackage.durationDays} days, ${travelPackage.tripScope || "national"} ${travelPackage.travelStyle}.`
  );

  return `${intro} ${lines.join(" ")} ${
    maxBudget ? `I filtered around your INR ${maxBudget} budget.` : "Share a budget or travel month for a sharper answer."
  }`;
}

router.post("/", protect, async (req, res, next) => {
  try {
    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);

    const { message, promptType = "recommendation", tripScope = "all" } = req.body;
    const packages = await Package.find().sort({ rating: -1, price: 1 }).limit(12);
    const personalizedPackages = personalizePackages(req.user, packages).slice(0, 6);
    const packageMatches = findPackageMatches({ message, tripScope }, personalizedPackages);
    const userPreferences = req.user.preferences || {};
    const packageContext = packageMatches
      .map((travelPackage, index) => {
        return `${index + 1}. ${travelPackage.title} | ${travelPackage.destination} | INR ${travelPackage.price} | ${travelPackage.durationDays} days | style: ${travelPackage.travelStyle} | slots: ${travelPackage.availableSlots} | match: ${travelPackage.matchScore} | reasons: ${travelPackage.matchReasons.join(", ")}`;
      })
      .join("\n");

    if (packageMatches.length === 0) {
      return res.json({
        reply: "No match found",
        suggestedPackages: [],
        mode: "local"
      });
    }

    if (!hasOpenRouter && !hasOpenAI) {
      return res.json({
        reply: buildLocalTravelAnswer({ message, promptType, tripScope }, personalizedPackages),
        suggestedPackages: packageMatches.slice(0, 3),
        mode: "local"
      });
    }

    const client = new OpenAI({
      apiKey: hasOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY,
      ...(hasOpenRouter ? { baseURL: "https://openrouter.ai/api/v1" } : {})
    });

    const completion = await client.chat.completions.create({
      model: hasOpenRouter ? process.env.OPENROUTER_MODEL || "openrouter/free" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are GoTravels assistant for a MERN travel booking website.
Use the provided GoTravels package list and the user's preferences as your main source.
When a user asks for trip suggestions, recommend packages from GoTravels first.
Respect the user's requested prompt type: ${promptType}.
Respect the requested trip scope when relevant: ${tripScope}.
Do not invent package names, prices, payment statuses, or availability.
If no listed package fits, answer exactly: No match found
Do not use Markdown formatting. Avoid asterisks, headings, tables, and bullet symbols.
Keep replies concise, friendly, and booking-focused.

User preferences:
- interests: ${(userPreferences.interests || []).join(", ") || "not set"}
- travel style: ${userPreferences.travelStyle || "not set"}
- budget: INR ${userPreferences.budgetMin ?? "not set"} to INR ${userPreferences.budgetMax ?? "not set"}
- preferred destinations: ${(userPreferences.preferredDestinations || []).join(", ") || "not set"}

Available GoTravels packages ranked for this user:
${packageContext || "No packages available."}`
        },
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0]?.message?.content || "I could not answer that.";
    const cleanReply = reply.replace(/\*\*/g, "").replace(/\*/g, "");

    res.json({
      reply: cleanReply,
      suggestedPackages: packageMatches.slice(0, 3)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
