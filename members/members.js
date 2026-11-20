// Wonder of Saya Tales — Membership, Sign-in (Google, Apple, Email Magic Link),
// Parent Gate, Demo Mode, Payment Switch (off), and Book Lock Screen.
// Included with a single <script type="module" src="../members/members.js"></script>
// on web/landing/index.html and web/live/index.html. No ads, no tracking SDKs.

const BASE = new URL("./", import.meta.url);
const LEGAL_BASE = new URL("../landing/legal/", BASE);
const BOOKS_JSON = new URL("../landing/books.json", BASE);
const DEMO_KEY = "wst-member-demo-v1";
const LIVE_SESSION_KEY = "wst-member-session-v1";
const PKCE_KEY = "wst-member-pkce-v1";
const WAITLIST_KEY = "wst-member-waitlist-v1";

const COPY = {
  en: {
    signIn: "Sign in",
    signUp: "Sign up",
    account: "Account",
    membership: "Membership",
    memberBadge: "Member",
    freeBadge: "Free account",
    cancelledBadge: "Cancelled",
    demoBadge: "Demo mode",
    close: "Close",
    langToggle: "ລາວ",
    parentTitle: "For parents",
    parentSub: "Quick parent check before signing in or creating an account.",
    parentMathLabel: (a, b) => `What is ${a} + ${b}?`,
    parentContinue: "Continue",
    parentWrong: "Please check the sum and try again.",
    parentOr: "or",
    parentHold: "Hold for 1.5 seconds to continue",
    parentHolding: "Keep holding…",
    signInTitle: "Parent Sign In",
    signInSub: "One account works on the website and the upcoming apps.",
    googleBtn: "Continue with Google",
    appleBtn: "Continue with Apple",
    orEmail: "or sign in with email",
    emailPlaceholder: "parent@example.com",
    sendLink: "Send sign-in link",
    emailInvalid: "Please enter a valid email address.",
    linkSent: (e) => `Sign-in link sent to ${e}. Check your inbox.`,
    demoSignedIn: (p, e) => `Signed in (${p}, demo) as ${e}.`,
    privacyFoot: "No ads. No tracking. Parent account only.",
    memberTitle: "Your Membership",
    signedInAs: "Signed in as",
    planLabel: "Current plan",
    planFreeDesc: "Kapi and the Crocodile is free forever.",
    planMemberDesc: "All pop-up storybooks are unlocked.",
    planCancelledUntil: (d) => `Active until ${d}.`,
    paymentsOffHeading: "Membership opens soon, leave your email",
    paymentsOffBody: "We will let you know the day full membership opens. Kapi stays free in the meantime.",
    notifyBtn: "Notify me",
    notifySaved: (e) => `Thank you! We saved ${e} for launch day.`,
    monthlyPlan: "Monthly",
    yearlyPlan: "Yearly",
    priceSoon: "Price coming soon",
    cancelAnytime: "Cancel any time",
    gumroadBtn: "Membership",
    gumroadHint: "Opens secure Gumroad checkout with your parent email pre-filled. Cancel any time.",
    demoControlsTitle: "Demo preview (no keys configured)",
    demoMakeMember: "Demo: Activate membership",
    demoMakeFree: "Demo: Switch to free account",
    signOut: "Sign out",
    lockedTag: "Members' Story",
    lockedSubOut: "This story is for members. Sign in with a parent account, or read Kapi free.",
    lockedSubFree: "Your free account includes Kapi and the Crocodile. Full membership unlocks every story.",
    readKapiFree: "Read Kapi free",
    backToLibrary: "Back to the library",
    openMembership: "Membership",
    legal: {
      membership: "Membership",
      terms: "Terms",
      privacy: "Privacy",
      refunds: "Refunds",
      contact: "Contact",
    },
  },
  lo: {
    signIn: "ເຂົ້າສູ່ລະບົບ",
    signUp: "ສະໝັກ",
    account: "ບັນຊີ",
    membership: "ສະມາຊິກ",
    memberBadge: "ສະມາຊິກ",
    freeBadge: "ບັນຊີຟຣີ",
    cancelledBadge: "ຍົກເລີກແລ້ວ",
    demoBadge: "ໂໝດທົດລອງ",
    close: "ປິດ",
    langToggle: "EN",
    parentTitle: "ສຳລັບຜູ້ປົກຄອງ",
    parentSub: "ຢືນຢັນຜູ້ປົກຄອງກ່ອນເຂົ້າສູ່ລະບົບ ຫຼື ສະໝັກບັນຊີ.",
    parentMathLabel: (a, b) => `${a} + ${b} ເທົ່າກັບເທົ່າໃດ?`,
    parentContinue: "ສືບຕໍ່",
    parentWrong: "ກະລຸນາກວດຄຳຕອບແລ້ວລອງໃໝ່.",
    parentOr: "ຫຼື",
    parentHold: "ກົດຄ້າງໄວ້ 1.5 ວິນາທີ ເພື່ອສືບຕໍ່",
    parentHolding: "ກົດຄ້າງໄວ້…",
    signInTitle: "ເຂົ້າສູ່ລະບົບຜູ້ປົກຄອງ",
    signInSub: "ບັນຊີດຽວໃຊ້ໄດ້ທັງເວັບໄຊ ແລະ ແອັບໃນອະນາຄົດ.",
    googleBtn: "ສືບຕໍ່ດ້ວຍ Google",
    appleBtn: "ສືບຕໍ່ດ້ວຍ Apple",
    orEmail: "ຫຼື ເຂົ້າສູ່ລະບົບດ້ວຍອີເມວ",
    emailPlaceholder: "parent@example.com",
    sendLink: "ສົ່ງລິ້ງເຂົ້າສູ່ລະບົບ",
    emailInvalid: "ກະລຸນາໃສ່ອີເມວໃຫ້ຖືກຕ້ອງ.",
    linkSent: (e) => `ສົ່ງລິ້ງເຂົ້າສູ່ລະບົບໄປທີ່ ${e} ແລ້ວ. ກວດກ່ອງຈົດໝາຍຂອງທ່ານ.`,
    demoSignedIn: (p, e) => `ເຂົ້າສູ່ລະບົບແລ້ວ (${p}, ທົດລອງ) ດ້ວຍ ${e}.`,
    privacyFoot: "ບໍ່ມີໂຄສະນາ. ບໍ່ມີການຕິດຕາມ. ບັນຊີສຳລັບຜູ້ປົກຄອງເທົ່ານັ້ນ.",
    memberTitle: "ສະມາຊິກຂອງທ່ານ",
    signedInAs: "ເຂົ້າສູ່ລະບົບດ້ວຍ",
    planLabel: "ແພັກເກັດປັດຈຸບັນ",
    planFreeDesc: "ປຶ້ມ ກາປີ ກັບ ແຂ້ ອ່ານຟຣີຕະຫຼອດໄປ.",
    planMemberDesc: "ເປີດອ່ານປຶ້ມນິທານປັອບອັບທຸກເຫຼັ້ມແລ້ວ.",
    planCancelledUntil: (d) => `ໃຊ້ງານໄດ້ຈົນເຖິງ ${d}.`,
    paymentsOffHeading: "ລະບົບສະມາຊິກຈະເປີດໄວໆນີ້, ຝາກອີເມວຂອງທ່ານໄວ້",
    paymentsOffBody: "ພວກເຮົາຈະແຈ້ງໃຫ້ທ່ານຊາບໃນມື້ເປີດສະມາຊິກ. ປຶ້ມ ກາປີ ອ່ານຟຣີໄດ້ສະເໝີ.",
    notifyBtn: "ແຈ້ງເຕືອນຂ້ອຍ",
    notifySaved: (e) => `ຂອບໃຈ! ບັນທຶກ ${e} ໄວ້ສຳລັບມື້ເປີດຕົວແລ້ວ.`,
    monthlyPlan: "ລາຍເດືອນ",
    yearlyPlan: "ລາຍປີ",
    priceSoon: "ລາຄາໄວໆນີ້",
    cancelAnytime: "ຍົກເລີກໄດ້ທຸກເວລາ",
    gumroadBtn: "ສະມາຊິກ",
    gumroadHint: "ເປີດໜ້າຊຳລະເງິນ Gumroad ພ້ອມອີເມວຜູ້ປົກຄອງຂອງທ່ານ. ຍົກເລີກໄດ້ທຸກເວລາ.",
    demoControlsTitle: "ໂໝດທົດລອງ (ຍັງບໍ່ໄດ້ໃສ່ຄີຈິງ)",
    demoMakeMember: "ທົດລອງ: ເປີດສະຖານະສະມາຊິກ",
    demoMakeFree: "ທົດລອງ: ປ່ຽນເປັນບັນຊີຟຣີ",
    signOut: "ອອກຈາກລະບົບ",
    lockedTag: "ນິທານສຳລັບສະມາຊິກ",
    lockedSubOut: "ເລື່ອງນີ້ສຳລັບສະມາຊິກ. ເຂົ້າສູ່ລະບົບຜູ້ປົກຄອງ ຫຼື ອ່ານປຶ້ມ ກາປີ ຟຣີ.",
    lockedSubFree: "ບັນຊີຟຣີຂອງທ່ານອ່ານ ກາປີ ກັບ ແຂ້ ໄດ້ຟຣີ. ສະມາຊິກຈະເປີດອ່ານທຸກເລື່ອງ.",
    readKapiFree: "ອ່ານ ກາປີ ຟຣີ",
    backToLibrary: "ກັບໄປຫ້ອງສະໝຸດ",
    openMembership: "ສະມາຊິກ",
    legal: {
      membership: "ສະມາຊິກ",
      terms: "ຂໍ້ກຳນົດ",
      privacy: "ຄວາມເປັນສ່ວນຕົວ",
      refunds: "ການຄືນເງິນ",
      contact: "ຕິດຕໍ່",
    },
  },
};

