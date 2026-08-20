/**
 * WelcomeSplashScreen — Branded onboarding splash with glassmorphic hero and entry CTA.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';

const { width } = Dimensions.get('window');

export default function WelcomeSplashScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient Violet Radial Glow via absolute views */}
      <View style={styles.ambientGlow} />

      <View style={styles.content}>
        {/* Brand Logo in Glassmorphic Wrapper */}
        <View style={styles.logoWrapper}>
          <LinearGradient
            colors={['rgba(124, 58, 237, 0.2)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <Svg width={64} height={64} viewBox="0 0 24 24" fill="currentColor">
            {/* Abstract M shape */}
            <Path d="M12 2L2 22h20L12 2zm0 4.5l5.5 11h-11L12 6.5z" opacity={0.4} color={colors.primary} />
            <Path d="M12 8l-3.5 7h7L12 8z" color={colors.primary} />
          </Svg>
        </View>

        {/* Title */}
        <Text style={styles.title}>Meridian</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Your life, unified. Finance, Garage, Tasks, and more.
        </Text>
      </View>

      {/* Get Started Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('NameEntry')}
        >
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.1)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onSurface} style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: (width * 1.5) / 2,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    transform: [{ scaleY: 0.5 }],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.containerPadding * 2,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: 'rgba(55, 51, 62, 0.3)',
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
    marginBottom: 40,
    overflow: 'hidden',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
    maxWidth: 280,
  },
  footer: {
    width: '100%',
    paddingHorizontal: spacing.containerPadding * 1.5,
    paddingBottom: 40,
  },
  button: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
