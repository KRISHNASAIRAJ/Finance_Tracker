import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { usePersonalStore } from '../store';

export default function PersonalNotesScreen() {
  const navigation = useNavigation();
  const { notes, addNote, deleteNote } = usePersonalStore();

  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleAddNote = () => {
    if (!titleInput.trim() || !contentInput.trim()) {
      alert('Please fill out both title and content');
      return;
    }
    addNote(titleInput.trim(), contentInput.trim());
    setTitleInput('');
    setContentInput('');
    setIsEditing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Personal Notes</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => setIsEditing(!isEditing)}>
          <Ionicons name={isEditing ? "close-outline" : "create-outline"} size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Note Creator Form */}
        {isEditing ? (
          <View style={styles.creatorCard}>
            <TextInput
              style={styles.titleInput}
              placeholder="Note Title"
              placeholderTextColor={colors.onSurfaceVariant}
              value={titleInput}
              onChangeText={setTitleInput}
            />
            <TextInput
              style={styles.contentInput}
              placeholder="Start writing..."
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              numberOfLines={4}
              value={contentInput}
              onChangeText={setContentInput}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddNote}>
              <Text style={styles.saveText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Notes Grid */}
        <View style={styles.notesList}>
          {notes.map((n) => (
            <View key={n.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteTitle}>{n.title}</Text>
                <TouchableOpacity onPress={() => deleteNote(n.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
              <Text style={styles.noteContent}>{n.content}</Text>
              <Text style={styles.noteDate}>
                {new Date(n.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  creatorCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 12,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  contentInput: {
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: 'top',
    height: 80,
  },
  saveButton: {
    backgroundColor: colors.primaryContainer,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  notesList: {
    gap: 16,
  },
  noteCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 10,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  noteContent: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  noteDate: {
    fontSize: 10,
    color: colors.outline,
    alignSelf: 'flex-end',
  },
});
