import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Package from "./models/Package.js";
import User from "./models/User.js";

dotenv.config();

const samplePackages = [
  {
    title: "Goa Beach Escape",
    destination: "Goa",
    description: "A relaxing coastal package with beaches, cafes, sunsets, and water activities.",
    imageUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80",
    price: 18000,
    durationDays: 4,
    availableSlots: 28,
    rating: 4.7,
    reviewCount: 7,
    travelStyle: "relaxation",
    tripScope: "national",
    tags: ["beach", "food", "relaxation", "nightlife"],
    highlights: ["Beach resort", "Water sports", "Sunset cruise"]
  },
  {
    title: "Manali Adventure Trail",
    destination: "Manali",
    description: "A mountain adventure package with trekking, viewpoints, local markets, and bonfire nights.",
    imageUrl: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=900&q=80",
    price: 22000,
    durationDays: 6,
    availableSlots: 18,
    rating: 4.8,
    reviewCount: 9,
    travelStyle: "adventure",
    tripScope: "national",
    tags: ["mountains", "trekking", "adventure", "nature"],
    highlights: ["Guided trek", "Bonfire", "River valley visit"]
  },
  {
    title: "Jaipur Heritage Weekender",
    destination: "Jaipur",
    description: "A culture-first trip through forts, palaces, markets, local food, and royal architecture.",
    imageUrl: "https://images.unsplash.com/photo-1603262110263-fb0112e7cc33?auto=format&fit=crop&w=900&q=80",
    price: 14500,
    durationDays: 3,
    availableSlots: 35,
    rating: 4.6,
    reviewCount: 5,
    travelStyle: "culture",
    tripScope: "national",
    tags: ["culture", "history", "food", "shopping"],
    highlights: ["Amber Fort", "City Palace", "Food walk"]
  },
  {
    title: "Kerala Family Backwaters",
    destination: "Kerala",
    description: "A calm family package with houseboat stays, tea gardens, waterfalls, and nature views.",
    imageUrl: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=80",
    price: 32000,
    durationDays: 5,
    availableSlots: 24,
    rating: 4.9,
    reviewCount: 8,
    travelStyle: "family",
    tripScope: "national",
    tags: ["family", "nature", "backwaters", "relaxation"],
    highlights: ["Houseboat stay", "Tea gardens", "Waterfall visit"]
  },
  {
    title: "Hampi Discovery Starter",
    destination: "Hampi",
    description: "A new culture package for temples, ruins, sunset points, cafes, and guided heritage walks.",
    imageUrl: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=900&q=80",
    price: 12500,
    durationDays: 3,
    availableSlots: 22,
    rating: null,
    reviewCount: 0,
    travelStyle: "culture",
    tripScope: "national",
    tags: ["culture", "history", "temples", "heritage"],
    highlights: ["Virupaksha Temple", "Heritage walk", "Sunset viewpoint"]
  }
];

async function seed() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGODB_URI and JWT_SECRET are required in server/.env");
  }

  await connectDB();

  const adminEmail = process.env.ADMIN_EMAIL || "admin@gotravels.test";
  const adminExists = await User.findOne({ email: adminEmail });

  if (!adminExists) {
    await User.create({
      name: process.env.ADMIN_NAME || "GoTravels Admin",
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || "admin123",
      role: "admin"
    });
    console.log(`Admin created: ${adminEmail}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  const existingTitles = await Package.find({ title: { $in: samplePackages.map((item) => item.title) } }).distinct(
    "title"
  );
  const missingPackages = samplePackages.filter((item) => !existingTitles.includes(item.title));

  if (missingPackages.length > 0) {
    await Package.insertMany(missingPackages);
    console.log(`${missingPackages.length} sample travel package(s) created`);
  } else {
    console.log("Packages already exist, skipping sample data");
  }

  await Promise.all(
    samplePackages
      .filter((item) => typeof item.reviewCount === "number" && item.rating)
      .map((item) =>
        Package.updateOne(
          { title: item.title, $or: [{ reviewCount: { $exists: false } }, { reviewCount: 0 }] },
          { $set: { reviewCount: item.reviewCount } }
        )
      )
  );

  process.exit(0);
}

seed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
