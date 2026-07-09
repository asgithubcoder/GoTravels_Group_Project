import {
  SignIn,
  SignUp,
  UserButton,
  useClerk,
  useUser
} from "@clerk/react";
import {
  BadgeCheck,
  Ban,
  Bot,
  CalendarDays,
  Clock3,
  Compass,
  CreditCard,
  Globe2,
  Home,
  Headphones,
  LayoutDashboard,
  LogOut,
  MapPin,
  Mountain,
  Plane,
  Plus,
  Route,
  Search,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api";

const emptyPackage = {
  title: "",
  destination: "",
  description: "",
  imageUrl: "",
  price: 12000,
  durationDays: 5,
  availableSlots: 20,
  rating: 4.5,
  travelStyle: "culture",
  tripScope: "national",
  tags: "culture, food, sightseeing",
  highlights: "Guided tours, Hotel stay, Breakfast"
};

const defaultPreferences = {
  interests: "culture, food",
  travelStyle: "culture",
  budgetMin: 5000,
  budgetMax: 50000,
  preferredDestinations: "goa, manali, jaipur"
};

const defaultCustomTrip = {
  destination: "",
  tripScope: "national",
  departureCity: "",
  travelDate: "",
  durationDays: 4,
  durationNights: 3,
  adults: 2,
  children: 0,
  seniors: 0,
  budgetMin: 10000,
  budgetMax: 50000,
  travelStyle: "family",
  hotelCategory: "4-star",
  roomPreference: "Double room",
  mealPlan: "breakfast",
  attractions: [],
  adventureActivities: [],
  sightseeingTours: [],
  culturalExperiences: [],
  specialRequests: ""
};

const plannerChoices = {
  attractions: ["Beaches", "Hill stations", "Museums", "Temples", "Markets", "Wildlife"],
  adventureActivities: ["Trekking", "Rafting", "Scuba diving", "Paragliding", "Camping"],
  sightseeingTours: ["City tour", "Heritage walk", "Food tour", "Sunset cruise", "Nature trail"],
  culturalExperiences: ["Local food", "Folk dance", "Art workshop", "Festival visit", "Village tour"]
};

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "packages", label: "Packages", icon: Compass },
  { id: "planner", label: "Trip Planner", icon: Route },
  { id: "recommended", label: "For You", icon: Sparkles },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "assistant", label: "AI Guide", icon: Bot },
  { id: "support", label: "Support", icon: Headphones }
];

const fallbackImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80"
];

function preferenceFormFromUser(user) {
  const preferences = user?.preferences;

  if (!preferences) return defaultPreferences;

  return {
    interests: preferences.interests?.join(", ") || defaultPreferences.interests,
    travelStyle: preferences.travelStyle || defaultPreferences.travelStyle,
    budgetMin: preferences.budgetMin ?? defaultPreferences.budgetMin,
    budgetMax: preferences.budgetMax ?? defaultPreferences.budgetMax,
    preferredDestinations:
      preferences.preferredDestinations?.join(", ") || defaultPreferences.preferredDestinations
  };
}

