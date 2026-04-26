import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
  Animated,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Users, ChevronRight, Trash2, X, Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';
import { useApp } from '@/context/AppContext';
import { ClassesScreenSkeleton } from '@/components/SkeletonLoader';
import AppContainer from '@/components/ui/AppContainer';
import AppButton from '@/components/ui/AppButton';
import type { SchoolClass } from '@/types';

function AnimatedClassRow({
  item,
  onPress,
  onDelete,
}: {
  item: import('@/types').SchoolClass;
  onPress: () => void;
  onDelete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, friction: 8, tension: 300, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 300, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={styles.classCard}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.classLeft}>
          <View style={styles.classIcon}>
            <Users size={16} color={Colors.primary} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={styles.className}>{item.name}</Text>
            <Text style={styles.classCount}>{item.students.length} Schüler</Text>
          </View>
        </View>
        <View style={styles.classActions}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={16} color={Colors.textLight} strokeWidth={1.8} />
          </TouchableOpacity>
          <ChevronRight size={18} color={Colors.textLight} strokeWidth={1.7} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
export default function ClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, addClass, deleteClass, isLoading } = useApp();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: 1,
      friction: 6,
      tension: 120,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, [fabAnim]);

  const filteredClasses = React.useMemo(() => {
    if (!searchQuery.trim()) return data.classes;
    const q = searchQuery.toLowerCase().trim();
    return data.classes.filter((cls) => {
      if (cls.name.toLowerCase().includes(q)) return true;
      return cls.students.some(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q)
      );
    });
  }, [data.classes, searchQuery]);

  const handleCreate = useCallback(async () => {
    if (!newClassName.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Klassennamen ein.');
      return;
    }
    setIsCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    addClass(newClassName.trim());
    setNewClassName('');
    setIsCreating(false);
    setShowModal(false);
  }, [newClassName, addClass]);

  const handleDelete = useCallback(
    (cls: SchoolClass) => {
      Alert.alert(
        'Klasse löschen?',
        `Möchten Sie "${cls.name}" wirklich löschen? Alle Schüler und Bewertungen werden entfernt.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              deleteClass(cls.id);
            },
          },
        ]
      );
    },
    [deleteClass]
  );

  const renderClass = useCallback(
    ({ item }: { item: SchoolClass }) => (
      <AnimatedClassRow
        item={item}
        onPress={() => router.push(`/(tabs)/classes/${item.id}` as any)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [router, handleDelete]
  );

  if (isLoading) {
    return <ClassesScreenSkeleton />;
  }

  return (
    <AppContainer withPadding={false} style={styles.container}>
      <FlatList
        data={filteredClasses}
        keyExtractor={(item) => item.id}
        renderItem={renderClass}
        contentContainerStyle={[styles.listContent, { paddingTop: 16 }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.screenTitle}>Klassen</Text>
            <View style={styles.searchWrapper}>
              <BlurView intensity={Platform.OS === 'ios' ? 50 : 100} tint="light" style={styles.searchContainer}>
                <Search size={16} color={Colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Klasse oder Schüler suchen..."
                  placeholderTextColor={Colors.textLight}
                  testID="search-classes"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={16} color={Colors.textSecondary} strokeWidth={1.8} />
                  </TouchableOpacity>
                )}
              </BlurView>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Users size={26} color={Colors.textLight} strokeWidth={1.4} />
            </View>
            <Text style={styles.emptyTitle}>Noch keine Klassen</Text>
            <Text style={styles.emptySubtitle}>
              {"Tippen Sie auf \u201e+\u201c, um Ihre erste Klasse zu erstellen."}
            </Text>
          </View>
        }
      />

      <Animated.View
        style={[
          styles.fabWrapper,
          {
            transform: [
              { scale: fabAnim },
              { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            ],
            opacity: fabAnim,
          },
        ]}
      >
        <BlurView intensity={80} tint="light" style={styles.fabBlur}>
          <TouchableOpacity
            style={styles.fabInner}
            onPress={() => setShowModal(true)}
            activeOpacity={0.7}
          >
            <Plus size={24} color={Colors.white} strokeWidth={2.5} />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
            <View style={styles.modalDimmer} />
            <View style={styles.modalContent}>
            {isCreating && (
              <View style={styles.creatingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neue Klasse</Text>
              <TouchableOpacity onPress={() => { if (!isCreating) setShowModal(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={newClassName}
              onChangeText={setNewClassName}
              placeholder="z.B. 8a, 10b, Q1"
              placeholderTextColor={Colors.textLight}
              autoFocus
              editable={!isCreating}
              testID="input-class-name"
            />
            <AppButton
              label="Erstellen"
              onPress={handleCreate}
              disabled={isCreating}
            />
          </View>
        </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: UI.spacing.screenMargin,
    paddingBottom: 130, // Extra padding to clear floating tab bar
    flexGrow: 1,
  },
  screenTitle: {
    ...UI.font.largeTitle,
    color: Colors.text,
    marginBottom: UI.spacing.lg,
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
    ...UI.font.body,
    color: Colors.text,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: UI.card.radius,
    padding: UI.card.padding,
    ...UI.shadows.sm,
  },
  classLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  classIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,           // RADIUS.md — consistent with settings icon boxes
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  className: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  classCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  classActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deleteBtn: {
    padding: 6,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.neutralLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
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
    textAlign: 'center',
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
    paddingBottom: 48, // Add extra padding for bottom safe area
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
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 20,           // RADIUS.lg — matches AppInput
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  creatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
    borderRadius: UI.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
