/**
 * PersonalNotesScreen — Personal notes list with add, edit, and delete.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { usePersonalStore, Note } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { queueNoteSync } from '../hooks/usePersonalSync';

export default function PersonalNotesScreen() {
  const navigation = useNavigation();
  const { notes, addNote, deleteNote, updateNote } = usePersonalStore();
  const { user } = useAuth();

  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const handleAddNote = () => {
    if (!titleInput.trim() || !contentInput.trim()) {
      alert('Please fill out both title and content');
      return;
    }
    const id = addNote(titleInput.trim(), contentInput.trim());
    setTitleInput('');
    setContentInput('');
    setIsCreating(false);
    if (user) queueNoteSync(user.id, 'create', { id, title: titleInput.trim(), content: contentInput.trim(), date: new Date().toISOString() });
  };

  const handleEditNote = () => {
    if (!editingNote) return;
    if (!titleInput.trim() || !contentInput.trim()) {
      alert('Please fill out both title and content');
      return;
    }
    updateNote(editingNote.id, titleInput.trim(), contentInput.trim());
    setTitleInput('');
    setContentInput('');
    setEditingNote(null);
    if (user) queueNoteSync(user.id, 'update', { id: editingNote.id, title: titleInput.trim(), content: contentInput.trim() });
  };

  const startEdit = (note: Note) => {
    setTitleInput(note.title);
    setContentInput(note.content);
    setEditingNote(note);
    setIsCreating(false);
  };

  const cancelAll = () => {
    setTitleInput('');
    setContentInput('');
    setIsCreating(false);
    setEditingNote(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Personal Notes</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => { cancelAll(); setIsCreating(!isCreating); }}>
          <Ionicons name={editingNote || isCreating ? "close-outline" : "create-outline"} size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Create / Edit Form */}
        {(isCreating || editingNote) && (
          <View style={styles.creatorCard}>
            <Text style={styles.formTitle}>{editingNote ? 'Edit Note' : 'New Note'}</Text>
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
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.saveButton} onPress={editingNote ? handleEditNote : handleAddNote}>
                <Text style={styles.saveText}>{editingNote ? 'Update' : 'Save Note'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelAll}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Notes Grid */}
        <View style={styles.notesList}>
          {notes.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={styles.noteCard}
              onPress={() => startEdit(n)}
              activeOpacity={0.8}
            >
              <View style={styles.noteHeader}>
                <Text style={styles.noteTitle}>{n.title}</Text>
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => startEdit(n)} style={styles.noteActionBtn}>
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { deleteNote(n.id); if (user) queueNoteSync(user.id, 'delete', { id: n.id }); }} style={styles.noteActionBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.noteContent} numberOfLines={3}>{n.content}</Text>
              <Text style={styles.noteDate}>
                {new Date(n.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  contentInput: {
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: 'top',
    height: 80,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  saveText: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  notesList: {
    gap: 16,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
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
    flex: 1,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 4,
  },
  noteActionBtn: {
    padding: 6,
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
