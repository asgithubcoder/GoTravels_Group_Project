import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Booking from "../models/Booking.js";
import Feedback from "../models/Feedback.js";
import Package from "../models/Package.js";

const router = express.Router();

router.post("/", protect, async (req, res, next) => {
  try {
    const { contactPhone, packageId, specialRequests, travelers, travelDate } = req.body;
    const travelPackage = await Package.findById(packageId);

    if (!travelPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    if (travelPackage.availableSlots < travelers) {
      return res.status(400).json({ message: "Not enough available slots" });
    }

    const booking = await Booking.create({
      user: req.user._id,
      package: travelPackage._id,
      travelers,
      travelDate,
      contactPhone,
      specialRequests,
      totalAmount: travelPackage.price * travelers
    });

    travelPackage.availableSlots -= travelers;
    await travelPackage.save();

    res.status(201).json(await booking.populate("package"));
  } catch (error) {
    next(error);
  }
});

router.get("/my", protect, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("package")
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/cancel", protect, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const isOwner = booking.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "You cannot cancel this booking" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking is already cancelled" });
    }

    const travelPackage = await Package.findById(booking.package);
    if (travelPackage) {
      travelPackage.availableSlots += booking.travelers;
      await travelPackage.save();
    }

    booking.status = "cancelled";
    await booking.save();

    res.json(await booking.populate("package"));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/mock-payment", protect, async (req, res, next) => {
  try {
    const { cardNumber, cardholderName, cvv, expiry, forceFailure } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot pay for this booking" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled bookings cannot be paid" });
    }

    if (booking.status === "confirmed") {
      return res.status(400).json({ message: "Booking is already confirmed" });
    }

    const digitsOnly = String(cardNumber || "").replace(/\D/g, "");

    if (!cardholderName || !expiry || !cvv || digitsOnly.length < 12) {
      return res.status(400).json({ message: "Enter valid sandbox payment details" });
    }

    if (forceFailure || digitsOnly.endsWith("0000")) {
      booking.status = "payment_failed";
      booking.payment = {
        provider: "sandbox",
        status: "failed",
        transactionId: `SANDBOX-FAILED-${Date.now()}`,
        failureReason: "Sandbox card was declined",
        failedAt: new Date()
      };
      await booking.save();

      return res.status(402).json({
        message: "Payment failed. Try another card or use a sandbox success card.",
        booking: await booking.populate("package")
      });
    }

    booking.status = "confirmed";
    booking.payment = {
      provider: "sandbox",
      status: "paid",
      transactionId: `SANDBOX-${Date.now()}`,
      paidAt: new Date()
    };
    await booking.save();

    res.json(await booking.populate("package"));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/stripe-checkout", protect, async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        message: "Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env or use sandbox payment."
      });
    }

    const booking = await Booking.findById(req.params.id).populate("package");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot pay for this booking" });
    }

    const successUrl =
      req.body.successUrl ||
      `${process.env.CLIENT_URL || "http://localhost:5173"}?payment=success&booking=${booking._id}`;
    const cancelUrl =
      req.body.cancelUrl ||
      `${process.env.CLIENT_URL || "http://localhost:5173"}?payment=cancelled&booking=${booking._id}`;

    const params = new URLSearchParams({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: booking._id.toString(),
      "metadata[bookingId]": booking._id.toString(),
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": process.env.STRIPE_CURRENCY || "inr",
      "line_items[0][price_data][unit_amount]": String(Math.round(booking.totalAmount * 100)),
      "line_items[0][price_data][product_data][name]": booking.package?.title || "GoTravels booking"
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return res.status(502).json({ message: session.error?.message || "Stripe checkout failed" });
    }

    booking.payment = {
      provider: "stripe",
      status: "pending",
      transactionId: session.id
    };
    await booking.save();

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/stripe-verify", protect, async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ message: "Stripe is not configured." });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot verify this booking" });
    }

    const sessionId = req.body.sessionId || booking.payment?.transactionId;
    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return res.status(502).json({ message: session.error?.message || "Stripe verification failed" });
    }

    if (session.payment_status === "paid") {
      booking.status = "confirmed";
      booking.payment.status = "paid";
      booking.payment.paidAt = new Date();
      await booking.save();
      return res.json(await booking.populate("package"));
    }

    booking.status = "payment_failed";
    booking.payment.status = "failed";
    booking.payment.failureReason = `Stripe payment status: ${session.payment_status}`;
    booking.payment.failedAt = new Date();
    await booking.save();

    res.status(402).json({ message: "Stripe payment is not paid yet.", booking: await booking.populate("package") });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/feedback", protect, async (req, res, next) => {
  try {
    const { comment, rating } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot review this booking" });
    }

    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Feedback is available after booking is completed." });
    }

    const feedback = await Feedback.findOneAndUpdate(
      { booking: booking._id },
      {
        user: req.user._id,
        booking: booking._id,
        package: booking.package,
        rating: Number(rating),
        comment
      },
      { new: true, runValidators: true, upsert: true }
    );

    res.status(201).json(feedback);
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, adminOnly, async (_req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("package")
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

export default router;