const ICON_GOOGLE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.25-.96 2.3-2.04 3.01l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.47 0-.72-.06-1.41-.19-2.08H12z"/><path fill="#4285F4" d="M12 22c2.75 0 5.06-.91 6.75-2.46l-3.3-2.56c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.89v2.64C4.57 19.74 8.01 22 12 22z"/><path fill="#FBBC05" d="M6.3 13.76a5.96 5.96 0 0 1 0-3.52V7.6H2.89a9.99 9.99 0 0 0 0 8.8l3.41-2.64z"/><path fill="#34A853" d="M12 6.04c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 2.99 14.74 2 12 2 8.01 2 4.57 4.26 2.89 7.6l3.41 2.64c.8-2.41 3.05-4.2 5.7-4.2z"/></svg>`;
const ICON_APPLE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.36 12.68c.02 2.4 2.1 3.2 2.12 3.21-.02.06-.33 1.14-1.1 2.26-.66.97-1.35 1.94-2.43 1.96-1.06.02-1.4-.63-2.62-.63s-1.6.61-2.6.65c-1.04.04-1.84-1.05-2.5-2.02-1.36-1.97-2.4-5.57-1-8 .69-1.2 1.93-1.97 3.27-1.99 1.02-.02 1.98.69 2.6.69.62 0 1.79-.85 3.02-.73.51.02 1.96.21 2.88 1.56-.07.05-1.72 1-1.64 3.04zM14.35 6.45c.56-.68.93-1.62.83-2.56-.8.03-1.77.53-2.34 1.2-.51.59-.96 1.55-.84 2.47.9.07 1.8-.45 2.35-1.11z"/></svg>`;
const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/></svg>`;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function storageDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function detectLang() {
  const qs = new URLSearchParams(location.search).get("lang");
  if (qs === "lo" || qs === "en") return qs;
  const htmlLang = (document.documentElement.lang || "").toLowerCase();
  if (htmlLang.startsWith("lo")) return "lo";
  const saved = storageGet("wst-lang");
  if (saved === "lo") return "lo";
  return "en";
}

function injectStyles() {
  if (!document.querySelector('link[href*="members.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("members.css", BASE).href;
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href*="noto-sans-lao.css"]')) {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = new URL("../fonts/noto-sans-lao/noto-sans-lao.css", BASE).href;
    document.head.appendChild(font);
  }
}

async function loadConfig() {
  const defaults = {
    supabaseUrl: "",
    supabaseAnonKey: "",
    workerUrl: "",
    freeBooks: ["kapi"],
    payments: "off",
    paymentProvider: "gumroad",
    membership: { productUrl: "" },
    supportEmail: "support@tales.gurulao.com",
    plans: { monthly: { price: "", period: "month" }, yearly: { price: "", period: "year" } },
  };
  try {
    const r = await fetch(new URL("config.json", BASE).href, { cache: "no-cache" });
    if (!r.ok) return defaults;
    const data = await r.json();
    return {
      ...defaults,
      ...data,
      membership: { ...defaults.membership, ...(data.membership || {}) },
      plans: { ...defaults.plans, ...(data.plans || {}) },
    };
  } catch {
    return defaults;
  }
}

function isActiveMembership(m) {
  if (!m) return false;
  const now = Date.now();
  const end = m.periodEnd ? Date.parse(m.periodEnd) : null;
  if (m.status === "active") return !end || end > now;
  if (m.status === "cancelled") return !!end && end > now;
  return false;
}

function formatBookName(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// PKCE helper for live Supabase OAuth
function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function createPkce() {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = b64url(verifierBytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  return { verifier, challenge };
}

// ---------- Main controller ----------
injectStyles();

const config = await loadConfig();
const isDemo = !config.supabaseUrl || !config.supabaseAnonKey;
const isLiveViewer = /\/live\/?(index\.html)?$/i.test(location.pathname) || !!document.getElementById("view");
const isLanding = !!document.querySelector("header.bar .acct");

let lang = detectLang();
let state = {
  demo: isDemo,
  user: null, // { id, email, provider }
  accessToken: null,
  membership: { status: "free", source: "web", periodEnd: null },
};

const listeners = new Set();
const notify = () => {
  for (const fn of listeners) {
    try {
      fn(getPublicState());
    } catch {}
  }
};

function getPublicState() {
  return {
    demo: state.demo,
    user: state.user ? { ...state.user } : null,
    membership: { ...state.membership },
    isMember: isActiveMembership(state.membership),
    payments: config.payments,
  };
}

function getCurrentBook() {
  if (!isLiveViewer) return null;
  return (new URLSearchParams(location.search).get("book") || "kapi").trim().toLowerCase();
}

function isFreeBook(bookId) {
  const free = (config.freeBooks || ["kapi"]).map((s) => s.toLowerCase());
  return free.includes(String(bookId || "kapi").toLowerCase());
}

function isBookUnlocked(bookId = getCurrentBook()) {
  if (!bookId) return true;
  if (config.gate !== true) return true;  // Eddie 2026-11-20: every book stays open until he turns the gate on (planned at about 20 books); sign-in is only an extra
  if (isFreeBook(bookId)) return true;
  return isActiveMembership(state.membership);
}

// ---------- Session persistence (demo + live Supabase REST) ----------
function saveDemoState() {
  if (!state.user) {
    storageDel(DEMO_KEY);
    return;
  }
  storageSet(DEMO_KEY, JSON.stringify({ user: state.user, membership: state.membership }));
}

function restoreDemoState() {
  const raw = storageGet(DEMO_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.user?.email) {
      state.user = parsed.user;
      state.membership = parsed.membership || { status: "free", source: "web", periodEnd: null };
    }
  } catch {}
}

async function fetchLiveMembership(uid, token) {
  const base = config.supabaseUrl.replace(/\/+$/, "");
  const r = await fetch(`${base}/rest/v1/memberships?select=status,source,period_end&user_id=eq.${encodeURIComponent(uid)}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!r.ok) return { status: "free", source: "web", periodEnd: null };
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { status: "free", source: "web", periodEnd: null };
  return { status: row.status || "free", source: row.source || "web", periodEnd: row.period_end || null };
}

