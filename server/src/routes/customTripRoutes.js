import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import CustomTrip from "../models/CustomTrip.js";

const router = express.Router();

router.post("/", protect, async (req, res, next) => {
  try {
    const trip = await CustomTrip.create({
      ...req.body,
      user: req.user._id
    });

    res.status(201).json(trip);
  } catch (error) {
    next(error);
  }
});

router.get("/my", protect, async (req, res, next) => {
  try {
    const trips = await CustomTrip.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(trips);
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, adminOnly, async (_req, res, next) => {
  try {
    const trips = await CustomTrip.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(trips);
  } catch (error) {
    next(error);
  }
});

export default router;