function App() {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [token, setToken] = useState(localStorage.getItem("gotravels_token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("gotravels_user") || "null"));
  const [activePage, setActivePage] = useState("home");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [packages, setPackages] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [customTrips, setCustomTrips] = useState([]);
  const [customTripForm, setCustomTripForm] = useState(defaultCustomTrip);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [pendingPaymentBooking, setPendingPaymentBooking] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageForm, setPackageForm] = useState(emptyPackage);
  const [preferences, setPreferences] = useState(() => preferenceFormFromUser(user));
  const [bookingForm, setBookingForm] = useState({
    travelers: 1,
    travelDate: "",
    contactPhone: "",
    specialRequests: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: "",
    cardholderName: "",
    expiry: "",
    cvv: "",
    forceFailure: false
  });
  const [chatMessage, setChatMessage] = useState("");
  const [chatPromptType, setChatPromptType] = useState("recommendation");
  const [chatTripScope, setChatTripScope] = useState("all");
  const [chatReply, setChatReply] = useState("");
  const [chatPackages, setChatPackages] = useState([]);
  const [supportForm, setSupportForm] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    message: ""
  });
  const [feedbackForms, setFeedbackForms] = useState({});
  const [status, setStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [styleFilter, setStyleFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [paymentResult, setPaymentResult] = useState(null);

  const isAdmin = user?.role === "admin";

  const displayPackages = token && recommended.length > 0 ? recommended : packages;
  const filteredPackages = displayPackages.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesTerm =
      item.title.toLowerCase().includes(term) ||
      item.destination.toLowerCase().includes(term) ||
      item.travelStyle.toLowerCase().includes(term);
    const matchesStyle = styleFilter === "all" || item.travelStyle === styleFilter;
    const matchesScope = scopeFilter === "all" || item.tripScope === scopeFilter;
    return matchesTerm && matchesStyle && matchesScope;
  });
  const heroPackage = displayPackages[0] || packages[0];
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed");
  const totalSpent = confirmedBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

  const heroImage = useMemo(
    () =>
      "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1800&q=85",
    []
  );

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !clerkUser) return;
    if (user?.clerkUserId === clerkUser.id && token) return;

    const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
    if (!primaryEmail) {
      setStatus("Your Clerk account needs a primary email before GoTravels can sign you in.");
      return;
    }

    async function syncClerkUser() {
      try {
        const data = await apiRequest("/auth/clerk-sync", {
          method: "POST",
          body: JSON.stringify({
            clerkUserId: clerkUser.id,
            email: primaryEmail,
            name: clerkUser.fullName || clerkUser.username || primaryEmail.split("@")[0]
          })
        });
        saveAuth(data);
        if (activePage === "auth") {
          setActivePage("home");
        }
      } catch (error) {
        setStatus(error.message);
      }
    }

    syncClerkUser();
  }, [activePage, clerkLoaded, clerkUser, isSignedIn, token, user?.clerkUserId]);

  useEffect(() => {
    if (!token) return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const bookingId = params.get("booking");
    const sessionId = params.get("session_id");

    if (!payment || !bookingId) return;

    async function handleStripeReturn() {
      if (payment === "success") {
        setPaymentResult({ status: "checking", bookingId });
        setActivePage("payment-success");
        try {
          const booking = await apiRequest(
            `/bookings/${bookingId}/stripe-verify`,
            {
              method: "POST",
              body: JSON.stringify({ sessionId })
            },
            token
          );
          setPaymentResult({ status: "confirmed", booking });
          await loadBookings();
        } catch (error) {
          setPaymentResult({ status: "failed", message: error.message });
        }
      } else {
        setPaymentResult({
          status: "cancelled",
          message: "Stripe checkout was cancelled before payment was completed."
        });
        setActivePage("payment-success");
      }

      window.history.replaceState({}, "", window.location.pathname);
    }

    handleStripeReturn();
  }, [token]);

  useEffect(() => {
    setPreferences(preferenceFormFromUser(user));
    setSupportForm((current) => ({
      ...current,
      fullName: current.fullName || user?.name || "",
      email: current.email || user?.email || ""
    }));
    if (token) {
      loadRecommended();
      loadBookings();
      loadCustomTrips();
    }
  }, [token, user?._id]);

  async function loadPackages() {
    const data = await apiRequest("/packages");
    setPackages(data);
  }

  async function loadRecommended() {
    try {
      setRecommended(await apiRequest("/packages/recommended", {}, token));
    } catch (_error) {
      setRecommended([]);
    }
  }

  async function loadBookings() {
    try {
      setBookings(await apiRequest("/bookings/my", {}, token));
    } catch (_error) {
      setBookings([]);
    }
  }

  async function loadCustomTrips() {
    try {
      setCustomTrips(await apiRequest("/custom-trips/my", {}, token));
    } catch (_error) {
      setCustomTrips([]);
    }
  }

  function saveAuth(data) {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("gotravels_token", data.token);
    localStorage.setItem("gotravels_user", JSON.stringify(data.user));
  }

  async function handleAuth(event) {
    event.preventDefault();
    setStatus("");
    try {
      const path = authMode === "login" ? "/auth/login" : "/auth/register";
      const data = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(authForm)
      });
      saveAuth(data);
      setActivePage("recommended");
      setStatus(`Welcome, ${data.user.name}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function logout() {
    if (isSignedIn) {
      await clerkSignOut();
    }
    setToken(null);
    setUser(null);
    setRecommended([]);
    setBookings([]);
    setActivePage("home");
    localStorage.removeItem("gotravels_token");
    localStorage.removeItem("gotravels_user");
  }

  async function savePreferences(event) {
    event.preventDefault();
    setStatus("");
    try {
      const updatedUser = await apiRequest(
        "/auth/preferences",
        {
          method: "PUT",
          body: JSON.stringify({
            ...preferences,
            interests: preferences.interests.split(",").map((item) => item.trim()),
            preferredDestinations: preferences.preferredDestinations
              .split(",")
              .map((item) => item.trim()),
            budgetMin: Number(preferences.budgetMin),
            budgetMax: Number(preferences.budgetMax)
          })
        },
        token
      );
      setUser(updatedUser);
      localStorage.setItem("gotravels_user", JSON.stringify(updatedUser));
      await loadRecommended();
      setActivePage("recommended");
      setStatus("Preferences saved. Your package list is now personalized.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function createPackage(event) {
    event.preventDefault();
    setStatus("");
    try {
      const payload = {
        ...packageForm,
        price: Number(packageForm.price),
        durationDays: Number(packageForm.durationDays),
        availableSlots: Number(packageForm.availableSlots),
        rating: Number(packageForm.rating),
        tripScope: packageForm.tripScope,
        tags: packageForm.tags.split(",").map((item) => item.trim()),
        highlights: packageForm.highlights.split(",").map((item) => item.trim())
      };

      await apiRequest(
        editingPackage ? `/packages/${editingPackage._id}` : "/packages",
        {
          method: editingPackage ? "PUT" : "POST",
          body: JSON.stringify(payload)
        },
        token
      );
      setPackageForm(emptyPackage);
      setEditingPackage(null);
      await loadPackages();
      await loadRecommended();
      setActivePage(editingPackage ? "admin" : "packages");
      setStatus(editingPackage ? "Package updated." : "Package created.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  function startEditPackage(travelPackage) {
    setEditingPackage(travelPackage);
    setPackageForm({
      title: travelPackage.title || "",
      destination: travelPackage.destination || "",
      description: travelPackage.description || "",
      imageUrl: travelPackage.imageUrl || "",
      price: travelPackage.price || 0,
      durationDays: travelPackage.durationDays || 1,
      availableSlots: travelPackage.availableSlots || 0,
      rating: travelPackage.rating || 4.5,
      travelStyle: travelPackage.travelStyle || "culture",
      tripScope: travelPackage.tripScope || "national",
      tags: travelPackage.tags?.join(", ") || "",
      highlights: travelPackage.highlights?.join(", ") || ""
    });
    setActivePage("admin");
  }

  function cancelPackageEdit() {
    setEditingPackage(null);
    setPackageForm(emptyPackage);
  }

  async function deletePackage(packageId) {
    setStatus("");
    try {
      await apiRequest(`/packages/${packageId}`, { method: "DELETE" }, token);
      await loadPackages();
      await loadRecommended();
      setStatus("Package deleted.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function bookPackage(event) {
    event.preventDefault();
    setStatus("");
    try {
      const booking = await apiRequest(
        "/bookings",
        {
          method: "POST",
          body: JSON.stringify({
            packageId: selectedPackage._id,
            travelers: Number(bookingForm.travelers),
            travelDate: bookingForm.travelDate,
            contactPhone: bookingForm.contactPhone,
            specialRequests: bookingForm.specialRequests
          })
        },
        token
      );
      setSelectedPackage(null);
      await loadBookings();
      await loadPackages();
      await loadRecommended();
      await startStripePayment(booking);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function completeMockPayment(event) {
    event.preventDefault();
    setStatus("");
    try {
      await apiRequest(
        `/bookings/${pendingPaymentBooking._id}/mock-payment`,
        {
          method: "POST",
          body: JSON.stringify(paymentForm)
        },
        token
      );
      setPendingPaymentBooking(null);
      await loadBookings();
      await loadPackages();
      await loadRecommended();
      setActivePage("bookings");
      setStatus("Payment successful. Booking confirmed.");
    } catch (error) {
      await loadBookings();
      await loadPackages();
      await loadRecommended();
      setActivePage("bookings");
      setPendingPaymentBooking(null);
      setStatus(error.message);
    }
  }

  async function startStripePayment(booking = pendingPaymentBooking) {
    setStatus("");
    try {
      if (!booking?._id) {
        throw new Error("Booking not found for Stripe payment.");
      }

      const returnBaseUrl = `${window.location.origin}${window.location.pathname}`;
      const data = await apiRequest(
        `/bookings/${booking._id}/stripe-checkout`,
        {
          method: "POST",
          body: JSON.stringify({
            successUrl: `${returnBaseUrl}?payment=success&booking=${booking._id}&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${returnBaseUrl}?payment=cancelled&booking=${booking._id}`
          })
        },
        token
      );

      window.location.href = data.checkoutUrl;
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function askChatbot(event) {
    event.preventDefault();
    setChatReply("");
    setChatPackages([]);
    try {
      const data = await apiRequest(
        "/chatbot",
        {
          method: "POST",
          body: JSON.stringify({
            message: chatMessage,
            promptType: chatPromptType,
            tripScope: chatTripScope
          })
        },
        token
      );
      setChatReply(data.reply);
      setChatPackages(data.suggestedPackages || []);
    } catch (error) {
      setChatReply(error.message);
      setChatPackages([]);
    }
  }

  async function cancelBooking(bookingId) {
    setStatus("");
    try {
      await apiRequest(`/bookings/${bookingId}/cancel`, { method: "PUT" }, token);
      await loadBookings();
      await loadPackages();
      await loadRecommended();
      setStatus("Booking cancelled.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function submitFeedback(event, bookingId) {
    event.preventDefault();
    setStatus("");
    try {
      const form = feedbackForms[bookingId] || { rating: 5, comment: "" };
      await apiRequest(
        `/bookings/${bookingId}/feedback`,
        {
          method: "POST",
          body: JSON.stringify(form)
        },
        token
      );
      setFeedbackForms({ ...feedbackForms, [bookingId]: { rating: 5, comment: "" } });
      setStatus("Thanks for the feedback. Your review has been submitted.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function submitSupportEnquiry(event) {
    event.preventDefault();
    setStatus("");
    try {
      const data = await apiRequest("/support", {
        method: "POST",
        body: JSON.stringify(supportForm)
      });
      setSupportForm({ fullName: user?.name || "", email: user?.email || "", message: "" });
      setStatus(data.message);
    } catch (error) {
      setStatus(error.message);
    }
  }

  function togglePlannerChoice(field, value) {
    const current = customTripForm[field];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    setCustomTripForm({ ...customTripForm, [field]: next });
  }

  async function submitCustomTrip(event) {
    event.preventDefault();
    setStatus("");
    try {
      await apiRequest(
        "/custom-trips",
        {
          method: "POST",
          body: JSON.stringify({
            destination: customTripForm.destination,
            tripScope: customTripForm.tripScope,
            departureCity: customTripForm.departureCity,
            travelDate: customTripForm.travelDate,
            durationDays: Number(customTripForm.durationDays),
            durationNights: Number(customTripForm.durationNights),
            travelers: {
              adults: Number(customTripForm.adults),
              children: Number(customTripForm.children),
              seniors: Number(customTripForm.seniors)
            },
            budgetMin: Number(customTripForm.budgetMin),
            budgetMax: Number(customTripForm.budgetMax),
            travelStyle: customTripForm.travelStyle,
            hotelCategory: customTripForm.hotelCategory,
            roomPreference: customTripForm.roomPreference,
            mealPlan: customTripForm.mealPlan,
            attractions: customTripForm.attractions,
            adventureActivities: customTripForm.adventureActivities,
            sightseeingTours: customTripForm.sightseeingTours,
            culturalExperiences: customTripForm.culturalExperiences,
            specialRequests: customTripForm.specialRequests
          })
        },
        token
      );
      setCustomTripForm(defaultCustomTrip);
      await loadCustomTrips();
      setStatus("Custom trip plan submitted. Our team can prepare a quote from this request.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  function pageNeedsLogin(page) {
    return !user && ["recommended", "bookings", "assistant", "planner"].includes(page);
  }

  function renderPage() {
    if (activePage === "auth") {
      return (
        <section className="pageShell authPage">
          <ClerkAuthPage
            authMode={authMode}
            setAuthMode={setAuthMode}
          />
        </section>
      );
    }

    if (pageNeedsLogin(activePage)) {
      return (
        <section className="pageShell authPage">
          <ClerkAuthPage
            authMode={authMode}
            setAuthMode={setAuthMode}
          />
        </section>
      );
    }

    if (activePage === "payment-success") {
      return <PaymentSuccessPage paymentResult={paymentResult} setActivePage={setActivePage} />;
    }

    if (activePage === "packages") {
      return (
        <PackagesPage
          filteredPackages={filteredPackages}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          setSelectedPackage={setSelectedPackage}
          setStyleFilter={setStyleFilter}
          setScopeFilter={setScopeFilter}
          scopeFilter={scopeFilter}
          styleFilter={styleFilter}
        />
      );
    }

    if (activePage === "recommended") {
      return (
        <RecommendedPage
          packages={recommended}
          preferences={preferences}
          savePreferences={savePreferences}
          setPreferences={setPreferences}
          setSelectedPackage={setSelectedPackage}
        />
      );
    }

    if (activePage === "planner") {
      return (
        <TripPlannerPage
          customTripForm={customTripForm}
          customTrips={customTrips}
          plannerChoices={plannerChoices}
          setCustomTripForm={setCustomTripForm}
          submitCustomTrip={submitCustomTrip}
          togglePlannerChoice={togglePlannerChoice}
        />
      );
    }

    if (activePage === "bookings") {
      return (
        <BookingsPage
          bookings={bookings}
          cancelBooking={cancelBooking}
          feedbackForms={feedbackForms}
          setFeedbackForms={setFeedbackForms}
          submitFeedback={submitFeedback}
          totalBookings={totalBookings}
          totalSpent={totalSpent}
        />
      );
    }

    if (activePage === "assistant") {
      return (
        <AssistantPage
          askChatbot={askChatbot}
          chatMessage={chatMessage}
          chatPackages={chatPackages}
          chatPromptType={chatPromptType}
          chatReply={chatReply}
          chatTripScope={chatTripScope}
          setChatMessage={setChatMessage}
          setChatPromptType={setChatPromptType}
          setChatTripScope={setChatTripScope}
          setSelectedPackage={setSelectedPackage}
        />
      );
    }

    if (activePage === "support") {
      return (
        <SupportPage
          setSupportForm={setSupportForm}
          submitSupportEnquiry={submitSupportEnquiry}
          supportForm={supportForm}
        />
      );
    }

    if (activePage === "admin" && isAdmin) {
      return (
        <AdminPage
          cancelPackageEdit={cancelPackageEdit}
          createPackage={createPackage}
          deletePackage={deletePackage}
          editingPackage={editingPackage}
          packageForm={packageForm}
          packages={packages}
          setPackageForm={setPackageForm}
          startEditPackage={startEditPackage}
        />
      );
    }

    return (
      <HomePage
        displayPackages={displayPackages}
        heroImage={heroImage}
        heroPackage={heroPackage}
        packages={packages}
        setActivePage={setActivePage}
        setSelectedPackage={setSelectedPackage}
        user={user}
      />
    );
  }

  return (
    <main className="app">
      <Navbar
        activePage={activePage}
        isAdmin={isAdmin}
        logout={logout}
        navItems={navItems}
        setAuthMode={setAuthMode}
        setActivePage={setActivePage}
        showClerkUser={isSignedIn}
        user={user}
      />
      {status ? <div className="toast">{status}</div> : null}
      {renderPage()}
      <Footer setActivePage={setActivePage} />
      {selectedPackage ? (
        <BookingModal
          bookingForm={bookingForm}
          bookPackage={bookPackage}
          selectedPackage={selectedPackage}
          setBookingForm={setBookingForm}
          setSelectedPackage={setSelectedPackage}
          user={user}
        />
      ) : null}
      {pendingPaymentBooking ? (
        <PaymentModal
          completeMockPayment={completeMockPayment}
          paymentForm={paymentForm}
          pendingPaymentBooking={pendingPaymentBooking}
          startStripePayment={startStripePayment}
          setPaymentForm={setPaymentForm}
          setPendingPaymentBooking={setPendingPaymentBooking}
        />
      ) : null}
    </main>
  );
}

function Navbar({
  activePage,
  isAdmin,
  logout,
  navItems,
  setActivePage,
  setAuthMode,
  showClerkUser,
  user
}) {
  return (
    <header className="navWrap">
      <nav className="navbar">
        <button className="brandButton" onClick={() => setActivePage("home")}>
          <span className="brandMark">
            <Plane size={20} />
          </span>
          <span>GoTravels</span>
        </button>

        <div className="navLinks">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activePage === item.id ? "navLink active" : "navLink"}
                key={item.id}
                onClick={() => setActivePage(item.id)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
          {isAdmin ? (
            <button
              className={activePage === "admin" ? "navLink active" : "navLink"}
              onClick={() => setActivePage("admin")}
            >
              <LayoutDashboard size={16} />
              Admin
            </button>
          ) : null}
        </div>

        <div className="navActions">
          {user ? (
            <>
              <span className="userPill">
                <UserRound size={16} />
                {user.name}
              </span>
              <button className="iconButton" onClick={logout} title="Logout">
                <LogOut size={17} />
              </button>
              {showClerkUser ? <UserButton afterSignOutUrl="/" /> : null}
            </>
          ) : (
            <button
              className="primaryMini"
              onClick={() => {
                setAuthMode("login");
                setActivePage("auth");
              }}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

function HomePage({ displayPackages, heroImage, heroPackage, setActivePage, setSelectedPackage, user }) {
  const featured = displayPackages.slice(0, 3);

  return (
    <>
      <section className="heroPanel">
        <div className="heroMedia" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="heroOverlay" />
        <div className="heroInner">
          <div className="heroCopy">
            <span className="kicker">
              <Sparkles size={16} />
              Personalized MERN travel booking
            </span>
            <h1>Plan trips that feel made for you.</h1>
            <p>
              GoTravels matches every user with packages based on budget, interests, travel style,
              and destination preferences.
            </p>
            <div className="heroActions">
              <button onClick={() => setActivePage("packages")}>
                <Compass size={18} />
                Explore packages
              </button>
              <button className="secondaryButton" onClick={() => setActivePage("recommended")}>
                <Sparkles size={18} />
                See recommendations
              </button>
            </div>
          </div>

          <div className="heroCard">
            {heroPackage ? (
              <>
                <div className="heroCardTop">
                  <span>Featured match</span>
                  <Star size={18} />
                </div>
                <img src={heroPackage.imageUrl || fallbackImages[0]} alt={heroPackage.title} />
                <h3>{heroPackage.title}</h3>
                <p>{heroPackage.destination}</p>
                <div className="heroMetricRow">
                  <span>INR {heroPackage.price}</span>
                  <span>{heroPackage.durationDays} days</span>
                  <span>{heroPackage.travelStyle}</span>
                </div>
              </>
            ) : (
              <p>No packages yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="featureBand">
        <Feature icon={Shield} title="Secure auth" text="JWT login with user and admin roles." />
        <Feature icon={Route} title="Personalized" text="Recommendation scores for every user." />
        <Feature icon={WalletCards} title="Bookings" text="Create bookings and track status." />
        <Feature icon={Bot} title="AI ready" text="Chatbot route waits for your API key." />
      </section>

      <section className="homeGrid pageShell">
        <div>
          <SectionTitle
            eyebrow="Curated places"
            title="Popular journeys"
            text="A polished preview of packages already stored in MongoDB."
          />
          <div className="compactCards">
            {featured.map((item, index) => (
              <PackageCard
                item={item}
                key={item._id}
                imageFallback={fallbackImages[index % fallbackImages.length]}
                setSelectedPackage={setSelectedPackage}
              />
            ))}
          </div>
        </div>

        {user ? (
          <div className="glassPanel">
            <span className="panelIcon">
              <BadgeCheck size={18} />
            </span>
            <h2>Welcome back, {user.name}</h2>
            <p>
              Your account is ready. Use the For You page to tune preferences, then book the best
              package for your final demo flow.
            </p>
            <button onClick={() => setActivePage("recommended")}>
              <Sparkles size={16} />
              Open For You
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function Feature({ icon: Icon, text, title }) {
  return (
    <article className="feature">
      <span>
        <Icon size={18} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function ClerkAuthPage({ authMode, setAuthMode }) {
  return (
    <section className="clerkAuthShell">
      <div className="authSwitch">
        <button
          className={authMode === "login" ? "active" : ""}
          onClick={() => setAuthMode("login")}
          type="button"
        >
          Sign in
        </button>
        <button
          className={authMode === "register" ? "active" : ""}
          onClick={() => setAuthMode("register")}
          type="button"
        >
          Sign up
        </button>
      </div>
      {authMode === "register" ? (
        <SignUp
          appearance={{ elements: { rootBox: "clerkRootBox", cardBox: "clerkCardBox" } }}
          fallbackRedirectUrl="/"
          signInUrl="/"
        />
      ) : (
        <SignIn
          appearance={{ elements: { rootBox: "clerkRootBox", cardBox: "clerkCardBox" } }}
          fallbackRedirectUrl="/"
          signUpUrl="/"
        />
      )}
    </section>
  );
}

function AuthPanel({ authForm, authMode, handleAuth, setAuthForm, setAuthMode }) {
  return (
    <aside className="authPanel">
      <span className="kicker">
        <Shield size={15} />
        Traveller access
      </span>
      <h2>{authMode === "login" ? "Sign in to GoTravels" : "Create your account"}</h2>
      <form onSubmit={handleAuth} className="formStack">
        {authMode === "register" ? (
          <label>
            Name
            <input
              placeholder="Your name"
              value={authForm.name}
              onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            placeholder="admin@gotravels.test"
            value={authForm.email}
            onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
          />
        </label>
        <label>
          Password
          <input
            placeholder="admin123"
            type="password"
            value={authForm.password}
            onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
          />
        </label>
        <button type="submit">{authMode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button
        className="textButton"
        onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
      >
        {authMode === "login" ? "Need an account?" : "Already registered?"}
      </button>
    </aside>
  );
}

function TripPlannerPage({
  customTripForm,
  customTrips,
  plannerChoices,
  setCustomTripForm,
  submitCustomTrip,
  togglePlannerChoice
}) {
  return (
    <section className="pageShell plannerPage">
      <SectionTitle
        eyebrow="Custom trip builder"
        title="Create your own travel package"
        text="Plan a trip from scratch with your destination, travelers, hotel, meals, activities, and budget."
      />

      <form onSubmit={submitCustomTrip} className="plannerGrid">
        <div className="plannerPanel">
          <span className="kicker">
            <Search size={15} />
            Trip planner inputs
          </span>
          <div className="twoCols">
            <label>
              Destination search
              <input
                placeholder="Goa, Manali, Dubai..."
                value={customTripForm.destination}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, destination: event.target.value })
                }
                required
              />
            </label>
            <label>
              Trip scope
              <select
                value={customTripForm.tripScope}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, tripScope: event.target.value })
                }
              >
                <option value="national">National</option>
                <option value="international">International</option>
              </select>
            </label>
          </div>
          <div className="twoCols">
            <label>
              Departure city
              <input
                placeholder="Delhi, Mumbai, Kolkata..."
                value={customTripForm.departureCity}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, departureCity: event.target.value })
                }
                required
              />
            </label>
          </div>
          <div className="twoCols">
            <label>
              Travel date
              <input
                type="date"
                value={customTripForm.travelDate}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, travelDate: event.target.value })
                }
                required
              />
            </label>
            <label>
              Travel style
              <select
                value={customTripForm.travelStyle}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, travelStyle: event.target.value })
                }
              >
                <option value="luxury">Luxury</option>
                <option value="budget">Budget</option>
                <option value="family">Family</option>
                <option value="adventure">Adventure</option>
                <option value="solo">Solo</option>
                <option value="honeymoon">Honeymoon</option>
              </select>
            </label>
          </div>
          <div className="threeCols">
            <label>
              Adults
              <input
                min="0"
                type="number"
                value={customTripForm.adults}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, adults: event.target.value })
                }
              />
            </label>
            <label>
              Children
              <input
                min="0"
                type="number"
                value={customTripForm.children}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, children: event.target.value })
                }
              />
            </label>
            <label>
              Seniors
              <input
                min="0"
                type="number"
                value={customTripForm.seniors}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, seniors: event.target.value })
                }
              />
            </label>
          </div>
          <div className="twoCols">
            <label>
              Days
              <input
                min="1"
                type="number"
                value={customTripForm.durationDays}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, durationDays: event.target.value })
                }
              />
            </label>
            <label>
              Nights
              <input
                min="0"
                type="number"
                value={customTripForm.durationNights}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, durationNights: event.target.value })
                }
              />
            </label>
          </div>
          <div className="twoCols">
            <label>
              Min budget
              <input
                min="0"
                type="number"
                value={customTripForm.budgetMin}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, budgetMin: event.target.value })
                }
              />
            </label>
            <label>
              Max budget
              <input
                min="0"
                type="number"
                value={customTripForm.budgetMax}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, budgetMax: event.target.value })
                }
              />
            </label>
          </div>
        </div>

        <div className="plannerPanel">
          <span className="kicker">
            <Shield size={15} />
            Accommodation options
          </span>
          <div className="twoCols">
            <label>
              Hotel category
              <select
                value={customTripForm.hotelCategory}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, hotelCategory: event.target.value })
                }
              >
                <option value="3-star">3 star</option>
                <option value="4-star">4 star</option>
                <option value="5-star">5 star</option>
                <option value="homestay">Homestay</option>
                <option value="resort">Resort</option>
              </select>
            </label>
            <label>
              Meal plan
              <select
                value={customTripForm.mealPlan}
                onChange={(event) =>
                  setCustomTripForm({ ...customTripForm, mealPlan: event.target.value })
                }
              >
                <option value="breakfast">Breakfast only</option>
                <option value="half-board">Half-board</option>
                <option value="full-board">Full-board</option>
              </select>
            </label>
          </div>
          <label>
            Room preferences
            <input
              placeholder="Double room, family suite, sea view..."
              value={customTripForm.roomPreference}
              onChange={(event) =>
                setCustomTripForm({ ...customTripForm, roomPreference: event.target.value })
              }
              required
            />
          </label>
        </div>

        <div className="plannerPanel plannerWide">
          <span className="kicker">
            <Mountain size={15} />
            Attractions and activities
          </span>
          <div className="choiceGrid">
            <ChoiceGroup
              choices={plannerChoices.attractions}
              field="attractions"
              form={customTripForm}
              title="Popular attractions"
              togglePlannerChoice={togglePlannerChoice}
            />
            <ChoiceGroup
              choices={plannerChoices.adventureActivities}
              field="adventureActivities"
              form={customTripForm}
              title="Adventure activities"
              togglePlannerChoice={togglePlannerChoice}
            />
            <ChoiceGroup
              choices={plannerChoices.sightseeingTours}
              field="sightseeingTours"
              form={customTripForm}
              title="Sightseeing tours"
              togglePlannerChoice={togglePlannerChoice}
            />
            <ChoiceGroup
              choices={plannerChoices.culturalExperiences}
              field="culturalExperiences"
              form={customTripForm}
              title="Cultural experiences"
              togglePlannerChoice={togglePlannerChoice}
            />
          </div>
          <label>
            Extra notes
            <textarea
              placeholder="Tell us anything important: accessibility, food, pickup, celebration, pace..."
              value={customTripForm.specialRequests}
              onChange={(event) =>
                setCustomTripForm({ ...customTripForm, specialRequests: event.target.value })
              }
            />
          </label>
          <button type="submit">
            <BadgeCheck size={16} />
            Submit custom trip plan
          </button>
        </div>
      </form>

      <div className="customTripList">
        <SectionTitle
          eyebrow="My custom plans"
          title="Submitted trip requests"
          text="These are custom packages requested by the current user."
        />
        {customTrips.length === 0 ? (
          <EmptyState title="No custom trips yet" text="Submit the planner form to create one." />
        ) : null}
        {customTrips.map((trip) => (
          <article className="customTripCard" key={trip._id}>
            <div>
              <h3>{trip.destination}</h3>
              <p>
                From {trip.departureCity} | {trip.durationDays} days / {trip.durationNights} nights
              </p>
            </div>
            <div className="chipRow">
              <span>{trip.travelStyle}</span>
              <span>{trip.hotelCategory}</span>
              <span>{trip.mealPlan}</span>
              <span>INR {trip.budgetMin} - {trip.budgetMax}</span>
              <span>{trip.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChoiceGroup({ choices, field, form, title, togglePlannerChoice }) {
  return (
    <div className="choiceGroup">
      <strong>{title}</strong>
      {choices.map((choice) => (
        <label className="checkChoice" key={choice}>
          <input
            checked={form[field].includes(choice)}
            onChange={() => togglePlannerChoice(field, choice)}
            type="checkbox"
          />
          {choice}
        </label>
      ))}
    </div>
  );
}

function PackagesPage({
  filteredPackages,
  searchTerm,
  setSearchTerm,
  setSelectedPackage,
  scopeFilter,
  setScopeFilter,
  setStyleFilter,
  styleFilter
}) {
  return (
    <section className="pageShell">
      <SectionTitle
        eyebrow="Package catalog"
        title="Explore travel packages"
        text="Search, filter, and book packages that are managed from the admin panel."
      />
      <div className="filterBar">
        <div className="searchBox">
          <Search size={18} />
          <input
            placeholder="Search Goa, adventure, luxury..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="selectBox">
          <SlidersHorizontal size={18} />
          <select value={styleFilter} onChange={(event) => setStyleFilter(event.target.value)}>
            <option value="all">All styles</option>
            <option value="culture">Culture</option>
            <option value="adventure">Adventure</option>
            <option value="relaxation">Relaxation</option>
            <option value="family">Family</option>
            <option value="luxury">Luxury</option>
            <option value="budget">Budget</option>
          </select>
        </div>
        <div className="selectBox">
          <Globe2 size={18} />
          <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
            <option value="all">National and international</option>
            <option value="national">National</option>
            <option value="international">International</option>
          </select>
        </div>
      </div>
      <div className="cards">
        {filteredPackages.map((item, index) => (
          <PackageCard
            item={item}
            key={item._id}
            imageFallback={fallbackImages[index % fallbackImages.length]}
            setSelectedPackage={setSelectedPackage}
          />
        ))}
      </div>
    </section>
  );
}

function RecommendedPage({ packages, preferences, savePreferences, setPreferences, setSelectedPackage }) {
  return (
    <section className="pageShell recommendationGrid">
      <aside className="preferencePanel">
        <span className="kicker">
          <Settings size={15} />
          Personalization engine
        </span>
        <h2>Your travel DNA</h2>
        <p>Change these values and GoTravels re-scores packages for this exact user.</p>
        <form onSubmit={savePreferences} className="formStack">
          <label>
            Interests
            <input
              value={preferences.interests}
              onChange={(event) => setPreferences({ ...preferences, interests: event.target.value })}
            />
          </label>
          <label>
            Travel style
            <select
              value={preferences.travelStyle}
              onChange={(event) => setPreferences({ ...preferences, travelStyle: event.target.value })}
            >
              <option value="culture">Culture</option>
              <option value="adventure">Adventure</option>
              <option value="relaxation">Relaxation</option>
              <option value="family">Family</option>
              <option value="luxury">Luxury</option>
              <option value="budget">Budget</option>
            </select>
          </label>
          <div className="twoCols">
            <label>
              Min budget
              <input
                type="number"
                value={preferences.budgetMin}
                onChange={(event) => setPreferences({ ...preferences, budgetMin: event.target.value })}
              />
            </label>
            <label>
              Max budget
              <input
                type="number"
                value={preferences.budgetMax}
                onChange={(event) => setPreferences({ ...preferences, budgetMax: event.target.value })}
              />
            </label>
          </div>
          <label>
            Preferred destinations
            <input
              value={preferences.preferredDestinations}
              onChange={(event) =>
                setPreferences({ ...preferences, preferredDestinations: event.target.value })
              }
            />
          </label>
          <button type="submit">
            <Sparkles size={16} />
            Refresh recommendations
          </button>
        </form>
      </aside>
      <div>
        <SectionTitle
          eyebrow="Dynamic packages"
          title="Recommended for you"
          text="Scores and reasons are generated from the logged-in user's preferences."
        />
        <div className="cards">
          {packages.map((item, index) => (
            <PackageCard
              item={item}
              key={item._id}
              imageFallback={fallbackImages[index % fallbackImages.length]}
              setSelectedPackage={setSelectedPackage}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingsPage({
  bookings,
  cancelBooking,
  feedbackForms,
  setFeedbackForms,
  submitFeedback,
  totalBookings,
  totalSpent
}) {
  return (
    <section className="pageShell">
      <SectionTitle
        eyebrow="Traveller dashboard"
        title="My bookings"
        text="A clean booking history for the logged-in user."
      />
      <div className="statGrid">
        <Stat icon={CalendarDays} label="Bookings" value={totalBookings} />
        <Stat icon={WalletCards} label="Confirmed value" value={`INR ${totalSpent}`} />
        <Stat icon={Clock3} label="Current status" value={bookings[0]?.status || "No trips"} />
      </div>
      <div className="bookingList">
        {bookings.length === 0 ? <EmptyState title="No bookings yet" text="Book a package to see it here." /> : null}
        {bookings.map((booking) => (
          <article className="bookingRow" key={booking._id}>
            <div>
              <h3>{booking.package?.title}</h3>
              <p>{booking.package?.destination || "Destination"} package</p>
            </div>
            <span>{new Date(booking.travelDate).toLocaleDateString()}</span>
            <span>{booking.travelers} travellers</span>
            <strong>INR {booking.totalAmount}</strong>
            <span className={`statusPill ${booking.status}`}>{booking.status}</span>
            <span className="statusPill">{booking.payment?.status || "unpaid"}</span>
            {booking.status !== "cancelled" ? (
              <button className="dangerButton" onClick={() => cancelBooking(booking._id)}>
                <Ban size={15} />
                Cancel
              </button>
            ) : null}
            {booking.status === "confirmed" ? (
              <form className="feedbackForm" onSubmit={(event) => submitFeedback(event, booking._id)}>
                <div className="starSelect" aria-label="Review rating">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const current = feedbackForms[booking._id]?.rating || 5;
                    return (
                      <button
                        className={star <= current ? "active" : ""}
                        key={star}
                        type="button"
                        onClick={() =>
                          setFeedbackForms({
                            ...feedbackForms,
                            [booking._id]: {
                              rating: star,
                              comment: feedbackForms[booking._id]?.comment || ""
                            }
                          })
                        }
                        title={`${star} star`}
                      >
                        <Star size={16} />
                      </button>
                    );
                  })}
                </div>
                <input
                  placeholder="Write feedback after your completed booking"
                  value={feedbackForms[booking._id]?.comment || ""}
                  onChange={(event) =>
                    setFeedbackForms({
                      ...feedbackForms,
                      [booking._id]: {
                        rating: feedbackForms[booking._id]?.rating || 5,
                        comment: event.target.value
                      }
                    })
                  }
                  required
                />
                <button type="submit">
                  <Send size={15} />
                  Review
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AssistantPage({
  askChatbot,
  chatMessage,
  chatPackages,
  chatPromptType,
  chatReply,
  chatTripScope,
  setChatMessage,
  setChatPromptType,
  setChatTripScope,
  setSelectedPackage
}) {
  const prompts = [
    { id: "recommendation", label: "Recommend", text: "Suggest a family trip under 30000" },
    { id: "budget", label: "Budget", text: "Find a national budget trip below 20000" },
    { id: "itinerary", label: "Itinerary", text: "Plan an international 5 day culture itinerary" }
  ];

  return (
    <section className="pageShell assistantPage">
      <div className="assistantHero">
        <span className="kicker">
          <Bot size={15} />
          AI travel guide
        </span>
        <h1>Ask for a smarter trip idea.</h1>
        <p>
          Ask about budgets, destinations, travel styles, or which GoTravels package fits your plan.
        </p>
      </div>
      <form onSubmit={askChatbot} className="chatBox">
        <div className="promptBar">
          {prompts.map((prompt) => (
            <button
              className={chatPromptType === prompt.id ? "active" : ""}
              key={prompt.id}
              type="button"
              onClick={() => {
                setChatPromptType(prompt.id);
                setChatMessage(prompt.text);
              }}
            >
              {prompt.label}
            </button>
          ))}
          <select value={chatTripScope} onChange={(event) => setChatTripScope(event.target.value)}>
            <option value="all">Any scope</option>
            <option value="national">National</option>
            <option value="international">International</option>
          </select>
        </div>
        <input
          placeholder="Suggest a family trip under 30000"
          value={chatMessage}
          onChange={(event) => setChatMessage(event.target.value)}
        />
        <button type="submit">
          <Send size={16} />
          Ask
        </button>
      </form>
      {chatReply ? <div className="chatReply">{chatReply}</div> : null}
      {chatPackages.length > 0 ? (
        <div className="chatRecommendations">
          <SectionTitle
            eyebrow="AI picks"
            title="Packages you can book"
            text="These cards come from MongoDB and match your profile."
          />
          <div className="cards">
            {chatPackages.map((item, index) => (
              <PackageCard
                imageFallback={fallbackImages[index % fallbackImages.length]}
                item={item}
                key={item._id}
                setSelectedPackage={setSelectedPackage}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SupportPage({ setSupportForm, submitSupportEnquiry, supportForm }) {
  return (
    <section className="pageShell supportPage">
      <SectionTitle
        eyebrow="Customer support"
        title="Send an enquiry"
        text="Share your trip, booking, payment, or customization question with the GoTravels team."
      />
      <form onSubmit={submitSupportEnquiry} className="supportForm">
        <div className="twoCols">
          <label>
            Full name
            <input
              placeholder="Your full name"
              value={supportForm.fullName}
              onChange={(event) => setSupportForm({ ...supportForm, fullName: event.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              placeholder="you@example.com"
              type="email"
              value={supportForm.email}
              onChange={(event) => setSupportForm({ ...supportForm, email: event.target.value })}
              required
            />
          </label>
        </div>
        <label>
          Message
          <textarea
            placeholder="Type your enquiry message"
            value={supportForm.message}
            onChange={(event) => setSupportForm({ ...supportForm, message: event.target.value })}
            required
          />
        </label>
        <button type="submit">
          <Headphones size={16} />
          Submit enquiry
        </button>
      </form>
    </section>
  );
}

function AdminPage({
  cancelPackageEdit,
  createPackage,
  deletePackage,
  editingPackage,
  packageForm,
  packages,
  setPackageForm,
  startEditPackage
}) {
  return (
    <section className="pageShell adminLayout">
      <div>
        <SectionTitle
          eyebrow="Admin dashboard"
          title="Manage packages"
          text="Create fresh travel packages and immediately publish them into the catalog."
        />
        <div className="adminTable">
          {packages.map((item) => (
            <div className="adminRow" key={item._id}>
              <img src={item.imageUrl || fallbackImages[1]} alt={item.title} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.destination}</p>
              </div>
              <span>{item.travelStyle}</span>
              <strong>INR {item.price}</strong>
              <div className="adminActions">
                <button className="tableButton" onClick={() => startEditPackage(item)}>
                  <Settings size={15} />
                  Edit
                </button>
                <button className="dangerButton" onClick={() => deletePackage(item._id)}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="adminForm">
        <span className="kicker">
          {editingPackage ? <Settings size={15} /> : <Plus size={15} />}
          {editingPackage ? "Edit package" : "New package"}
        </span>
        <h2>{editingPackage ? "Update package" : "Create package"}</h2>
        <form onSubmit={createPackage} className="formStack">
          <div className="twoCols">
            <FormInput field="title" packageForm={packageForm} setPackageForm={setPackageForm} />
            <FormInput field="destination" packageForm={packageForm} setPackageForm={setPackageForm} />
          </div>
          <label>
            Description
            <textarea
              value={packageForm.description}
              onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })}
            />
          </label>
          <FormInput field="imageUrl" label="Image URL" packageForm={packageForm} setPackageForm={setPackageForm} />
          <div className="twoCols">
            <FormInput field="price" packageForm={packageForm} setPackageForm={setPackageForm} />
            <FormInput field="durationDays" label="Duration days" packageForm={packageForm} setPackageForm={setPackageForm} />
          </div>
          <div className="twoCols">
            <FormInput field="availableSlots" label="Slots" packageForm={packageForm} setPackageForm={setPackageForm} />
            <FormInput field="rating" packageForm={packageForm} setPackageForm={setPackageForm} />
          </div>
          <label>
            Travel style
            <select
              value={packageForm.travelStyle}
              onChange={(event) => setPackageForm({ ...packageForm, travelStyle: event.target.value })}
            >
              <option value="culture">Culture</option>
              <option value="adventure">Adventure</option>
              <option value="relaxation">Relaxation</option>
              <option value="family">Family</option>
              <option value="luxury">Luxury</option>
              <option value="budget">Budget</option>
            </select>
          </label>
          <label>
            Trip scope
            <select
              value={packageForm.tripScope}
              onChange={(event) => setPackageForm({ ...packageForm, tripScope: event.target.value })}
            >
              <option value="national">National</option>
              <option value="international">International</option>
            </select>
          </label>
          <FormInput field="tags" packageForm={packageForm} setPackageForm={setPackageForm} />
          <FormInput field="highlights" packageForm={packageForm} setPackageForm={setPackageForm} />
          <button type="submit">
            {editingPackage ? <BadgeCheck size={16} /> : <Plus size={16} />}
            {editingPackage ? "Save changes" : "Create package"}
          </button>
          {editingPackage ? (
            <button className="secondaryButton" type="button" onClick={cancelPackageEdit}>
              Cancel edit
            </button>
          ) : null}
        </form>
      </aside>
    </section>
  );
}

function FormInput({ field, label, packageForm, setPackageForm }) {
  return (
    <label>
      {label || field}
      <input
        value={packageForm[field]}
        onChange={(event) => setPackageForm({ ...packageForm, [field]: event.target.value })}
      />
    </label>
  );
}

function PackageCard({ imageFallback, item, setSelectedPackage }) {
  return (
    <article className="packageCard">
      <div className="imageWrap">
        <img src={item.imageUrl || imageFallback} alt={item.title} />
        {item.matchScore ? <span className="matchBadge">{item.matchScore}% match</span> : null}
      </div>
      <div className="packageBody">
        <div className="packageTitle">
          <h3>{item.title}</h3>
          <span>{item.rating}</span>
        </div>
        <p className="place">
          <MapPin size={15} />
          {item.destination}
        </p>
        <p>{item.description}</p>
        <div className="chipRow">
          <span>INR {item.price}</span>
          <span>{item.durationDays} days</span>
          <span>{item.travelStyle}</span>
          <span>{item.tripScope || "national"}</span>
        </div>
        {item.matchReasons ? <small>{item.matchReasons.join(" | ")}</small> : null}
        <button onClick={() => setSelectedPackage(item)}>
          <CalendarDays size={16} />
          View and book
        </button>
      </div>
    </article>
  );
}

function BookingModal({ bookingForm, bookPackage, selectedPackage, setBookingForm, setSelectedPackage, user }) {
  return (
    <div className="modal">
      <div className="modalPanel">
        <button className="close" onClick={() => setSelectedPackage(null)} title="Close">
          <X size={18} />
        </button>
        <div className="modalHeader">
          <span className="kicker">
            <Mountain size={15} />
            Trip preview
          </span>
          <h2>{selectedPackage.title}</h2>
          <p>{selectedPackage.description}</p>
        </div>
        <div className="chipRow">
          <span>{selectedPackage.destination}</span>
          <span>INR {selectedPackage.price}</span>
          <span>{selectedPackage.durationDays} days</span>
          <span>{selectedPackage.rating} rating</span>
          <span>{selectedPackage.availableSlots} slots</span>
        </div>
        {selectedPackage.highlights?.length > 0 ? (
          <div className="detailBlock">
            <strong>Trip highlights</strong>
            <div className="chipRow">
              {selectedPackage.highlights.map((highlight) => (
                <span key={highlight}>{highlight}</span>
              ))}
            </div>
          </div>
        ) : null}
        {selectedPackage.tags?.length > 0 ? (
          <div className="detailBlock">
            <strong>Best for</strong>
            <div className="chipRow">
              {selectedPackage.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        ) : null}
        {user ? (
          <form onSubmit={bookPackage} className="formStack">
            <div className="twoCols">
              <label>
                Travel date
                <input
                  type="date"
                  value={bookingForm.travelDate}
                  onChange={(event) =>
                    setBookingForm({ ...bookingForm, travelDate: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Travellers
                <input
                  min="1"
                  type="number"
                  value={bookingForm.travelers}
                  onChange={(event) =>
                    setBookingForm({ ...bookingForm, travelers: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Contact phone
              <input
                placeholder="Enter phone number"
                value={bookingForm.contactPhone}
                onChange={(event) =>
                  setBookingForm({ ...bookingForm, contactPhone: event.target.value })
                }
              />
            </label>
            <label>
              Special requests
              <textarea
                placeholder="Pickup request, food preference, hotel note..."
                value={bookingForm.specialRequests}
                onChange={(event) =>
                  setBookingForm({ ...bookingForm, specialRequests: event.target.value })
                }
              />
            </label>
            <button type="submit">
              <CreditCard size={16} />
              Continue to Stripe payment
            </button>
          </form>
        ) : (
          <p className="muted">Sign in to book this package.</p>
        )}
      </div>
    </div>
  );
}

function PaymentModal({
  completeMockPayment,
  paymentForm,
  pendingPaymentBooking,
  startStripePayment,
  setPaymentForm,
  setPendingPaymentBooking
}) {
  return (
    <div className="modal">
      <div className="modalPanel paymentPanel">
        <button className="close" onClick={() => setPendingPaymentBooking(null)} title="Close">
          <X size={18} />
        </button>
        <div className="modalHeader">
          <span className="kicker">
            <WalletCards size={15} />
            Sandbox payment
          </span>
          <h2>Confirm your booking</h2>
          <p>
            This is a sandbox payment for demo purposes. No real money is charged.
          </p>
        </div>
        <div className="paymentSummary">
          <span>{pendingPaymentBooking.package?.title}</span>
          <strong>INR {pendingPaymentBooking.totalAmount}</strong>
        </div>
        <form onSubmit={completeMockPayment} className="formStack">
          <label>
            Card number
            <input
              value={paymentForm.cardNumber}
              onChange={(event) =>
                setPaymentForm({ ...paymentForm, cardNumber: event.target.value })
              }
            />
          </label>
          <label>
            Cardholder name
            <input
              value={paymentForm.cardholderName}
              onChange={(event) =>
                setPaymentForm({ ...paymentForm, cardholderName: event.target.value })
              }
            />
          </label>
          <div className="twoCols">
            <label>
              Expiry
              <input
                value={paymentForm.expiry}
                onChange={(event) => setPaymentForm({ ...paymentForm, expiry: event.target.value })}
              />
            </label>
            <label>
              CVV
              <input
                value={paymentForm.cvv}
                onChange={(event) => setPaymentForm({ ...paymentForm, cvv: event.target.value })}
              />
            </label>
          </div>
          <label className="checkChoice">
            <input
              checked={paymentForm.forceFailure}
              type="checkbox"
              onChange={(event) =>
                setPaymentForm({ ...paymentForm, forceFailure: event.target.checked })
              }
            />
            Simulate failed payment
          </label>
          <button type="submit">
            <BadgeCheck size={16} />
            Validate sandbox payment
          </button>
          <button className="secondaryButton" type="button" onClick={startStripePayment}>
            <CreditCard size={16} />
            Pay with Stripe
          </button>
        </form>
      </div>
    </div>
  );
}

function PaymentSuccessPage({ paymentResult, setActivePage }) {
  const isConfirmed = paymentResult?.status === "confirmed";
  const isChecking = paymentResult?.status === "checking";
  const booking = paymentResult?.booking;

  return (
    <section className="pageShell paymentResultPage">
      <div className="paymentResultCard">
        <span className="panelIcon">
          {isConfirmed ? <BadgeCheck size={22} /> : <Clock3 size={22} />}
        </span>
        <span className="kicker">
          <CreditCard size={15} />
          Stripe payment
        </span>
        <h1>
          {isChecking
            ? "Checking your payment"
            : isConfirmed
              ? "Booking confirmed"
              : "Payment not completed"}
        </h1>
        <p>
          {isChecking
            ? "Please wait while GoTravels verifies the payment with Stripe."
            : isConfirmed
              ? "Your Stripe payment was successful and your trip booking is confirmed."
              : paymentResult?.message || "We could not confirm this payment yet."}
        </p>
        {booking ? (
          <div className="paymentSummary confirmed">
            <span>{booking.package?.title || "GoTravels package"}</span>
            <strong>INR {booking.totalAmount}</strong>
          </div>
        ) : null}
        <div className="heroActions">
          <button onClick={() => setActivePage("bookings")}>
            <CalendarDays size={16} />
            Check bookings
          </button>
          <button className="secondaryButton" onClick={() => setActivePage("home")}>
            <Home size={16} />
            Back home
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, text, title }) {
  return (
    <div className="sectionTitle">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <article className="statCard">
      <span>
        <Icon size={18} />
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ text, title }) {
  return (
    <div className="emptyState">
      <Users size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Footer({ setActivePage }) {
  return (
    <footer className="footer">
      <div>
        <button className="brandButton" onClick={() => setActivePage("home")}>
          <span className="brandMark">
            <Plane size={18} />
          </span>
          <span>GoTravels</span>
        </button>
        <p>MERN travel booking with personalized package recommendations.</p>
      </div>
      <div>
        <h3>Explore</h3>
        <button onClick={() => setActivePage("packages")}>Packages</button>
        <button onClick={() => setActivePage("recommended")}>For You</button>
        <button onClick={() => setActivePage("bookings")}>Bookings</button>
      </div>
      <div>
        <h3>Project</h3>
        <p>React, Express, MongoDB, JWT, and optional AI chatbot support.</p>
      </div>
    </footer>
  );
}

export default App;
