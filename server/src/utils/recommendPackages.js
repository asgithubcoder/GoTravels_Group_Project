function normalizeList(items = []) {
  return items.map((item) => item.toLowerCase().trim()).filter(Boolean);
}

export function scorePackageForUser(user, travelPackage) {
  const preferences = user.preferences || {};
  const interests = normalizeList(preferences.interests);
  const preferredDestinations = normalizeList(preferences.preferredDestinations);
  const packageTags = normalizeList(travelPackage.tags);
  const destination = travelPackage.destination.toLowerCase();

  let score = 0;
  const reasons = [];

  if (travelPackage.price >= preferences.budgetMin && travelPackage.price <= preferences.budgetMax) {
    score += 35;
    reasons.push("fits your budget");
  }

  if (travelPackage.travelStyle === preferences.travelStyle) {
    score += 25;
    reasons.push(`matches your ${preferences.travelStyle} travel style`);
  }

  const matchedInterests = interests.filter((interest) => packageTags.includes(interest));
  if (matchedInterests.length > 0) {
    score += matchedInterests.length * 12;
    reasons.push(`matches interests: ${matchedInterests.join(", ")}`);
  }

  const destinationMatch = preferredDestinations.find((place) => destination.includes(place));
  if (destinationMatch) {
    score += 20;
    reasons.push(`close to your preferred destination: ${destinationMatch}`);
  }

  return {
    score: reasons.length > 0 ? score + Math.min(10, Math.round(travelPackage.rating || 0)) : 0,
    reasons
  };
}

export function personalizePackages(user, packages) {
  return packages
    .map((travelPackage) => {
      const match = scorePackageForUser(user, travelPackage);
      return {
        ...travelPackage.toObject(),
        matchScore: match.score,
        matchReasons: match.reasons
      };
    })
    .filter((travelPackage) => travelPackage.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

