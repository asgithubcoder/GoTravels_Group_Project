# GoTravels

GoTravels is a MERN stack travel booking website with personalized package recommendations for each user.

## Features

- User signup and login with JWT
- Admin role for package management
- Travel package listing and details
- Booking system
- My bookings page
- Post-booking customer feedback with comment and 5-star review
- Customer support enquiry form
- Personalized package recommendations based on budget, interests, travel style, and preferred destinations
- National and international package/custom trip customization
- Sandbox payment validation with successful and failed payment states, plus optional Stripe Checkout
- Optional AI chatbot route that can use OpenRouter free models, OpenAI, or a local package-aware fallback

## Project Structure

```text
gotravels/
  client/   React + Vite frontend
  server/   Node.js + Express + MongoDB backend
```

## Setup

1. Install dependencies:

```bash
npm install
npm run install:all
```

2. Create a real server env file:

```bash
copy .env.example server\.env
```

3. Update `server/.env` with your MongoDB Atlas connection string and JWT secret.

4. Start both apps:

```bash
npm run dev
```

Optional: create a demo admin and sample travel packages:

```bash
npm run seed --prefix server
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

## Admin User

Set these values in `server/.env`, then run the seed command:

```env
ADMIN_NAME=GoTravels Admin
ADMIN_EMAIL=admin@gotravels.test
ADMIN_PASSWORD=admin123
```

Then login through the app with that email and password.

## Environment Variables

```env
PORT=5000
MONGODB_URI=
JWT_SECRET=
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
STRIPE_SECRET_KEY=
STRIPE_CURRENCY=inr
CLERK_SECRET_KEY=
VITE_CLERK_PUBLISHABLE_KEY=
```

Do not commit real secrets. Keep real values in `server/.env`.

## Third-party service setup

Stripe is optional. Add `STRIPE_SECRET_KEY` to `server/.env` to enable the Stripe Checkout button. Without it, the app still supports sandbox payment validation. In sandbox mode, a card number ending in `0000` or the "Simulate failed payment" checkbox marks the booking as `payment_failed`; other valid-looking card details confirm the booking.

Clerk is prepared but not fully switched on because this project currently ships with local JWT auth and does not include Clerk SDK packages. To complete a Clerk migration, install `@clerk/clerk-react` in `client` and `@clerk/express` or Clerk's backend SDK in `server`, set `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, then replace the local auth panel with Clerk's sign-in/sign-up components and verify Clerk session tokens in `server/src/middleware/auth.js`.
