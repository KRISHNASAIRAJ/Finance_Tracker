/**
 * CardBrandLogo — brand-styled logo for card networks
 * (VISA, Mastercard, RuPay, Amex). Falls back to a neutral pill.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CardBrandLogoProps {
  network: string;
  size?: number;
}

export default function CardBrandLogo({ network, size = 40 }: CardBrandLogoProps) {
  const n = (network || '').toLowerCase();

  if (n === 'visa') {
    return (
      <View style={[styles.visa, { height: size * 0.62, borderRadius: size * 0.12 }]}>
        <Text style={[styles.visaText, { fontSize: size * 0.42 }]}>VISA</Text>
      </View>
    );
  }

  if (n === 'mastercard' || n === 'master card' || n === 'mc') {
    return (
      <View style={[styles.mastercard, { width: size * 1.15, height: size * 0.7 }]}>
        <View style={[styles.mcCircle, { backgroundColor: '#EB001B', left: 0 }]} />
        <View style={[styles.mcCircle, { backgroundColor: '#F79E1B', right: 0 }]} />
      </View>
    );
  }

  if (n === 'rupay') {
    return (
      <View style={[styles.rupay, { height: size * 0.6, borderRadius: size * 0.12 }]}>
        <Text style={[styles.rupayText, { fontSize: size * 0.36 }]}>RuPay</Text>
      </View>
    );
  }

  if (n === 'amex' || n === 'american express') {
    return (
      <View style={[styles.amex, { height: size * 0.6, borderRadius: size * 0.12 }]}>
        <Text style={[styles.amexText, { fontSize: size * 0.34 }]}>AMEX</Text>
      </View>
    );
  }

  return (
    <View style={[styles.fallback, { height: size * 0.6 }]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.28 }]}>{network || 'CARD'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  visa: {
    backgroundColor: '#1A1F71',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  visaText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  mastercard: {
    flexDirection: 'row',
    position: 'relative',
  },
  mcCircle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '64%',
    borderRadius: 999,
    opacity: 0.9,
  },
  rupay: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  rupayText: {
    color: '#F26522',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  amex: {
    backgroundColor: '#006FCF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  amexText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1,
  },
  fallback: {
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
