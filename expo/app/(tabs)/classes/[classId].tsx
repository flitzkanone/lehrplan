import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Plus, Trash2, Edit3, X, StickyNote, Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';
import { useApp } from '@/context/AppContext';
import AppButton from '@/components/ui/AppButton';
import type { Student } from '@/types';

export default function ClassDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { data, addStudent, updateStudent, deleteStudent } = useApp();
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentClass = data.classes.find((c) => c.id === classId);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setNote('');
  };

  const handleAddStudent = useCallback(() => {
    if (!firstName.trim()) {
      Alert.alert('Fehler', 'Vorname ist erforderlich.');
      return;
    }
    if (!classId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addStudent(classId, firstName.trim(), lastName.trim(), note.trim());
    resetForm();
    setShowAddModal(false);
  }, [firstName, lastName, note, classId, addStudent]);

  const handleEditStudent = useCallback(() => {
    if (!editingStudent || !classId) return;
    if (!firstName.trim()) {
      Alert.alert('Fehler', 'Vorname ist erforderlich.');
      return;
    }
    updateStudent(classId, editingStudent.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      note: note.trim(),
    });
    setShowEditModal(false);
    setEditingStudent(null);
    resetForm();
  }, [editingStudent, firstName, lastName, note, classId, updateStudent]);

  const handleDeleteStudent = useCallback(
    (student: Student) => {
      if (!classId) return;
      Alert.alert(
        'Schüler löschen?',
        `${student.firstName} ${student.lastName} wirklich löschen?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              deleteStudent(classId, student.id);
            },
          },
        ]
      );
    },
    [classId, deleteStudent]
  );

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setNote(student.note);
    setShowEditModal(true);
  };

  const sortedStudents = useMemo(() => {
    if (!currentClass) return [];
    return [...currentClass.students].sort((a, b) =>
      a.lastName.localeCompare(b.lastName)
    );
  }, [currentClass]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return sortedStudents;
    const q = searchQuery.toLowerCase().trim();
    return sortedStudents.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)
    );
  }, [sortedStudents, searchQuery]);

  if (!currentClass) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Klasse nicht gefunden.</Text>
      </View>
    );
  }

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.firstName || '?')[0]}{(item.lastName || '?')[0]}
          </Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>
            {item.lastName}, {item.firstName}
          </Text>
          {item.note ? (
            <View style={styles.noteRow}>
              <StickyNote size={10} color={Colors.textLight} strokeWidth={1.5} />
              <Text style={styles.noteText} numberOfLines={1}>{item.note}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.studentActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
          <Edit3 size={14} color={Colors.textSecondary} strokeWidth={1.7} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteStudent(item)}>
          <Trash2 size={14} color={Colors.negative} strokeWidth={1.7} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormModal = (visible: boolean, onClose: () => void, onSubmit: () => void, title: string, btnText: string) => (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <View style={styles.modalDimmer} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
            </TouchableOpacity>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vorname</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Vorname"
              placeholderTextColor={Colors.textLight}
              autoFocus
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nachname</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Nachname"
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notiz</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={note}
              onChangeText={setNote}
              placeholder="Optionale Notiz"
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={3}
            />
          </View>
          </View>
          <AppButton
            label={btnText}
            onPress={onSubmit}
            style={{ marginTop: UI.spacing.xs }}
          />
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: currentClass.name,
          headerRight: () => (
            <Text style={styles.headerStudentCount}>{sortedStudents.length} Schüler</Text>
          ),
        }}
      />
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.searchWrapper}>
            <BlurView intensity={Platform.OS === 'ios' ? 50 : 100} tint="light" style={styles.searchContainer}>
              <Search size={16} color={Colors.textSecondary} strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Schüler suchen..."
                placeholderTextColor={Colors.textLight}
                testID="search-students"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={Colors.textSecondary} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
            </BlurView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'Keine Ergebnisse' : 'Keine Schüler'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? 'Passen Sie Ihre Suche an.'
                : 'Fügen Sie Schüler mit \u201e+\u201c hinzu.'}
            </Text>
          </View>
        }
      />

      <View style={styles.fabWrapper}>
        <BlurView intensity={80} tint="light" style={styles.fabBlur}>
          <TouchableOpacity
            style={styles.fabInner}
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
            activeOpacity={0.7}
          >
            <Plus size={24} color={Colors.white} strokeWidth={2.5} />
          </TouchableOpacity>
        </BlurView>
      </View>

      {renderFormModal(showAddModal, () => setShowAddModal(false), handleAddStudent, 'Schüler hinzufügen', 'Hinzufügen')}
      {renderFormModal(showEditModal, () => { setShowEditModal(false); setEditingStudent(null); }, handleEditStudent, 'Schüler bearbeiten', 'Speichern')}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: UI.spacing.screenMargin,
    paddingTop: 16,
    paddingBottom: 130, // Extra padding to clear floating tab bar
    flexGrow: 1,
  },
  searchWrapper: {
    marginBottom: UI.spacing.lg,
    borderRadius: UI.radius.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Platform.select({ ios: 'rgba(255,255,255,0.5)', android: 'rgba(255,255,255,0.95)' }),
    borderRadius: UI.radius.xl,
    paddingHorizontal: 16,
    gap: UI.spacing.sm,
    overflow: 'hidden',
    borderWidth: Platform.select({ ios: 0.5, android: 0 }),
    borderColor: 'rgba(255,255,255,0.6)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  headerStudentCount: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 20,          // RADIUS.lg
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  studentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 40,                 // Match classIcon size
    height: 40,
    borderRadius: 14,          // RADIUS.md
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  studentActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,          // RADIUS.md
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 95, // Float above the tab bar
    right: 24,
    borderRadius: 30, // Make it completely round
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  fabBlur: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + 'E6', // 90% opacity primary color for iOS blur feel
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)', // Subtle dimming
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: UI.radius.xl,
    borderTopRightRadius: UI.radius.xl,
    padding: 24,
    paddingBottom: 48,
    ...UI.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 20,          // RADIUS.lg
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  inputMultiline: {
    height: 80,
    paddingTop: 14,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,         // RADIUS.md
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
