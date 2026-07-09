import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    availableSlots: { type: Number, default: 20 },
    rating: { type: Number, default: 4.5 },
    travelStyle: {
      type: String,
      enum: ["relaxation", "adventure", "culture", "family", "luxury", "budget"],
      required: true
    },
    tripScope: {
      type: String,
      enum: ["national", "international"],
      default: "national"
    },
    tags: [{ type: String, trim: true }],
    highlights: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

export default mongoose.model("Package", packageSchema);

