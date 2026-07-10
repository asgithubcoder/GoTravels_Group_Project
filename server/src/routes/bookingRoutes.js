import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Booking from "../models/Booking.js";
import Feedback from "../models/Feedback.js";
import Package from "../models/Package.js";

const router = express.Router();

function todayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function dateOnlyString(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function isInvalidTravelDate(value) {
  const travelDate = dateOnlyString(value);
  return !travelDate || travelDate < todayDateString();
}

function isValidCardExpiry(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!match) return false;

  const month = Number(match[1]);
  const year = match[2].length === 2 ? Number(`20${match[2]}`) : Number(match[2]);
  if (month < 1 || month > 12) return false;

  const expiryEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return expiryEnd >= new Date();
}

async function refreshPackageRating(packageId) {
  const [summary] = await Feedback.aggregate([
    { $match: { package: packageId } },
    {
      $group: {
        _id: "$package",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  await Package.findByIdAndUpdate(packageId, {
    rating: summary ? Number(summary.averageRating.toFixed(1)) : null,
    reviewCount: summary?.reviewCount || 0
  });
}

async function failPayment(booking, message, status = 402) {
  booking.status = "payment_failed";
  booking.payment = {
    provider: "sandbox",
    status: "failed",
    transactionId: `SANDBOX-FAILED-${Date.now()}`,
    failureReason: message,
    failedAt: new Date()
  };
  await booking.save();

  return {
    status,
    body: {
      message,
      booking: await booking.populate("package")
    }
  };
}

router.post("/", protect, async (req, res, next) => {
  try {
    const { contactPhone, packageId, specialRequests, travelers, travelDate } = req.body;
    const travelPackage = await Package.findById(packageId);
    const normalizedTravelDate = dateOnlyString(travelDate);

    if (!travelPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    if (!normalizedTravelDate || isInvalidTravelDate(normalizedTravelDate)) {
      return res.status(400).json({
        message: "Invalid input. Payment unsuccessful. Select today's date or a future travel date."
      });
    }

    if (travelPackage.availableSlots < travelers) {
      return res.status(400).json({ message: "Not enough available slots" });
    }

    const booking = await Booking.create({
      user: req.user._id,
      package: travelPackage._id,
      travelers,
      travelDate: normalizedTravelDate,
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
      .sort({ createdAt: -1 })
      .lean();
    const feedback = await Feedback.find({ booking: { $in: bookings.map((booking) => booking._id) } }).lean();
    const feedbackByBooking = new Map(
      feedback.map((review) => [review.booking.toString(), review])
    );

    res.json(
      bookings.map((booking) => ({
        ...booking,
        feedback: feedbackByBooking.get(booking._id.toString()) || null
      }))
    );
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

    if (isInvalidTravelDate(booking.travelDate)) {
      const failedPayment = await failPayment(booking, "Invalid input. Payment unsuccessful.");
      return res.status(failedPayment.status).json(failedPayment.body);
    }

    if (!cardholderName || !cvv || digitsOnly.length < 12 || !isValidCardExpiry(expiry)) {
      const failedPayment = await failPayment(booking, "Invalid input. Payment unsuccessful.");
      return res.status(failedPayment.status).json(failedPayment.body);
    }

    if (forceFailure || digitsOnly.endsWith("0000")) {
      const failedPayment = await failPayment(
        booking,
        "Payment failed. Try another card or use a sandbox success card."
      );
      return res.status(failedPayment.status).json(failedPayment.body);
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

    if (isInvalidTravelDate(booking.travelDate)) {
      const failedPayment = await failPayment(booking, "Invalid input. Payment unsuccessful.", 400);
      return res.status(failedPayment.status).json(failedPayment.body);
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

    const existingFeedback = await Feedback.findOne({ booking: booking._id });

    if (existingFeedback) {
      return res.status(400).json({
        message: "You already reviewed this completed booking. Book and complete this trip again to add another review."
      });
    }

    const feedback = await Feedback.create({
      user: req.user._id,
      booking: booking._id,
      package: booking.package,
      rating: Number(rating),
      comment
    });

    await refreshPackageRating(booking.package);

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