async function hydrateLiveSession(accessToken, refreshToken) {
  const base = config.supabaseUrl.replace(/\/+$/, "");
  const r = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    storageDel(LIVE_SESSION_KEY);
    return;
  }
  const u = await r.json();
  state.accessToken = accessToken;
  state.user = {
    id: u.id,
    email: u.email || "",
    provider: u.app_metadata?.provider || "email",
  };
  state.membership = await fetchLiveMembership(u.id, accessToken);
  storageSet(LIVE_SESSION_KEY, JSON.stringify({ accessToken, refreshToken, user: state.user }));
}

async function restoreLiveState() {
  const base = config.supabaseUrl.replace(/\/+$/, "");
  const url = new URL(location.href);

  // 1. Handle PKCE OAuth callback (?code=...)
  const code = url.searchParams.get("code");
  if (code) {
    let verifier = null;
    try {
      verifier = sessionStorage.getItem(PKCE_KEY);
      sessionStorage.removeItem(PKCE_KEY);
    } catch {}
    if (verifier) {
      try {
        const res = await fetch(`${base}/auth/v1/token?grant_type=pkce`, {
          method: "POST",
          headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) await hydrateLiveSession(data.access_token, data.refresh_token || null);
        }
      } catch {}
    }
    url.searchParams.delete("code");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
    return;
  }

  // 2. Handle implicit hash callback (#access_token=...) from email magic links
  if (location.hash && location.hash.includes("access_token=")) {
    const hashParams = new URLSearchParams(location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken) {
      await hydrateLiveSession(accessToken, refreshToken);
    }
    history.replaceState({}, "", url.pathname + url.search);
    return;
  }

  // 3. Restore stored session
  const raw = storageGet(LIVE_SESSION_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved?.accessToken) {
      await hydrateLiveSession(saved.accessToken, saved.refreshToken || null);
    }
  } catch {}
}

