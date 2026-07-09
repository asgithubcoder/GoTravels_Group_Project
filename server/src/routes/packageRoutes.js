import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Package from "../models/Package.js";
import { personalizePackages } from "../utils/recommendPackages.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { search, style, maxPrice, scope } = req.query;
    const filter = {};

    if (style) filter.travelStyle = style;
    if (scope && scope !== "all") filter.tripScope = scope;
    if (maxPrice) filter.price = { $lte: Number(maxPrice) };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { destination: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    const packages = await Package.find(filter).sort({ createdAt: -1 });
    res.json(packages);
  } catch (error) {
    next(error);
  }
});

router.get("/recommended", protect, async (req, res, next) => {
  try {
    const packages = await Package.find();
    res.json(personalizePackages(req.user, packages));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const travelPackage = await Package.findById(req.params.id);

    if (!travelPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.json(travelPackage);
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const travelPackage = await Package.create(req.body);
    res.status(201).json(travelPackage);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const travelPackage = await Package.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!travelPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.json(travelPackage);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const travelPackage = await Package.findByIdAndDelete(req.params.id);

    if (!travelPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.json({ message: "Package deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;

