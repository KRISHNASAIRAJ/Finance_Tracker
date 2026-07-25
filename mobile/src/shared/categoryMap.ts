import { Ionicons } from "@expo/vector-icons";

export interface Category {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const EXPENSE_CATEGORIES: Category[] = [
  { name: "Food & Dining",       icon: "restaurant-outline",          color: "#f87171" },
  { name: "Grocery",             icon: "basket-outline",              color: "#4ade80" },
  { name: "Fuel",                icon: "speedometer-outline",         color: "#fb923c" },
  { name: "Travel",              icon: "airplane-outline",            color: "#60a5fa" },
  { name: "Shopping",            icon: "bag-outline",                 color: "#c084fc" },
  { name: "Bills & Recharge",    icon: "receipt-outline",             color: "#fbbf24" },
  { name: "Rent",                icon: "home-outline",                color: "#38bdf8" },
  { name: "EMI",                 icon: "repeat-outline",              color: "#a78bfa" },
  { name: "Entertainment",       icon: "film-outline",                color: "#f472b6" },
  { name: "OTT",                 icon: "tv-outline",                  color: "#e879f9" },
  { name: "Youtube Premium",     icon: "logo-youtube",                color: "#ef4444" },
  { name: "Education",           icon: "school-outline",              color: "#22d3ee" },
  { name: "Medical",             icon: "medkit-outline",              color: "#34d399" },
  { name: "Health & Wellness",   icon: "fitness-outline",             color: "#2dd4bf" },
  { name: "Insurance",           icon: "shield-checkmark-outline",    color: "#818cf8" },
  { name: "SIP",                 icon: "trending-up-outline",         color: "#06b6d4" },
  { name: "Equity Investment",   icon: "bar-chart-outline",           color: "#0ea5e9" },
  { name: "Card Annual Charges", icon: "card-outline",                color: "#8b5cf6" },
  { name: "Interest",            icon: "calculator-outline",          color: "#facc15" },
  { name: "Family",              icon: "heart-outline",               color: "#fb7185" },
  { name: "Friends",             icon: "people-outline",              color: "#14b8a6" },
  { name: "Cash Withdrawal",     icon: "cash-outline",                color: "#d97706" },
  { name: "Wallet Loads",        icon: "wallet-outline",              color: "#7c3aed" },
  { name: "Professional Service",icon: "briefcase-outline",           color: "#f97316" },
  { name: "Others",              icon: "ellipsis-horizontal-outline", color: "#d946ef" },
];

export const INCOME_CATEGORIES: Category[] = [
  { name: "Salary", icon: "cash-outline", color: "#22c55e" },
  { name: "Freelance", icon: "briefcase-outline", color: "#10b981" },
  { name: "Investment", icon: "trending-up-outline", color: "#06b6d4" },
  { name: "Others", icon: "ellipsis-horizontal-outline", color: "#64748b" },
];

export function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  const name = category.toLowerCase().trim();
  const found =
    EXPENSE_CATEGORIES.find((c) => c.name.toLowerCase() === name) ??
    INCOME_CATEGORIES.find((c) => c.name.toLowerCase() === name);
  return found ? found.icon : "receipt-outline";
}

const PALETTE = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635',
  '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8',
  '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9',
  '#f472b6', '#fb7185', '#ef4444', '#d97706', '#f97316',
  '#0ea5e9', '#06b6d4', '#14b8a6', '#8b5cf6', '#d946ef',
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCategoryColor(category: string, isIncome?: boolean): string {
  const name = category.toLowerCase().trim();
  const list = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const found = list.find((c) => c.name.toLowerCase() === name);
  if (found) return found.color;
  // Handle "Other" → "Others" alias
  if (!isIncome && name === 'other') {
    const others = list.find((c) => c.name.toLowerCase() === 'others');
    if (others) return others.color;
  }
  // Hash-based fallback for unknown categories
  return PALETTE[hashString(name) % PALETTE.length];
}