if (isDemo) {
  restoreDemoState();
} else {
  await restoreLiveState();
}

// ---------- Canonical membership setter & Phase 2 payment stubs ----------
/**
 * Unified membership state hook shared by:
 *   1. Demo preview controls (when config.supabaseUrl is empty)
 *   2. Phase 2 web checkout confirmation (Lemon Squeezy / Paddle / Stripe webhook -> DB -> client refresh)
 *   3. Phase 4 Capacitor native app store billing (Apple StoreKit / Google Play Billing receipt -> DB -> client refresh)
 * Live access control is ALWAYS enforced server-side by Supabase RLS + Cloudflare Worker is_member().
 */
function setMember({ status = "active", source = "web", periodEnd = null } = {}) {
  if (!["active", "free", "cancelled"].includes(status)) {
    throw new Error(`Invalid membership status: ${status}`);
  }
  state.membership = { status, source, periodEnd };
  if (isDemo && state.user) saveDemoState();
  syncUI();
  notify();
  return getPublicState();
}

function buildGumroadUrl(plan = "", overrideUrl = "") {
  const raw = String(overrideUrl || config.membership?.productUrl || "").trim();
  if (!raw) return "";
  let u;
  try {
    u = new URL(raw);
  } catch {
    return "";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  u.searchParams.set("wanted", "true");
  if (state.user?.email) u.searchParams.set("email", state.user.email);
  if (plan === "monthly" || plan === "yearly") u.searchParams.set("recurrence", plan);
  return u.href;
}

async function startWebCheckout(plan = "monthly") {
  if (config.payments !== "on") {
    return {
      ok: false,
      reason: "payments_off",
      provider: config.paymentProvider,
      plan,
      message: COPY[lang].paymentsOffHeading,
    };
  }
  if (config.paymentProvider === "gumroad") {
    const url = buildGumroadUrl(plan);
    if (!url) {
      return {
        ok: false,
        reason: "product_url_missing",
        provider: "gumroad",
        plan,
        nextStep: "Set membership.productUrl in web/members/config.json.",
      };
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return { ok: true, provider: "gumroad", url, plan };
  }
  // Phase 2b stub (Paddle): opens Paddle overlay/checkout with customData.email;
  // webhook verifies Paddle signature and calls SQL public.set_member_by_email(..., 'paddle').
  return {
    ok: false,
    reason: "provider_not_configured",
    provider: config.paymentProvider,
    plan,
    nextStep: "Wire provider checkout session and webhook to SQL public.set_member_by_email() and call setMember().",
  };
}

async function startStoreBilling(store = "apple", productId = "saya_member_monthly") {
  if (config.payments !== "on") {
    return {
      ok: false,
      reason: "payments_off",
      store,
      productId,
      message: COPY[lang].paymentsOffHeading,
    };
  }
  // Phase 4 stub (Capacitor iOS/Android): invoke StoreKit / Google Play Billing plugin,
  // post receipt to verification endpoint which calls SQL public.set_member(user_id, 'active', store, period_end),
  // then update local UI via setMember({ status: "active", source: store, periodEnd }).
  return {
    ok: false,
    reason: "native_store_bridge_not_installed",
    store,
    productId,
    nextStep: "Attach Capacitor IAP bridge and verify receipt before calling setMember().",
  };
}

async function signInWithOAuth(provider) {
  if (isDemo) {
    const email = provider === "apple" ? "parent@icloud.com" : "parent@gmail.com";
    state.user = { id: `demo-${provider}`, email, provider };
    state.membership = { status: "free", source: "web", periodEnd: null };
    saveDemoState();
    syncUI();
    notify();
    renderModal("membership", COPY[lang].demoSignedIn(provider === "apple" ? "Apple" : "Google", email));
    return;
  }

  const base = config.supabaseUrl.replace(/\/+$/, "");
  const redirectTo = location.origin + location.pathname + location.search;
  const { verifier, challenge } = await createPkce();
  try {
    sessionStorage.setItem(PKCE_KEY, verifier);
  } catch {}
  const authUrl =
    `${base}/auth/v1/authorize?provider=${encodeURIComponent(provider)}` +
    `&redirect_to=${encodeURIComponent(redirectTo)}` +
    `&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
  location.assign(authUrl);
}

async function signInWithEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: false, error: COPY[lang].emailInvalid };
  }
  if (isDemo) {
    state.user = { id: "demo-email", email: clean, provider: "email" };
    state.membership = { status: "free", source: "web", periodEnd: null };
    saveDemoState();
    syncUI();
    notify();
    renderModal("membership", COPY[lang].demoSignedIn("Email", clean));
    return { ok: true };
  }

  const base = config.supabaseUrl.replace(/\/+$/, "");
  const redirectTo = location.origin + location.pathname + location.search;
  const res = await fetch(`${base}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: clean, create_user: true, options: { emailRedirectTo: redirectTo } }),
  });
  if (!res.ok) {
    return { ok: false, error: `Could not send link (${res.status}).` };
  }
  return { ok: true, message: COPY[lang].linkSent(clean) };
}

