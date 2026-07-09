import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package", required: true },
    travelers: { type: Number, required: true, min: 1 },
    travelDate: { type: Date, required: true },
    contactPhone: { type: String, default: "" },
    specialRequests: { type: String, default: "" },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "payment_failed"],
      default: "pending"
    },
    payment: {
      provider: { type: String, default: "sandbox" },
      status: {
        type: String,
        enum: ["unpaid", "pending", "paid", "failed", "refunded"],
        default: "unpaid"
      },
      transactionId: { type: String, default: "" },
      failureReason: { type: String, default: "" },
      paidAt: { type: Date },
      failedAt: { type: Date }
    }
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
