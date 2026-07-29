import { Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export interface CardDefinition {
  id: string;
  name: string;
  bank: string;
  network: 'VISA' | 'Mastercard' | 'RuPay' | 'Amex';
  annualFee: number;
  annualFeeWaiver?: number;
  joiningFee: number;
  lifetimeFree: boolean;
  rewardRate: number;
  rewardType: 'cashback' | 'points' | 'monies';
  pointValue: number; // ₹ value of 1 point/monies
  categories: CardCategoryRule[];
  caps: CardCap[];
  exclusions: string[];
  fuelSurchargeWaiver: string;
  forexMarkup: number;
  welcomeBonus: string;
  notes: string;
}

export interface CardCategoryRule {
  name: string;
  rate: number; // percentage (5 = 5%)
  mccCodes?: string[];
  merchants?: string[];
  keywords?: string[];
  monthlyCap?: number; // ₹ value
  comment?: string;
}

export interface CardCap {
  category: string;
  maxAmount: number;
  period: 'monthly' | 'statement';
}

// MCC codes reference: https://github.com/greggles/mcc-codes
const MCC = {
  GROCERY: ['5411', '5422', '5451', '5462', '5499'],
  DINING: ['5812', '5813', '5814'],
  FUEL: ['1361', '3851', '5172', '5541', '5542', '5983', '9752', '5555'],
  UTILITY: ['4812', '4814', '4816', '4899', '4900', '4901', '4902', '9399', '5960'],
  RENT: ['6513', '7014', '7407', '5271', '7349'],
  INSURANCE: ['5960', '6300', '6381', '6399'],
  WALLET: ['6540', '6541'],
  EDUCATION: ['5111', '5192', '5942', '5943', '8211', '8220', '8241', '8244', '8249', '8299', '8351'],
  JEWELRY: ['5051', '5094', '7631', '5944'],
  DEPARTMENT: ['5311'],
  MOVIES: ['7832'],
  ENTERTAINMENT: ['7922', '7929', '7932', '7933', '7991', '7996', '7997', '7998', '7999'],
  TRANSPORT: ['4011', '4111', '4112', '4121', '4131', '4784', '4789'],
  GOVERNMENT: ['9222', '9311', '9399', '9402'],
  TELECOM: ['4812', '4814'],
  FASTAG: [], // No standard MCC — handled by gateway
};

export function isFuelMCC(mcc: string): boolean { return MCC.FUEL.includes(mcc); }
export function isGroceryMCC(mcc: string): boolean { return MCC.GROCERY.includes(mcc); }
export function isDiningMCC(mcc: string): boolean { return MCC.DINING.includes(mcc); }
export function isUtilityMCC(mcc: string): boolean { return MCC.UTILITY.includes(mcc); }
export function isRentMCC(mcc: string): boolean { return MCC.RENT.includes(mcc); }
export function isInsuranceMCC(mcc: string): boolean { return MCC.INSURANCE.includes(mcc); }
export function isWalletMCC(mcc: string): boolean { return MCC.WALLET.includes(mcc); }
export function isEducationMCC(mcc: string): boolean { return MCC.EDUCATION.includes(mcc); }
export function isJewelryMCC(mcc: string): boolean { return MCC.JEWELRY.includes(mcc); }
export function isDepartmentMCC(mcc: string): boolean { return MCC.DEPARTMENT.includes(mcc); }
export function isMovieMCC(mcc: string): boolean { return MCC.MOVIES.includes(mcc); }

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    id: 'sbi-cashback',
    name: 'SBI Cashback Card',
    bank: 'SBI',
    network: 'VISA',
    annualFee: 999,
    annualFeeWaiver: 200000,
    joiningFee: 999,
    lifetimeFree: false,
    rewardRate: 5,
    rewardType: 'cashback',
    pointValue: 1,
    categories: [
      { name: 'Online Spends', rate: 5, monthlyCap: 2000, comment: '5% cashback on all online spends' },
      { name: 'Offline Spends', rate: 1, monthlyCap: 2000, comment: '1% cashback on all offline spends' },
    ],
    caps: [
      { category: 'Online', maxAmount: 2000, period: 'monthly' },
      { category: 'Offline', maxAmount: 2000, period: 'monthly' },
    ],
    exclusions: [
      ...MCC.FUEL, ...MCC.WALLET, ...MCC.RENT, ...MCC.JEWELRY,
      ...MCC.EDUCATION, ...MCC.UTILITY, ...MCC.INSURANCE,
      '5947', '4011', '4112', '6011', '6012', '6051',
      '7993', '7994', '5816', '4784', '9222', '9311', '9402',
    ],
    fuelSurchargeWaiver: '1% up to ₹100/month (tx ₹500-₹3,000)',
    forexMarkup: 3.5,
    welcomeBonus: 'None',
    notes: 'Best for ALL online shopping. No 5% on fuel, wallet, rent, utility, insurance, education.',
  },
  {
    id: 'sbi-simplysave',
    name: 'SBI SimplySAVE',
    bank: 'SBI',
    network: 'RuPay',
    annualFee: 499,
    annualFeeWaiver: 100000,
    joiningFee: 499,
    lifetimeFree: false,
    rewardRate: 0.25,
    rewardType: 'points',
    pointValue: 0.25,
    categories: [
      { name: 'Dining', rate: 2.5, mccCodes: MCC.DINING, monthlyCap: 1250, comment: '10X = 10 RP/₹150 ≈ 2.5%' },
      { name: 'Grocery', rate: 2.5, mccCodes: MCC.GROCERY, monthlyCap: 1250, comment: '10X on Grocery & Supermarkets' },
      { name: 'Movies', rate: 2.5, mccCodes: MCC.MOVIES, monthlyCap: 1250, comment: '10X on Movie theatres' },
      { name: 'Department', rate: 2.5, mccCodes: MCC.DEPARTMENT, monthlyCap: 1250, comment: '10X on Department Stores' },
      { name: 'Other Spends', rate: 0.25, comment: '1 RP/₹150 = 0.25%' },
    ],
    caps: [
      { category: '10X Bonus', maxAmount: 5000, period: 'monthly' },
    ],
    exclusions: [...MCC.FUEL],
    fuelSurchargeWaiver: '1% up to ₹100/month (tx ₹500-₹3,000)',
    forexMarkup: 3.5,
    welcomeBonus: '2,000 RP on ₹2,000 spend in 60 days',
    notes: '10X on Dining, Movies, Grocery & Department Stores. Points expire in 24 months.',
  },
  {
    id: 'idfc-power-plus',
    name: 'IDFC Power+',
    bank: 'IDFC FIRST',
    network: 'RuPay',
    annualFee: 499,
    annualFeeWaiver: 50000,
    joiningFee: 499,
    lifetimeFree: false,
    rewardRate: 0.5,
    rewardType: 'points',
    pointValue: 0.25,
    categories: [
      { name: 'HPCL Fuel', rate: 5.42, merchants: ['HPCL', 'HP Pay'], mccCodes: MCC.FUEL, monthlyCap: 650, comment: '5% rewards - 1.08% surcharge + 1.5% Happy Coins = 5.42% net via HP Pay' },
      { name: 'Grocery & Utility', rate: 5, mccCodes: [...MCC.GROCERY, ...MCC.UTILITY], monthlyCap: 100, comment: '30X RP on Grocery & Utility' },
      { name: 'IDFC FASTag', rate: 5, keywords: ['FASTag', 'fastag'], monthlyCap: 50, comment: '30X RP on IDFC FASTag recharge' },
      { name: 'Other Retail', rate: 0.5, comment: '3X RP on other retail spends' },
      { name: 'UPI Spends', rate: 0.5, comment: '3X RP on UPI spends' },
    ],
    caps: [
      { category: 'Fuel', maxAmount: 12000, period: 'statement' },
      { category: 'Grocery & Utility', maxAmount: 2000, period: 'statement' },
      { category: 'FASTag', maxAmount: 1000, period: 'statement' },
    ],
    exclusions: ['Insurance', 'EMI', 'Cash Advance'],
    fuelSurchargeWaiver: 'Standard 1% fuel surcharge waiver',
    forexMarkup: 0,
    welcomeBonus: 'None',
    notes: 'Best fuel card. Requires HP Pay App for full 6.5% benefit. Works only at authorized HPCL stations.',
  },
  {
    id: 'amazon-pay-icici',
    name: 'Amazon Pay ICICI',
    bank: 'ICICI',
    network: 'VISA',
    annualFee: 0,
    annualFeeWaiver: 0,
    joiningFee: 0,
    lifetimeFree: true,
    rewardRate: 1,
    rewardType: 'cashback',
    pointValue: 1,
    categories: [
      { name: 'Amazon (Prime)', rate: 5, merchants: ['AMAZON', 'Amazon.in', 'Amazon Pay'], comment: '5% for Amazon Prime members' },
      { name: 'Amazon (Non-Prime)', rate: 3, merchants: ['AMAZON', 'Amazon.in', 'Amazon Pay'], comment: '3% for non-Prime members' },
      { name: 'Partner Merchants', rate: 2, merchants: ['Swiggy', 'Zomato', 'Flipkart', 'Myntra', 'BookMyShow', 'Uber', 'Ola', 'Swiggy Instamart', 'Amazon Fresh'], comment: '2% on eligible partner merchants' },
      { name: 'Other Spends', rate: 1, comment: '1% on all other spends' },
    ],
    caps: [],
    exclusions: ['Fuel > ₹10,000', 'Utility > ₹50,000', 'Rent', 'Wallet Load', 'Education via 3rd party'],
    fuelSurchargeWaiver: '1% on all petrol pumps',
    forexMarkup: 3.5,
    welcomeBonus: 'No joining or annual fee (LTF)',
    notes: 'Lifetime free. Best for Amazon shoppers. No minimum spend for cashback. Cashback as Amazon Pay balance.',
  },
  {
    id: 'hsbc-platinum',
    name: 'HSBC Platinum RuPay',
    bank: 'HSBC',
    network: 'RuPay',
    annualFee: 0,
    annualFeeWaiver: 0,
    joiningFee: 0,
    lifetimeFree: true,
    rewardRate: 0,
    rewardType: 'cashback',
    pointValue: 0,
    categories: [
      { name: 'No Rewards', rate: 0, comment: 'No rewards on any spends' },
    ],
    caps: [],
    exclusions: [],
    fuelSurchargeWaiver: 'None',
    forexMarkup: 3.5,
    welcomeBonus: 'Lifetime Free (₹0 annual fee)',
    notes: 'No rewards. Namesake card only — not recommended for any spend.',
  },
  {
    id: 'cred-indusind',
    name: 'CRED IndusInd',
    bank: 'IndusInd',
    network: 'RuPay',
    annualFee: 499,
    annualFeeWaiver: 0,
    joiningFee: 0,
    lifetimeFree: false,
    rewardRate: 1,
    rewardType: 'points',
    pointValue: 0.25,
    categories: [
      { name: 'All Spends', rate: 1, comment: '1% reward on spend (reward redemption fee waived)' },
    ],
    caps: [],
    exclusions: ['Fuel > ₹30,000/cycle', 'Utility > ₹25,000', 'Wallet > ₹20,000', 'Rent'],
    fuelSurchargeWaiver: '1% fuel surcharge waiver',
    forexMarkup: 3.5,
    welcomeBonus: 'No joining fee',
    notes: 'CRED partnership card. UPI-linked RuPay. Reward redemption fee exempt for CRED users.',
  },
  {
    id: 'slice',
    name: 'Slice Card',
    bank: 'Slice / RBL',
    network: 'RuPay',
    annualFee: 0,
    annualFeeWaiver: 0,
    joiningFee: 0,
    lifetimeFree: true,
    rewardRate: 1,
    rewardType: 'monies',
    pointValue: 0.25,
    categories: [
      { name: 'UPI & Card Spends', rate: 1, comment: '1 monies per ₹1 on eligible tx' },
    ],
    caps: [],
    exclusions: ['EMI', 'Wallet load', 'Fuel', 'Insurance', 'Rent', 'Education', 'Taxes', 'Government', 'Gaming', 'International'],
    fuelSurchargeWaiver: 'None',
    forexMarkup: 0,
    welcomeBonus: 'Lifetime free',
    notes: 'UPI + card combo. Monies redeemable to Slice savings account. No forex markup.',
  },
  {
    id: 'load-card',
    name: 'Load Card',
    bank: 'Other',
    network: 'VISA',
    annualFee: 0,
    annualFeeWaiver: 0,
    joiningFee: 0,
    lifetimeFree: true,
    rewardRate: 1,
    rewardType: 'cashback',
    pointValue: 1,
    categories: [
      { name: 'All Spends', rate: 1, comment: '1% on all spends' },
    ],
    caps: [],
    exclusions: ['Fuel', 'Wallet load'],
    fuelSurchargeWaiver: 'None',
    forexMarkup: 3.5,
    welcomeBonus: 'Lifetime free',
    notes: 'Generic Load card. 1% flat cashback.',
  },
];

export function getCardById(id: string): CardDefinition | undefined {
  return CARD_DEFINITIONS.find(c => c.id === id);
}

export function getCardsByBank(bank: string): CardDefinition[] {
  return CARD_DEFINITIONS.filter(c => c.bank.toLowerCase().includes(bank.toLowerCase()));
}

export const PREDEFINED_CARD_IDS = CARD_DEFINITIONS.map(c => c.id);
