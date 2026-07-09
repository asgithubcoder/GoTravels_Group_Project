import mongoose from "mongoose";

const supportEnquirySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["open", "in_review", "resolved"],
      default: "open"
    }
  },
  { timestamps: true }
);

export default mongoose.model("SupportEnquiry", supportEnquirySchema);
