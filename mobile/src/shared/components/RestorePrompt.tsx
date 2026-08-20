/**
 * RestorePrompt — Modal prompting to restore from latest backup on first launch (unonboarded).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { rounded } from '../theme/spacing';
import { getLatestBackup, importData } from '../../services/backupService';
import { useFinanceStore } from '../../modules/finance/store';

export default function RestorePrompt() {
  const [visible, setVisible] = useState(false);
  const [backupDate, setBackupDate] = useState<Date | null>(null);
  const [backupUri, setBackupUri] = useState<string>('');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    checkForBackup();
  }, []);

  const checkForBackup = async () => {
    try {
      const isOnboarded = useFinanceStore.getState().isOnboarded;
      if (isOnboarded) return;

      const latest = await getLatestBackup();
      if (latest) {
        setBackupUri(latest.uri);
        setBackupDate(latest.date);
        setVisible(true);
      }
    } catch {
      // No backup available or FS unreadable — skip restore prompt
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = await importData(backupUri);
      if (!success) {
        alert('Restore failed. Starting fresh.');
      }
    } catch {
      alert('Restore failed. Starting fresh.');
    } finally {
      setRestoring(false);
      setVisible(false);
    }
  };

  const handleSkip = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-download-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.title}>Restore Backup?</Text>
          <Text style={styles.subtitle}>
            A backup from {backupDate?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} was found.
          </Text>
          <Text style={styles.desc}>
            Would you like to restore your data from this backup?
          </Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.btnSkip} onPress={handleSkip} activeOpacity={0.8}>
              <Text style={styles.btnSkipText}>Start Fresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnRestore, restoring && { opacity: 0.6 }]}
              onPress={handleRestore}
              activeOpacity={0.8}
              disabled={restoring}
            >
              <Text style={styles.btnRestoreText}>
                {restoring ? 'Restoring...' : 'Restore'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1e1a2e',
    borderRadius: rounded.lg,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: '#ccc3d8',
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    color: '#9a8fb5',
    textAlign: 'center',
    marginBottom: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnSkip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  btnSkipText: {
    color: '#ccc3d8',
    fontWeight: '700',
    fontSize: 14,
  },
  btnRestore: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnRestoreText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