async function saveWaitlistEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: false, error: COPY[lang].emailInvalid };
  }
  if (isDemo) {
    const list = JSON.parse(storageGet(WAITLIST_KEY) || "[]");
    if (!list.includes(clean)) list.push(clean);
    storageSet(WAITLIST_KEY, JSON.stringify(list));
    return { ok: true, message: COPY[lang].notifySaved(clean) };
  }

  const base = config.supabaseUrl.replace(/\/+$/, "");
  const headers = {
    apikey: config.supabaseAnonKey,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates",
  };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
  const res = await fetch(`${base}/rest/v1/membership_waitlist`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: clean, user_id: state.user?.id || null, lang }),
  });
  if (!res.ok && res.status !== 409) {
    return { ok: false, error: `Could not save email (${res.status}).` };
  }
  return { ok: true, message: COPY[lang].notifySaved(clean) };
}

async function signOut() {
  if (!isDemo && state.accessToken) {
    const base = config.supabaseUrl.replace(/\/+$/, "");
    await fetch(`${base}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${state.accessToken}` },
    }).catch(() => {});
    storageDel(LIVE_SESSION_KEY);
  }
  state.user = null;
  state.accessToken = null;
  state.membership = { status: "free", source: "web", periodEnd: null };
  saveDemoState();
  closeModal();
  syncUI();
  notify();
}

// ---------- Legal links helper ----------
function legalLinksHtml() {
  const t = COPY[lang].legal;
  const items = [
    ["membership.html", t.membership],
    ["terms.html", t.terms],
    ["privacy.html", t.privacy],
    ["refunds.html", t.refunds],
    ["contact.html", t.contact],
  ];
  return `<nav class="wst-legal-links" aria-label="Legal">${items
    .map(([f, label]) => `<a class="wst-link" href="${new URL(f, LEGAL_BASE).href}">${escapeHtml(label)}</a>`)
    .join("")}</nav>`;
}

// ---------- Modal UI (Parent Gate + Sign-in + Membership panel) ----------
let modalEl = null;
let modalMode = null; // "signin" | "membership"
let parentGatePassed = false;
let gateChallenge = { a: 12, b: 7 };

function freshChallenge() {
  const a = 6 + Math.floor(Math.random() * 9); // 6..14
  const b = 4 + Math.floor(Math.random() * 8); // 4..11
  gateChallenge = { a, b };
}

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement("div");
  modalEl.id = "wst-modal";
  modalEl.className = "wst-overlay";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  modalEl.hidden = true;
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });
  document.body.appendChild(modalEl);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl && !modalEl.hidden) closeModal();
  });
  return modalEl;
}

function openSignIn() {
  if (state.user) {
    openMembership();
    return;
  }
  if (!parentGatePassed) freshChallenge();
  renderModal("signin");
}

function openMembership() {
  if (!state.user) {
    openSignIn();
    return;
  }
  renderModal("membership");
}

function closeModal() {
  if (modalEl) modalEl.hidden = true;
  modalMode = null;
}

