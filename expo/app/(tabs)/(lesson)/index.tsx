import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, ChevronRight, BookOpen, Users as UsersIcon, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { LessonScreenSkeleton } from '@/components/SkeletonLoader';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import AppContainer from '@/components/ui/AppContainer';
import { UI } from '@/constants/ui';
function AnimatedClassCard({
  cls,
  isSelected,
  onPress,
}: {
  cls: { id: string; name: string; students: unknown[] };
  isSelected: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, friction: 8, tension: 300, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 300, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[styles.classCard, isSelected && styles.classCardSelected]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.classLeft}>
          <View style={styles.classIcon}>
            <UsersIcon size={18} color={isSelected ? Colors.text : Colors.textSecondary} strokeWidth={isSelected ? 2 : 1.8} />
          </View>
          <View>
            <Text style={[styles.className, isSelected && styles.classNameSelected]}>{cls.name}</Text>
            <Text style={styles.classCount}>{cls.students.length} Schüler</Text>
          </View>
        </View>
        {isSelected ? (
          <Check size={18} color={Colors.text} strokeWidth={2.5} />
        ) : (
          <ChevronRight size={17} color={Colors.textLight} strokeWidth={1.7} />
        )}
      </Pressable>
    </Animated.View>
  );
}

function AnimatedChip({
  subject,
  isSelected,
  onPress,
}: {
  subject: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.93, friction: 8, tension: 300, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[styles.chip, isSelected && styles.chipActive]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{subject}</Text>
      </Pressable>
    </Animated.View>
  );
}
export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, startSession, isLoading, isAuthenticated, storedPinHash } = useApp();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const startBtnAnim = useRef(new Animated.Value(1)).current;
  const isReady = !!selectedClassId && !!selectedSubject;
  const wasReadyRef = useRef(false);

  useEffect(() => {
    if (isReady && !wasReadyRef.current) {
      Animated.sequence([
        Animated.timing(startBtnAnim, { toValue: 1.04, duration: 120, useNativeDriver: true }),
        Animated.spring(startBtnAnim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
      ]).start();
    }
    wasReadyRef.current = isReady;
  }, [isReady, startBtnAnim]);

  const onboardingDone = data.onboardingComplete || !!storedPinHash;

  useEffect(() => {
    if (isLoading) return;
    if (!onboardingDone) {
      router.replace('/onboarding' as any);
      return;
    }
    if (!isAuthenticated) {
      router.replace('/lock' as any);
    }
  }, [isLoading, onboardingDone, isAuthenticated, router]);

  const activeSession = data.activeSession;

  const handleStartLesson = useCallback(() => {
    if (!selectedClassId || !selectedSubject) {
      Alert.alert('Fehler', 'Bitte wählen Sie eine Klasse und ein Fach.');
      return;
    }
    const cls = data.classes.find((c) => c.id === selectedClassId);
    if (!cls || cls.students.length === 0) {
      Alert.alert('Fehler', 'Diese Klasse hat keine Schüler.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startSession(selectedClassId, selectedSubject);
    router.push('/lesson-active' as any);
  }, [selectedClassId, selectedSubject, data.classes, startSession, router]);

  const handleResumeLesson = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/lesson-active' as any);
  }, [router]);

  if (isLoading || !onboardingDone || !isAuthenticated) {
    return <LessonScreenSkeleton />;
  }

  if (data.classes.length === 0) {
    return (
      <AppContainer>
        <View style={styles.emptyContainer}>
          <AppCard style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <BookOpen size={26} color={Colors.textLight} strokeWidth={1.4} />
            </View>
            <Text style={styles.emptyTitle}>Keine Klassen vorhanden</Text>
            <Text style={styles.emptySubtitle}>
              Erstellen Sie zuerst eine Klasse im Klassen-Bereich.
            </Text>
          </AppCard>
        </View>
      </AppContainer>
    );
  }

  return (
    <AppContainer withPadding={false}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + UI.spacing.md }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Unterricht</Text>

      {activeSession && (
        <TouchableOpacity onPress={handleResumeLesson} activeOpacity={0.65}>
          <AppCard style={styles.resumeCard}>
            <View style={styles.resumeLeft}>
              <View style={styles.resumeDot} />
              <View style={styles.resumeInfo}>
                <Text style={styles.resumeTitle}>Aktiver Unterricht</Text>
                <Text style={styles.resumeSubtitle}>
                  {data.classes.find((c) => c.id === activeSession.classId)?.name} · {activeSession.subject}
                </Text>
              </View>
            </View>
            <ChevronRight size={17} color={Colors.textSecondary} strokeWidth={1.8} />
          </AppCard>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionLabel}>KLASSE</Text>
      {data.classes.map((cls) => {
        const isSelected = selectedClassId === cls.id;
        return (
          <AnimatedClassCard
            key={cls.id}
            cls={cls}
            isSelected={isSelected}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedClassId(cls.id);
            }}
          />
        );
      })}

      <View style={styles.classSpacer} />

      <Text style={styles.sectionLabel}>FACH</Text>
      <View style={styles.chipWrap}>
        {data.profile.subjects.map((subject) => (
          <AnimatedChip
            key={subject}
            subject={subject}
            isSelected={selectedSubject === subject}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedSubject(subject);
            }}
          />
        ))}
      </View>

      <Animated.View style={{ transform: [{ scale: startBtnAnim }] }}>
        <AppButton
          label="Unterricht starten"
          onPress={handleStartLesson}
          disabled={!selectedClassId || !selectedSubject}
          leftIcon={<Play size={17} color={Colors.primary} strokeWidth={2.5} />}
          style={styles.startBtn}
        />
      </Animated.View>
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: UI.spacing.screenMargin,
    paddingTop: UI.spacing.md,
    paddingBottom: 130,
  },
  screenTitle: {
    ...UI.font.largeTitle,
    color: Colors.text,
    marginBottom: 28,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.neutralLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    ...UI.font.subtitle,
    color: Colors.text,
    marginBottom: UI.spacing.xs,
  },
  emptySubtitle: {
    ...UI.font.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    borderRadius: UI.radius.xl,
    padding: UI.spacing.lg,
    backgroundColor: Colors.white,
    ...UI.shadows.lg,
  },
  resumeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumeDot: {
    width: 8,
    height: 8,
    borderRadius: 100,         // RADIUS.pill
    backgroundColor: Colors.positive,
  },
  resumeInfo: {
    gap: 2,
  },
  resumeTitle: {
    ...UI.font.bodySemibold,
    color: Colors.text,
  },
  resumeSubtitle: {
    ...UI.font.small,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    ...UI.font.caption,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 1,
    paddingLeft: 12,
    marginBottom: 8,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: UI.radius.xl,
    padding: UI.spacing.lg,
    marginBottom: UI.spacing.sm,
    ...UI.shadows.lg,
  },
  classCardSelected: {
    // We intentionally keep the card visually stable
  },
  classLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  classIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,          // RADIUS.md
    backgroundColor: Colors.neutralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  className: {
    ...UI.font.bodySemibold,
    color: Colors.text,
  },
  classNameSelected: {
    color: Colors.primary,
  },
  classCount: {
    ...UI.font.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  classSpacer: {
    height: 20,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,         // RADIUS.pill
    backgroundColor: Colors.white,
    ...UI.shadows.sm,
  },
  chipActive: {
    // Keep background stable, visually it floats
  },
  chipText: {
    ...UI.font.smallSemibold,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.text,
    fontWeight: '700' as const,
  },
  startBtn: { marginTop: 4 },
});
