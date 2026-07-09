import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import SupportEnquiry from "../models/SupportEnquiry.js";

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { email, fullName, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({ message: "Full name, email, and message are required" });
    }

    const enquiry = await SupportEnquiry.create({
      fullName,
      email,
      message,
      user: req.user?._id
    });

    res.status(201).json({
      message: "Your enquiry has been submitted. Our support team will contact you soon.",
      enquiry
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, adminOnly, async (_req, res, next) => {
  try {
    const enquiries = await SupportEnquiry.find().populate("user", "name email").sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (error) {
    next(error);
  }
});

export default router;