function renderModal(mode, statusMsg = "", isErr = false) {
  modalMode = mode;
  const el = ensureModal();
  el.lang = lang;
  const t = COPY[lang];
  const memberActive = isActiveMembership(state.membership);

  let bodyHtml = "";
  let heading = t.signInTitle;
  let badge = isDemo ? `<span class="wst-badge">${escapeHtml(t.demoBadge)}</span>` : "";

  if (mode === "signin" && !parentGatePassed) {
    heading = t.parentTitle;
    const { a, b } = gateChallenge;
    bodyHtml = `
      <p class="wst-sub">${escapeHtml(t.parentSub)}</p>
      <div class="wst-box" data-wst-gate="true">
        <label class="wst-label" for="wst-gate-ans">${escapeHtml(t.parentMathLabel(a, b))}</label>
        <div class="wst-input-row">
          <input id="wst-gate-ans" class="wst-input" type="text" inputmode="numeric" autocomplete="off" placeholder="?" data-a="${a}" data-b="${b}">
          <button type="button" class="wst-btn primary" id="wst-gate-submit">${escapeHtml(t.parentContinue)}</button>
        </div>
        <p class="wst-status err" id="wst-gate-err" hidden></p>
        <div class="wst-divider">${escapeHtml(t.parentOr)}</div>
        <button type="button" class="wst-btn wst-hold" id="wst-gate-hold" aria-label="${escapeHtml(t.parentHold)}">
          <i class="wst-hold-fill" id="wst-hold-fill"></i>
          <span id="wst-hold-label">${escapeHtml(t.parentHold)}</span>
        </button>
      </div>
      <p class="wst-note">${escapeHtml(t.privacyFoot)}</p>
      ${legalLinksHtml()}
    `;
  } else if (mode === "signin") {
    heading = t.signInTitle;
    bodyHtml = `
      <p class="wst-sub">${escapeHtml(t.signInSub)}</p>
      <div class="wst-stack">
        <button type="button" class="wst-btn" id="wst-oauth-google">${ICON_GOOGLE}<span>${escapeHtml(t.googleBtn)}</span></button>
        <button type="button" class="wst-btn" id="wst-oauth-apple">${ICON_APPLE}<span>${escapeHtml(t.appleBtn)}</span></button>
      </div>
      <div class="wst-divider">${escapeHtml(t.orEmail)}</div>
      <form id="wst-email-form" class="wst-stack" novalidate>
        <input id="wst-email-input" class="wst-input" type="email" autocomplete="email" placeholder="${escapeHtml(t.emailPlaceholder)}" required>
        <button type="submit" class="wst-btn primary">${escapeHtml(t.sendLink)}</button>
      </form>
      <p class="wst-status${isErr ? " err" : ""}" id="wst-modal-status"${statusMsg ? "" : " hidden"}>${escapeHtml(statusMsg)}</p>
      <p class="wst-note">${escapeHtml(t.privacyFoot)}</p>
      ${legalLinksHtml()}
    `;
  } else {
    heading = t.memberTitle;
    const statusBadge = memberActive
      ? `<span class="wst-badge active">${escapeHtml(t.memberBadge)}</span>`
      : state.membership.status === "cancelled"
        ? `<span class="wst-badge">${escapeHtml(t.cancelledBadge)}</span>`
        : `<span class="wst-badge">${escapeHtml(t.freeBadge)}</span>`;
    badge = `${statusBadge}${isDemo ? ` <span class="wst-badge">${escapeHtml(t.demoBadge)}</span>` : ""}`;

    const planDesc = memberActive
      ? state.membership.status === "cancelled" && state.membership.periodEnd
        ? t.planCancelledUntil(new Date(state.membership.periodEnd).toLocaleDateString())
        : t.planMemberDesc
      : t.planFreeDesc;

    const mPrice = config.plans?.monthly?.price || t.priceSoon;
    const yPrice = config.plans?.yearly?.price || t.priceSoon;

    const paymentSection =
      config.payments === "off"
        ? `
          <div class="wst-box" data-wst-payments="off">
            <strong class="wst-label">${escapeHtml(t.paymentsOffHeading)}</strong>
            <p class="wst-sub" style="margin-bottom:10px;font-size:14.5px">${escapeHtml(t.paymentsOffBody)}</p>
            <div class="wst-plan-grid">
              <div class="wst-plan-chip"><strong>${escapeHtml(t.monthlyPlan)}</strong><span>${escapeHtml(mPrice)} · ${escapeHtml(t.cancelAnytime)}</span></div>
              <div class="wst-plan-chip"><strong>${escapeHtml(t.yearlyPlan)}</strong><span>${escapeHtml(yPrice)} · ${escapeHtml(t.cancelAnytime)}</span></div>
            </div>
            <form id="wst-waitlist-form" class="wst-input-row" novalidate>
              <input id="wst-waitlist-email" class="wst-input" type="email" value="${escapeHtml(state.user?.email || "")}" placeholder="${escapeHtml(t.emailPlaceholder)}" required>
              <button type="submit" class="wst-btn primary">${escapeHtml(t.notifyBtn)}</button>
            </form>
            <p class="wst-status" id="wst-waitlist-status" hidden></p>
          </div>
        `
        : (() => {
            const gumroadHref = buildGumroadUrl();
            return `
              <div class="wst-box" data-wst-payments="on">
                <div class="wst-plan-grid">
                  <div class="wst-plan-chip"><strong>${escapeHtml(t.monthlyPlan)}</strong><span>${escapeHtml(mPrice)} · ${escapeHtml(t.cancelAnytime)}</span></div>
                  <div class="wst-plan-chip"><strong>${escapeHtml(t.yearlyPlan)}</strong><span>${escapeHtml(yPrice)} · ${escapeHtml(t.cancelAnytime)}</span></div>
                </div>
                ${
                  gumroadHref
                    ? `<a class="wst-btn primary" id="wst-gumroad-btn" href="${escapeHtml(gumroadHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.gumroadBtn)}</a>
                       <p class="wst-note" style="margin-top:8px">${escapeHtml(t.gumroadHint)}</p>`
                    : `<div class="wst-plan-grid">
                         <button type="button" class="wst-btn primary" id="wst-buy-monthly">${escapeHtml(t.monthlyPlan)} · ${escapeHtml(mPrice)}</button>
                         <button type="button" class="wst-btn" id="wst-buy-yearly">${escapeHtml(t.yearlyPlan)} · ${escapeHtml(yPrice)}</button>
                       </div>`
                }
              </div>
            `;
          })();

    const demoSection = isDemo
      ? `
        <div class="wst-box wst-box-dashed">
          <span class="wst-label" style="font-size:13.5px">${escapeHtml(t.demoControlsTitle)}</span>
          <button type="button" class="wst-btn subtle" id="wst-demo-toggle">
            ${escapeHtml(memberActive ? t.demoMakeFree : t.demoMakeMember)}
          </button>
        </div>
      `
      : "";

    bodyHtml = `
      <div class="wst-stack">
        <div class="wst-box">
          <div style="font-size:13.5px;color:var(--wst-muted)">${escapeHtml(t.signedInAs)}</div>
          <div style="font-size:17px;color:var(--wst-gold-hi);word-break:break-word">${escapeHtml(state.user?.email || "")}</div>
          <div style="margin-top:6px;font-size:14.5px;color:var(--wst-ink)">${escapeHtml(planDesc)}</div>
        </div>
        ${statusMsg ? `<p class="wst-status${isErr ? " err" : ""}">${escapeHtml(statusMsg)}</p>` : ""}
        ${paymentSection}
        ${demoSection}
        <button type="button" class="wst-btn subtle" id="wst-signout-btn">${escapeHtml(t.signOut)}</button>
      </div>
      ${legalLinksHtml()}
    `;
  }

  el.innerHTML = `
    <div class="wst-card">
      <div class="wst-head">
        <div class="wst-head-left">
          <div class="wst-row">${badge}</div>
          <h2 class="wst-title">${escapeHtml(heading)}</h2>
        </div>
        <div class="wst-head-actions">
          <button type="button" class="wst-icon-btn" id="wst-lang-btn" aria-label="Switch language">${escapeHtml(t.langToggle)}</button>
          <button type="button" class="wst-icon-btn" id="wst-close-btn" aria-label="${escapeHtml(t.close)}">&times;</button>
        </div>
      </div>
      ${bodyHtml}
    </div>
  `;

  el.hidden = false;

  // Bind common header controls
  el.querySelector("#wst-close-btn")?.addEventListener("click", closeModal);
  el.querySelector("#wst-lang-btn")?.addEventListener("click", () => {
    lang = lang === "en" ? "lo" : "en";
    syncUI();
    renderModal(modalMode);
  });

  // Bind Parent Gate handlers
  if (mode === "signin" && !parentGatePassed) {
    const ansInput = el.querySelector("#wst-gate-ans");
    const errEl = el.querySelector("#wst-gate-err");
    const submitGate = () => {
      const val = Number.parseInt(ansInput.value.trim(), 10);
      if (val === gateChallenge.a + gateChallenge.b) {
        parentGatePassed = true;
        renderModal("signin");
      } else {
        errEl.textContent = COPY[lang].parentWrong;
        errEl.hidden = false;
        ansInput.focus();
      }
    };
    el.querySelector("#wst-gate-submit")?.addEventListener("click", submitGate);
    ansInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitGate();
      }
    });

    // Hold-for-1.5s alternative parent gate
    const holdBtn = el.querySelector("#wst-gate-hold");
    const holdFill = el.querySelector("#wst-hold-fill");
    const holdLabel = el.querySelector("#wst-hold-label");
    let holdTimer = null;
    let holdStart = 0;
    const HOLD_MS = 1500;

    const cancelHold = () => {
      if (holdTimer) {
        cancelAnimationFrame(holdTimer);
        holdTimer = null;
      }
      if (holdFill) holdFill.style.width = "0%";
      if (holdLabel) holdLabel.textContent = COPY[lang].parentHold;
    };

    const startHold = (e) => {
      if (e.type === "keydown" && e.key !== " " && e.key !== "Enter") return;
      if (holdTimer) return;
      holdStart = performance.now();
      if (holdLabel) holdLabel.textContent = COPY[lang].parentHolding;
      const tick = (now) => {
        const pct = Math.min(1, (now - holdStart) / HOLD_MS);
        if (holdFill) holdFill.style.width = `${Math.round(pct * 100)}%`;
        if (pct >= 1) {
          cancelHold();
          parentGatePassed = true;
          renderModal("signin");
          return;
        }
        holdTimer = requestAnimationFrame(tick);
      };
      holdTimer = requestAnimationFrame(tick);
    };

    holdBtn?.addEventListener("pointerdown", startHold);
    holdBtn?.addEventListener("pointerup", cancelHold);
    holdBtn?.addEventListener("pointerleave", cancelHold);
    holdBtn?.addEventListener("pointercancel", cancelHold);
    holdBtn?.addEventListener("keydown", startHold);
    holdBtn?.addEventListener("keyup", cancelHold);
    ansInput?.focus();
    return;
  }

  // Bind Sign-in handlers
  if (mode === "signin") {
    el.querySelector("#wst-oauth-google")?.addEventListener("click", () => signInWithOAuth("google"));
    el.querySelector("#wst-oauth-apple")?.addEventListener("click", () => signInWithOAuth("apple"));
    el.querySelector("#wst-email-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = el.querySelector("#wst-email-input");
      const st = el.querySelector("#wst-modal-status");
      const res = await signInWithEmail(input?.value || "");
      if (!res.ok) {
        st.textContent = res.error;
        st.classList.add("err");
        st.hidden = false;
      } else if (res.message) {
        st.textContent = res.message;
        st.classList.remove("err");
        st.hidden = false;
      }
    });
    return;
  }

  // Bind Membership panel handlers
  el.querySelector("#wst-waitlist-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = el.querySelector("#wst-waitlist-email");
    const st = el.querySelector("#wst-waitlist-status");
    const res = await saveWaitlistEmail(input?.value || "");
    st.textContent = res.ok ? res.message : res.error;
    st.classList.toggle("err", !res.ok);
    st.hidden = false;
  });

  el.querySelector("#wst-buy-monthly")?.addEventListener("click", () => startWebCheckout("monthly"));
  el.querySelector("#wst-buy-yearly")?.addEventListener("click", () => startWebCheckout("yearly"));

  el.querySelector("#wst-demo-toggle")?.addEventListener("click", () => {
    const active = isActiveMembership(state.membership);
    if (active) {
      setMember({ status: "free", source: "web", periodEnd: null });
    } else {
      const nextMonth = new Date(Date.now() + 30 * 86400_000).toISOString();
      setMember({ status: "active", source: "web", periodEnd: nextMonth });
    }
    renderModal("membership");
  });

  el.querySelector("#wst-signout-btn")?.addEventListener("click", signOut);
}

