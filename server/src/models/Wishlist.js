import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package", required: true }
  },
  { timestamps: true }
);

wishlistSchema.index({ user: 1, package: 1 }, { unique: true });

export default mongoose.model("Wishlist", wishlistSchema);