export function autoDetectCategory(text: string, type: "expense" | "income"): string {
  const n = text.toLowerCase().trim();
  if (!n) return type === "expense" ? "Others" : "Others";

  if (type === "income") {
    if (n.includes("salary") || n.includes("paycheck")) return "Salary";
    if (n.includes("freelance") || n.includes("project") || n.includes("consulting")) return "Freelance";
    return "Others";
  }

  if (n.includes("instamart") || n.includes("zepto") || n.includes("blinkit") || n.includes("bigbasket") ||
    n.includes("amazonnow") || n.includes("grocery") || n.includes("kirana") ||
    n.includes("vegetables") || n.includes("market"))
    return "Grocery";

  if (
    n.includes("swiggy") || n.includes("zomato") || n.includes("restaurant") || n.includes("food") ||
    n.includes("pizza") || n.includes("burger") || n.includes("cafe") || n.includes("tiffin") ||
    n.includes("lunch") || n.includes("dinner") || n.includes("breakfast") ||
    n.includes("dosa") || n.includes("biryani") || n.includes("idly") || n.includes("chapati") || n.includes("rice")
  )
    return "Food & Dining";

  if (n.includes("petrol") || n.includes("fuel") || n.includes("diesel") || n.includes("hp") ||
    n.includes("bpcl") || n.includes("ioc"))
    return "Fuel";

  if (n.includes("rent") || n.includes("pg") || n.includes("apartment") || n.includes("flat"))
    return "Rent";

  if (n.includes("amazon") || n.includes("flipkart") || n.includes("myntra") || n.includes("shopping") ||
    n.includes("mall") || n.includes("fashion"))
    return "Shopping";

  if (n.includes("sip") || n.includes("mutual fund") || n.includes("mf"))
    return "SIP";

  if (n.includes("equity") || n.includes("stock") || n.includes("share") || n.includes("zerodha") ||
      n.includes("kite") || n.includes("nse") || n.includes("bse"))
    return "Equity Investment";

  if (n.includes("netflix") || n.includes("prime") || n.includes("hotstar") || n.includes("zee5") ||
      n.includes("sonyliv") || n.includes("jio cinema") || n.includes("ott"))
    return "OTT";

  if (n.includes("youtube"))
    return "Youtube Premium";

  if (n.includes("electricity") || n.includes("mobile") || n.includes("broadband") || n.includes("recharge") ||
      n.includes("bill") || n.includes("postpaid"))
    return "Bills & Recharge";

  if (n.includes("emi") || n.includes("loan"))
    return "EMI";

  if (n.includes("doctor") || n.includes("hospital") || n.includes("medicine") || n.includes("pharmacy") ||
      n.includes("clinic"))
    return "Medical";

  if (n.includes("gym") || n.includes("health") || n.includes("wellness") || n.includes("yoga"))
    return "Health & Wellness";

  if (n.includes("insurance") || n.includes("lic") || n.includes("policy"))
    return "Insurance";

  if (n.includes("travel") || n.includes("flight") || n.includes("train") || n.includes("bus") ||
      n.includes("irctc") || n.includes("rapido") || n.includes("ola") || n.includes("uber") ||
      n.includes("metro"))
    return "Travel";

  if (n.includes("movie") || n.includes("bookmyshow") || n.includes("pvr") || n.includes("inox") ||
      n.includes("entertainment"))
    return "Entertainment";

  if (n.includes("card") && (n.includes("annual") || n.includes("fee") || n.includes("charge")))
    return "Card Annual Charges";

  if (n.includes("education") || n.includes("course") || n.includes("udemy") || n.includes("book") ||
      n.includes("school") || n.includes("college"))
    return "Education";

  if (n.includes("atm") || n.includes("withdraw") || n.includes("cash"))
    return "Cash Withdrawal";

  if (n.includes("paytm") || n.includes("phonepe") || n.includes("gpay") || n.includes("wallet") || n.includes("payzapp") || n.includes("pazapp"))
    return "Wallet Loads";

  if (n.includes("cleaning") || n.includes("plumbing") || n.includes("electrician") || n.includes("repair"))
    return "Professional Service";

  return "Others";
}