// ---------- Book lock screen (on web/live/index.html) ----------
let lockEl = null;
let cachedBooks = null;

async function getBookTitle(slug) {
  if (!cachedBooks) {
    try {
      const r = await fetch(BOOKS_JSON.href);
      if (r.ok) cachedBooks = (await r.json()).books || [];
    } catch {
      cachedBooks = [];
    }
  }
  const found = (cachedBooks || []).find((b) => b.id === slug);
  if (!found?.title) return formatBookName(slug);
  return found.title.en || formatBookName(slug);
}

async function getBookSubtitle(slug) {
  if (!cachedBooks) await getBookTitle(slug);
  const found = (cachedBooks || []).find((b) => b.id === slug);
  if (lang === "lo" && found?.title?.lo) return found.title.lo;
  return "";
}

async function syncLockScreen() {
  if (!isLiveViewer) return;
  const book = getCurrentBook();
  const unlocked = isBookUnlocked(book);

  if (unlocked) {
    if (lockEl) lockEl.hidden = true;
    return;
  }

  if (!lockEl) {
    lockEl = document.createElement("div");
    lockEl.id = "wst-lock";
    lockEl.className = "wst-overlay";
    lockEl.setAttribute("role", "dialog");
    lockEl.setAttribute("aria-modal", "true");
    document.body.appendChild(lockEl);
  }

  // Keep viewer quiet while locked
  document.querySelectorAll("audio, video").forEach((m) => {
    try {
      m.pause();
    } catch {}
  });

  const t = COPY[lang];
  const titleEn = await getBookTitle(book);
  const subLo = await getBookSubtitle(book);
  const signedIn = !!state.user;

  lockEl.lang = lang;
  lockEl.innerHTML = `
    <div class="wst-card">
      <div class="wst-head">
        <div class="wst-head-actions">
          <button type="button" class="wst-icon-btn" id="wst-lock-lang">${escapeHtml(t.langToggle)}</button>
        </div>
      </div>
      <div class="wst-lock-seal">${ICON_LOCK}</div>
      <div class="wst-row" style="justify-content:center;margin-bottom:8px">
        <span class="wst-badge">${escapeHtml(t.lockedTag)}</span>
        ${isDemo ? `<span class="wst-badge">${escapeHtml(t.demoBadge)}</span>` : ""}
      </div>
      <h2 class="wst-title">${escapeHtml(titleEn)}</h2>
      ${subLo ? `<p style="margin:4px 0 0;color:var(--wst-gold);font-size:17px">${escapeHtml(subLo)}</p>` : ""}
      <p class="wst-sub" style="margin-top:10px">${escapeHtml(signedIn ? t.lockedSubFree : t.lockedSubOut)}</p>
      <div class="wst-stack">
        <button type="button" class="wst-btn primary" id="wst-lock-action">
          ${escapeHtml(signedIn ? t.openMembership : t.signIn)}
        </button>
        <a class="wst-btn" id="wst-lock-kapi" href="?book=kapi&s=s01">${escapeHtml(t.readKapiFree)}</a>
        <a class="wst-btn subtle" href="../landing/library/">${escapeHtml(t.backToLibrary)}</a>
      </div>
      ${legalLinksHtml()}
    </div>
  `;
  lockEl.hidden = false;

  lockEl.querySelector("#wst-lock-lang")?.addEventListener("click", () => {
    lang = lang === "en" ? "lo" : "en";
    syncUI();
  });
  lockEl.querySelector("#wst-lock-action")?.addEventListener("click", () => {
    if (state.user) openMembership();
    else openSignIn();
  });
}

