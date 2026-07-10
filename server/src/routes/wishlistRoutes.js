import express from "express";
import { protect } from "../middleware/auth.js";
import Package from "../models/Package.js";
import Wishlist from "../models/Wishlist.js";

const router = express.Router();

router.get("/", protect, async (req, res, next) => {
  try {
    const savedTrips = await Wishlist.find({ user: req.user._id })
      .populate("package")
      .sort({ createdAt: -1 });

    res.json(
      savedTrips
        .filter((item) => item.package)
        .map((item) => ({
          _id: item._id,
          savedAt: item.createdAt,
          package: item.package
        }))
    );
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    const { packageId } = req.body;
    const travelPackage = await Package.findById(packageId);

    if (!travelPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    const savedTrip = await Wishlist.findOneAndUpdate(
      { user: req.user._id, package: travelPackage._id },
      { user: req.user._id, package: travelPackage._id },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    ).populate("package");

    res.status(201).json({
      _id: savedTrip._id,
      savedAt: savedTrip.createdAt,
      package: savedTrip.package
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:packageId", protect, async (req, res, next) => {
  try {
    await Wishlist.findOneAndDelete({
      user: req.user._id,
      package: req.params.packageId
    });

    res.json({ message: "Trip removed from wishlist" });
  } catch (error) {
    next(error);
  }
});

export default router;
