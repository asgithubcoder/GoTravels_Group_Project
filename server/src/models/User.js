import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const preferencesSchema = new mongoose.Schema(
  {
    interests: [{ type: String, trim: true }],
    travelStyle: {
      type: String,
      enum: ["relaxation", "adventure", "culture", "family", "luxury", "budget"],
      default: "culture"
    },
    budgetMin: { type: Number, default: 0 },
    budgetMax: { type: Number, default: 100000 },
    preferredDestinations: [{ type: String, trim: true }]
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    authProvider: { type: String, enum: ["local", "clerk"], default: "local" },
    clerkUserId: { type: String, unique: true, sparse: true },
    preferences: { type: preferencesSchema, default: () => ({}) }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);
