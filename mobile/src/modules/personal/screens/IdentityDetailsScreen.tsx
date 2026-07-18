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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../../finance/store';

export default function IdentityDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { name, goals } = route.params || { name: 'User', goals: [] };
  const completeOnboarding = useFinanceStore((state: any) => state.completeOnboarding);

  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');

  const handleFinish = () => {
    if (dob.trim().length > 0) {
      completeOnboarding({
        name,
        goals,
        dob: dob.trim(),
        gender,
      });
      // Navigation is automatically handled in RootNavigator by checking isOnboarded
    }
  };

  const isEnabled = dob.trim().length > 0;

  // Simple auto-formatter for DD/MM/YYYY
  const handleDobChange = (text: string) => {
    // Remove any non-numeric characters
    let cleaned = text.replace(/[^0-9]/g, '');
    
    // Insert slash after DD and MM
    if (cleaned.length >= 2) {
      const day = cleaned.substring(0, 2);
      const month = cleaned.substring(2, 4);
      const year = cleaned.substring(4, 8);
      
      let formatted = day;
      if (month) formatted += '/' + month;
      if (year) formatted += '/' + year;
      
      setDob(formatted);
    } else {
      setDob(cleaned);
    }
  };

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
            <Text style={styles.headerTitle}>Your Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Main Body */}
          <View style={styles.body}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: '75%' }]} />
              </View>
            </View>

            {/* Prompts */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>A bit more about you</Text>
              <Text style={styles.subtitle}>This helps us tailor your insights.</Text>
            </View>

            {/* Glass Panel Form */}
            <View style={styles.formCard}>
              {/* Date of Birth Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="calendar-outline" size={20} color="#ccc3d8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="rgba(204, 195, 216, 0.3)"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={dob}
                    onChangeText={handleDobChange}
                  />
                </View>
              </View>

              {/* Gender Segmented Control */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[styles.segmentButton, gender === 'male' && styles.segmentButtonActive]}
                    activeOpacity={0.8}
                    onPress={() => setGender('male')}
                  >
                    <Text style={[styles.segmentText, gender === 'male' && styles.segmentTextActive]}>
                      Male
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentButton, gender === 'female' && styles.segmentButtonActive]}
                    activeOpacity={0.8}
                    onPress={() => setGender('female')}
                  >
                    <Text style={[styles.segmentText, gender === 'female' && styles.segmentTextActive]}>
                      Female
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentButton, gender === 'other' && styles.segmentButtonActive]}
                    activeOpacity={0.8}
                    onPress={() => setGender('other')}
                  >
                    <Text style={[styles.segmentText, gender === 'other' && styles.segmentTextActive]}>
                      Other
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ flex: 1 }} />

            {/* Finish Button */}
            <TouchableOpacity
              style={[styles.button, !isEnabled && styles.buttonDisabled]}
              activeOpacity={0.85}
              disabled={!isEnabled}
              onPress={handleFinish}
            >
              <Text style={[styles.buttonText, !isEnabled && styles.buttonTextDisabled]}>Finish Setup</Text>
              <Ionicons
                name="checkmark-circle-outline"
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
    marginBottom: 32,
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
  formCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    gap: 24,
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e8dfee',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d1a24',
    borderWidth: 1,
    borderColor: 'rgba(74, 68, 85, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#e8dfee',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#1d1a24',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(74, 68, 85, 0.4)',
  },
  segmentButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#7c3aed',
  },
  segmentText: {
    fontSize: 14,
    color: '#ccc3d8',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#ffffff',
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
