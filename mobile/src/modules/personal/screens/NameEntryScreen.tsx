import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';

export default function NameEntryScreen() {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');

  const handleContinue = () => {
    if (name.trim().length > 0) {
      navigation.navigate('GoalSelection', { name: name.trim() });
    }
  };

  const isEnabled = name.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ccc3d8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Name</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Main Body */}
          <View style={styles.body}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: '25%' }]} />
              </View>
            </View>

            {/* Prompts */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>What should we call you?</Text>
              <Text style={styles.subtitle}>We use this to personalize your experience.</Text>
            </View>

            {/* Input field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Jane Doe"
                placeholderTextColor="rgba(204, 195, 216, 0.3)"
                value={name}
                onChangeText={setName}
                autoFocus
                autoComplete="name"
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            </View>

            <View style={{ flex: 1 }} />

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.button, !isEnabled && styles.buttonDisabled]}
              activeOpacity={0.85}
              disabled={!isEnabled}
              onPress={handleContinue}
            >
              <Text style={[styles.buttonText, !isEnabled && styles.buttonTextDisabled]}>Continue</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={isEnabled ? '#ffffff' : 'rgba(204, 195, 216, 0.4)'}
                style={styles.buttonIcon}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15121b',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.containerPadding,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e8dfee',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.containerPadding * 1.5,
    paddingBottom: 40,
  },
  progressContainer: {
    marginTop: 10,
    marginBottom: 40,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#37333e',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 999,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e8dfee',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#ccc3d8',
    textAlign: 'center',
    opacity: 0.8,
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 60,
    backgroundColor: '#1d1a24',
    borderWidth: 1,
    borderColor: 'rgba(74, 68, 85, 0.4)',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    color: '#e8dfee',
  },
  button: {
    height: 56,
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#221e28',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonTextDisabled: {
    color: 'rgba(204, 195, 216, 0.4)',
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
