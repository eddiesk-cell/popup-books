// Shared helper for web/landing/legal/* pages:
// - Reads configurable prices, payments mode, and supportEmail from web/members/config.json
// - Syncs English / Lao toggle with wst-lang / ?lang=

const CONFIG_URL = new URL("../../members/config.json", import.meta.url);

function getInitialLang() {
  const qs = new URLSearchParams(location.search).get("lang");
  if (qs === "lo" || qs === "en") return qs;
  try {
    if (localStorage.getItem("wst-lang") === "lo") return "lo";
  } catch {}
  return "en";
}

function setLang(next) {
  const lang = next === "lo" ? "lo" : "en";
  document.documentElement.lang = lang;
  try {
    localStorage.setItem("wst-lang", lang);
  } catch {}
  const btn = document.getElementById("legal-lang-toggle");
  if (btn) btn.textContent = lang === "en" ? "ລາວ" : "English";
  renderConfigValues();
}

let cfg = {
  payments: "off",
  supportEmail: "support@tales.gurulao.com",
  plans: {
    monthly: { price: "", period: "month" },
    yearly: { price: "", period: "year" },
  },
};

try {
  const res = await fetch(CONFIG_URL.href, { cache: "no-cache" });
  if (res.ok) {
    const data = await res.json();
    cfg = { ...cfg, ...data, plans: { ...cfg.plans, ...(data.plans || {}) } };
  }
} catch {}

function renderConfigValues() {
  const lang = document.documentElement.lang === "lo" ? "lo" : "en";
  const soon = lang === "lo" ? "ລາຄາໄວໆນີ້" : "Price coming soon";
  const mPrice = cfg.plans?.monthly?.price || soon;
  const yPrice = cfg.plans?.yearly?.price || soon;
  const email = cfg.supportEmail || "support@tales.gurulao.com";

  document.querySelectorAll("[data-cfg='monthly-price']").forEach((el) => {
    el.textContent = mPrice;
  });
  document.querySelectorAll("[data-cfg='yearly-price']").forEach((el) => {
    el.textContent = yPrice;
  });
  document.querySelectorAll("[data-cfg='support-email']").forEach((el) => {
    el.textContent = email;
    if (el.tagName === "A") el.setAttribute("href", `mailto:${email}`);
  });
}

const langBtn = document.getElementById("legal-lang-toggle");
if (langBtn) {
  langBtn.addEventListener("click", () => {
    setLang(document.documentElement.lang === "lo" ? "en" : "lo");
  });
}

document.querySelectorAll("[data-open-membership]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (window.WstMembers) {
      const s = window.WstMembers.getState();
      if (s.user) window.WstMembers.openMembership();
      else window.WstMembers.openSignIn();
    }
  });
});

setLang(getInitialLang());
