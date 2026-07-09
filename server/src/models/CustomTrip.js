import mongoose from "mongoose";

const customTripSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    destination: { type: String, required: true, trim: true },
    tripScope: {
      type: String,
      enum: ["national", "international"],
      default: "national"
    },
    departureCity: { type: String, required: true, trim: true },
    travelDate: { type: Date, required: true },
    durationDays: { type: Number, required: true, min: 1 },
    durationNights: { type: Number, required: true, min: 0 },
    travelers: {
      adults: { type: Number, default: 1, min: 0 },
      children: { type: Number, default: 0, min: 0 },
      seniors: { type: Number, default: 0, min: 0 }
    },
    budgetMin: { type: Number, required: true, min: 0 },
    budgetMax: { type: Number, required: true, min: 0 },
    travelStyle: {
      type: String,
      enum: ["luxury", "budget", "family", "adventure", "solo", "honeymoon"],
      required: true
    },
    hotelCategory: {
      type: String,
      enum: ["3-star", "4-star", "5-star", "homestay", "resort"],
      required: true
    },
    roomPreference: { type: String, required: true, trim: true },
    mealPlan: {
      type: String,
      enum: ["breakfast", "half-board", "full-board"],
      required: true
    },
    attractions: [{ type: String, trim: true }],
    adventureActivities: [{ type: String, trim: true }],
    sightseeingTours: [{ type: String, trim: true }],
    culturalExperiences: [{ type: String, trim: true }],
    specialRequests: { type: String, default: "" },
    status: {
      type: String,
      enum: ["planning", "quoted", "confirmed", "cancelled"],
      default: "planning"
    }
  },
  { timestamps: true }
);

export default mongoose.model("CustomTrip", customTripSchema);
