/**
 * CardEngine — credit-card recommendation engine: picks the best card for a
 * spend based on category, MCC, reward rates and caps.
 */
import {
  CardDefinition,
  CARD_DEFINITIONS,
  isFuelMCC,
  isGroceryMCC,
  isDiningMCC,
  isUtilityMCC,
  isRentMCC,
  isInsuranceMCC,
  isWalletMCC,
  isEducationMCC,
  isJewelryMCC,
  isDepartmentMCC,
  isMovieMCC,
} from './cardData';

export interface CardRecommendation {
  card: CardDefinition;
  effectiveRate: number;
  estimatedCashback: number;
  capWarning?: string;
  matchedCategory: string;
  reason: string;
}

export interface SuggestionInput {
  amount: number;
  mcc?: string;
  storeName?: string;
  isOnline?: boolean;
  isUpi?: boolean;
  haveAmazonPrime?: boolean;
}

const KNOWN_ONLINE_MERCHANTS = [
  'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa',
  'zepto', 'blinkit', 'bigbasket', 'swiggy instamart',
  'swiggy', 'zomato', 'bookmyshow', 'paytm', 'uber', 'ola',
  'netflix', 'spotify', 'youtube', 'google', 'microsoft',
  'makemytrip', 'goibibo', 'ixigo', 'easemytrip',
  'dominos', 'pizzahut', 'tatacliq', 'croma',
  'adidas', 'nike', 'puma', 'zara',
  'mmt', 'urban company', 'pharmeasy', '1mg',
  'rapido', 'dunzo', 'licious',
];

function isKnownOnlineMerchant(store: string): boolean {
  return KNOWN_ONLINE_MERCHANTS.some(m => store.includes(m));
}

export function recommendCards(input: SuggestionInput): CardRecommendation[] {
  const { amount, mcc, storeName, isOnline, isUpi, haveAmazonPrime } = input;
  const store = (storeName || '').toLowerCase();
  const effectiveOnline = isOnline ?? isKnownOnlineMerchant(store);

  // UPI: only RuPay cards are eligible
  let eligibleCards = CARD_DEFINITIONS;
  if (isUpi) {
    eligibleCards = CARD_DEFINITIONS.filter(c => c.network === 'RuPay');
  }

  const results: CardRecommendation[] = [];
  for (const card of eligibleCards) {
    // Check exclusions first
    if (isExcluded(card, mcc, store)) {
      results.push({
        card,
        effectiveRate: 0,
        estimatedCashback: 0,
        capWarning: 'Transaction excluded from rewards',
        matchedCategory: 'Excluded',
        reason: `${card.name} does not earn rewards on this category.`,
      });
      continue;
    }

    let bestRate = 0;
    let matchedCategory = 'Other';
    let reason = '';

    for (const cat of card.categories) {
      let matches = cat.mccCodes?.includes(mcc || '') || false;

      if (!matches && cat.merchants) {
        matches = cat.merchants.some(m => store.includes(m.toLowerCase()));
      }

      if (!matches && cat.keywords) {
        matches = cat.keywords.some(k => store.includes(k.toLowerCase()));
      }

      if (!matches && mcc) {
        if (cat.name.toLowerCase().includes('fuel') && isFuelMCC(mcc)) matches = true;
        if (cat.name.toLowerCase().includes('grocery') && isGroceryMCC(mcc)) matches = true;
        if (cat.name.toLowerCase().includes('dining') && isDiningMCC(mcc)) matches = true;
        if (cat.name.toLowerCase().includes('utility') && isUtilityMCC(mcc)) matches = true;
        if (cat.name.toLowerCase().includes('department') && isDepartmentMCC(mcc)) matches = true;
        if (cat.name.toLowerCase().includes('movies') && isMovieMCC(mcc)) matches = true;
      }

      // Amazon-specific logic
      if (!matches && cat.name.toLowerCase().includes('amazon') && store.includes('amazon')) {
        if (haveAmazonPrime && cat.name.includes('Prime')) {
          bestRate = cat.rate; matchedCategory = cat.name;
          reason = '5% Amazon Pay cashback (Prime member)';
        } else if (!haveAmazonPrime && cat.name.includes('Non-Prime')) {
          bestRate = cat.rate; matchedCategory = cat.name;
          reason = '3% Amazon Pay cashback';
        } else {
          bestRate = cat.rate; matchedCategory = cat.name;
          reason = `${cat.rate}% at Amazon`;
        }
        matches = true;
      }

      // Online/Offline for SBI Cashback
      if (!matches && card.id === 'sbi-cashback') {
        if (effectiveOnline && cat.name.includes('Online')) {
          bestRate = cat.rate; matchedCategory = cat.name;
          reason = '5% cashback on online spends';
          matches = true;
        } else if (!effectiveOnline && cat.name.includes('Offline')) {
          bestRate = cat.rate; matchedCategory = cat.name;
          reason = '1% cashback on offline spends';
          matches = true;
        }
      }

      // UPI-specific matching
      if (!matches && isUpi && cat.name.toLowerCase().includes('upi')) {
        bestRate = cat.rate; matchedCategory = cat.name;
        reason = cat.comment || `${cat.rate}% on UPI spends`;
        matches = true;
      }

      if (matches && cat.rate > bestRate) {
        bestRate = cat.rate;
        matchedCategory = cat.name;
        reason = cat.comment || `${cat.rate}% on ${cat.name}`;
      }
    }

    // Default catch-all
    if (bestRate === 0 && card.categories.length > 0) {
      const general = card.categories[card.categories.length - 1];
      if (general.name.includes('Other') || general.name.includes('All') || general.name.includes('Retail') || general.name.includes('UPI')) {
        bestRate = general.rate;
        matchedCategory = general.name;
        reason = general.comment || `${general.rate}% flat rate`;
      }
    }

    let capWarning: string | undefined;
    const cap = card.caps.find(c =>
      c.category.toLowerCase().includes(matchedCategory.toLowerCase()) ||
      matchedCategory.toLowerCase().includes(c.category.toLowerCase())
    );
    if (cap && amount > cap.maxAmount * 100) {
      capWarning = `Cap: ₹${cap.maxAmount}/cycle`;
    }

    const estimatedCashback = Math.round(amount * bestRate / 100);
    results.push({ card, effectiveRate: bestRate, estimatedCashback, capWarning, matchedCategory, reason });
  }

  results.sort((a, b) => b.estimatedCashback - a.estimatedCashback || b.effectiveRate - a.effectiveRate);
  return results;
}

function isExcluded(card: CardDefinition, mcc?: string, store?: string): boolean {
  if (!mcc && !store) return false;
  const mccStr = mcc || '';
  const storeStr = (store || '').toLowerCase();

  for (const excl of card.exclusions) {
    const el = excl.toLowerCase();
    if (mccStr && mccStr === excl) return true;
    if (storeStr && el.includes(storeStr)) return true;
  }

  if (mccStr) {
    const exclusions = card.exclusions.map(e => e.toLowerCase()).join(' ');
    if (isFuelMCC(mccStr) && exclusions.includes('fuel')) return true;
    if (isRentMCC(mccStr) && exclusions.includes('rent')) return true;
    if (isWalletMCC(mccStr) && exclusions.includes('wallet')) return true;
    if (isInsuranceMCC(mccStr) && exclusions.includes('insurance')) return true;
    if (isEducationMCC(mccStr) && exclusions.includes('education')) return true;
    if (isJewelryMCC(mccStr) && exclusions.includes('jewelry')) return true;
  }

  return false;
}