// ---------- Wire top bars on landing and viewer ----------
function wireLandingBar() {
  const footLinks = document.querySelectorAll("footer.imprint .imprint-links a");
  if (footLinks.length) {
    const lt = COPY[lang].legal;
    for (const a of footLinks) {
      const m = (a.getAttribute("href") || "").match(/\/?(membership|terms|privacy|refunds|contact)\.html$/i);
      if (m && lt[m[1].toLowerCase()]) a.textContent = lt[m[1].toLowerCase()];
    }
  }
  const acct = document.querySelector("header.bar .acct");
  if (!acct) return;
  const btns = [...acct.querySelectorAll("button")];
  const t = COPY[lang];
  const memberActive = isActiveMembership(state.membership);

  if (!btns.length) return;
  const [b1, b2] = btns;
  if (b1 && !b1.dataset.origLabel && b1.textContent.trim()) b1.dataset.origLabel = b1.textContent.trim();
  if (b2 && !b2.dataset.origLabel && b2.textContent.trim()) b2.dataset.origLabel = b2.textContent.trim();

  if (state.user) {
    if (b1) {
      b1.removeAttribute("aria-disabled");
      b1.hidden = false;
      b1.classList.toggle("wst-member-pill", memberActive);
      b1.textContent = memberActive ? t.memberBadge : t.membership;
      b1.setAttribute("aria-label", b1.textContent);
      b1.onclick = openMembership;
    }
    if (b2) {
      b2.hidden = true;
    }
  } else {
    if (b1) {
      b1.removeAttribute("aria-disabled");
      b1.hidden = false;
      b1.classList.remove("wst-member-pill");
      b1.textContent = b1.dataset.origLabel || t.signIn;
      b1.setAttribute("aria-label", b1.textContent);
      b1.onclick = openSignIn;
    }
    if (b2) {
      b2.removeAttribute("aria-disabled");
      b2.hidden = false;
      b2.textContent = b2.dataset.origLabel || t.signUp;
      b2.setAttribute("aria-label", b2.textContent);
      b2.onclick = openSignIn;
    }
  }
}

function wireViewerBar() {
  const top = document.getElementById("top");
  if (!top) return;
  let btn = document.getElementById("wst-acct-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "wst-acct-btn";
    btn.type = "button";
    top.appendChild(btn);
  }
  const t = COPY[lang];
  const memberActive = isActiveMembership(state.membership);
  btn.classList.toggle("is-member", memberActive);
  if (state.user) {
    btn.textContent = memberActive ? `★ ${t.memberBadge}` : t.membership;
    btn.setAttribute("aria-label", t.membership);
    btn.onclick = openMembership;
  } else {
    btn.textContent = t.signIn;
    btn.setAttribute("aria-label", t.signIn);
    btn.onclick = openSignIn;
  }
}

function syncUI() {
  wireLandingBar();
  wireViewerBar();
  syncLockScreen();
}

// Initial mount (and re-wire shortly after landing.js finishes populating [data-t])
syncUI();
setTimeout(syncUI, 250);
window.addEventListener("load", syncUI, { once: true });

// Public API for tests, Capacitor apps, and future integrations
window.WstMembers = {
  getState: getPublicState,
  getConfig: () => ({ ...config }),
  isMember: () => isActiveMembership(state.membership),
  isBookUnlocked,
  openSignIn,
  openMembership,
  closeModal,
  signOut,
  setMember,
  getGumroadUrl: buildGumroadUrl,
  startWebCheckout,
  startStoreBilling,
  setLang: (l) => {
    if (l === "en" || l === "lo") {
      lang = l;
      syncUI();
      if (modalMode) renderModal(modalMode);
    }
  },
  onChange: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
