/**
 * AuthGate — Login/skip gate wrapping the app; shows auth screen if unauthenticated.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { rounded } from '../theme/spacing';
import { useAuth } from '../../services/AuthProvider';
import EKGLoader from './EKGLoader';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const { user, loading, signIn } = useAuth();
  const [skipped, setSkipped] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <EKGLoader size={200} />
        </View>
      </SafeAreaView>
    );
  }

  if (user || skipped) {
    return <>{children}</>;
  }

  if (!showLogin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="cloud-outline" size={64} color={colors.primary} style={{ marginBottom: 20 }} />
          <Text style={styles.title}>Welcome to Meridian</Text>
          <Text style={styles.subtitle}>
            Sign in to sync your data across devices and enable cloud backup.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setShowLogin(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setSkipped(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.skipBtnText}>Skip — Use Offline</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={64} color={colors.primary} style={{ marginBottom: 20 }} />
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Enter your Supabase credentials</Text>

          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.outline}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.outline}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
            onPress={async () => {
              if (busy) return;
              setBusy(true);
              setError('');
              const { error: signInError } = await signIn(email, password);
              setBusy(false);
              if (signInError) setError(signInError);
            }}
            activeOpacity={0.8}
            disabled={busy}
          >
            {busy ? (
              <EKGLoader size={44} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setShowLogin(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.skipBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  inputGroup: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    height: 48,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 15,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.primaryContainer,
    borderRadius: rounded.DEFAULT,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipBtnText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: rounded.DEFAULT,
    padding: 10,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
});
