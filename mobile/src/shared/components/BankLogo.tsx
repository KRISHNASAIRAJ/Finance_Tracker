/**
 * BankLogo — brand-colored initial badge for Indian banks.
 * Matches banks by name keywords; falls back to a neutral badge.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BankStyle {
  bg: string;
  fg: string;
  short: string;
}

const BANK_STYLES: Array<{ keys: string[]; style: BankStyle }> = [
  { keys: ['sbi', 'state bank'], style: { bg: '#1D4E89', fg: '#FFFFFF', short: 'SBI' } },
  { keys: ['hdfc'], style: { bg: '#004C8F', fg: '#FFFFFF', short: 'HDFC' } },
  { keys: ['icici'], style: { bg: '#F58220', fg: '#FFFFFF', short: 'ICICI' } },
  { keys: ['axis'], style: { bg: '#97144D', fg: '#FFFFFF', short: 'AXIS' } },
  { keys: ['kotak'], style: { bg: '#ED1C24', fg: '#FFFFFF', short: 'KOTAK' } },
  { keys: ['pnb', 'punjab national'], style: { bg: '#C89B3C', fg: '#FFFFFF', short: 'PNB' } },
  { keys: ['bob', 'baroda'], style: { bg: '#00529B', fg: '#F7B500', short: 'BOB' } },
  { keys: ['canara'], style: { bg: '#1E7F5B', fg: '#FFFFFF', short: 'CANARA' } },
  { keys: ['idfc'], style: { bg: '#2D2A4A', fg: '#00A3E0', short: 'IDFC' } },
  { keys: ['indusind'], style: { bg: '#4B286D', fg: '#FFFFFF', short: 'INDUS' } },
  { keys: ['union'], style: { bg: '#E11B22', fg: '#FFFFFF', short: 'UNION' } },
  { keys: ['yes'], style: { bg: '#1B1B1B', fg: '#FFFFFF', short: 'YES' } },
  { keys: ['paytm'], style: { bg: '#00AEEF', fg: '#FFFFFF', short: 'PAYTM' } },
  { keys: ['payzapp', 'pay zapp'], style: { bg: '#002244', fg: '#00B9F5', short: 'PZ' } },
  { keys: ['hsbc'], style: { bg: '#DB0011', fg: '#FFFFFF', short: 'HSBC' } },
  { keys: ['slice'], style: { bg: '#FF2D9E', fg: '#FFFFFF', short: 'SLICE' } },
  { keys: ['upi', 'gpay', 'google pay', 'phonepe', 'phone pe', 'wallet', 'cash'], style: { bg: 'rgba(255,255,255,0.12)', fg: '#FFFFFF', short: 'U' } },
];

function getBankStyle(title: string): BankStyle {
  const lower = title.toLowerCase();
  for (const entry of BANK_STYLES) {
    if (entry.keys.some((k) => lower.includes(k))) {
      return entry.style;
    }
  }
  const initials = title
    .split(/[\s&.-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return {
    bg: 'rgba(255,255,255,0.12)',
    fg: '#FFFFFF',
    short: initials || 'BK',
  };
}

interface BankLogoProps {
  title: string;
  size?: number;
}

export default function BankLogo({ title, size = 32 }: BankLogoProps) {
  const style = getBankStyle(title);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: style.bg,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.text, { color: style.fg, fontSize: size * 0.28 }]} numberOfLines={1}>
        {style.short}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
