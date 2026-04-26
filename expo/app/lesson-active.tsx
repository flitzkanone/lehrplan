import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, CheckCircle, Users, ThumbsUp, HandHelping, EyeOff, Volume2, FileX, BookOpen, Check, X, Clock, Search, UserX, Timer, Activity } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { ParticipationRating, ParticipationReason, HomeworkStatus } from '@/types';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import { useLessonTimer } from '@/hooks/useLessonTimer';

interface ReasonOption {
  reason: ParticipationReason;
  label: string;
  icon: React.ReactNode;
}

const POSITIVE_REASONS: ReasonOption[] = [
  { reason: 'good_participation', label: 'Gute Mitarbeit', icon: <ThumbsUp size={18} color={Colors.text} strokeWidth={1.8} /> },
  { reason: 'group_work', label: 'Gruppenarbeit', icon: <Users size={18} color={Colors.text} strokeWidth={1.8} /> },
  { reason: 'helpful', label: 'Hilfsbereit', icon: <HandHelping size={18} color={Colors.text} strokeWidth={1.8} /> },
];

const NEGATIVE_REASONS: ReasonOption[] = [
  { reason: 'unfocused', label: 'Unkonzentriert', icon: <EyeOff size={18} color={Colors.negative} strokeWidth={1.8} /> },
  { reason: 'disruptive', label: 'Ablenkend', icon: <Volume2 size={18} color={Colors.negative} strokeWidth={1.8} /> },
  { reason: 'unprepared', label: 'Unvorbereitet', icon: <FileX size={18} color={Colors.negative} strokeWidth={1.8} /> },
];

function RatingButton({
  type,
  active,
  disabled,
  onPress,
}: {
  type: ParticipationRating;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 50, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const pressedColors: Record<ParticipationRating, { bg: string; activeBg: string; border: string }> = {
    '+': { bg: '#BBF7D0', activeBg: '#15803D', border: '#15803D' },
    'o': { bg: '#E2E2E5', activeBg: '#6B6B70', border: '#6B6B70' },
    '-': { bg: '#FECACA', activeBg: '#B91C1C', border: '#B91C1C' },
  };

  const config: Record<ParticipationRating, { bg: string; activeBg: string; border: string; icon: React.ReactNode; label: string }> = {
    '+': {
      bg: Colors.positiveLight,
      activeBg: Colors.positive,
      border: Colors.positive,
      icon: <Check size={16} color={active ? '#FFFFFF' : Colors.positive} strokeWidth={2.5} />,
      label: '+',
    },
    'o': {
      bg: Colors.neutralLight,
      activeBg: Colors.neutral,
      border: Colors.neutral,
      icon: <Circle size={13} color={active ? '#FFFFFF' : Colors.neutral} strokeWidth={2.5} />,
      label: 'o',
    },
    '-': {
      bg: Colors.negativeLight,
      activeBg: Colors.negative,
      border: Colors.negative,
      icon: <X size={16} color={active ? '#FFFFFF' : Colors.negative} strokeWidth={2.5} />,
      label: '-',
    },
  };

  const c = config[type];
  const pc = pressedColors[type];

  const bgColor = disabled
    ? '#F0F0F2'
    : pressed
    ? (active ? pc.activeBg : pc.bg)
    : (active ? c.activeBg : c.bg);
  const borderColor = disabled
    ? 'transparent'
    : pressed
    ? pc.border
    : (active ? c.border : 'transparent');

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: disabled ? 0.35 : 1 }}>
      <Pressable
        style={[
          styles.ratingBtn,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
        onPress={handlePress}
        onPressIn={() => !disabled && setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        {c.icon}
      </Pressable>
    </Animated.View>
  );
}

function HomeworkButton({
  status,
  active,
  onPress,
}: {
  status: HomeworkStatus;
  active: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 50, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const pressedColors: Record<HomeworkStatus, { bg: string; activeBg: string; border: string }> = {
    'done': { bg: '#BBF7D0', activeBg: '#15803D', border: '#15803D' },
    'missing': { bg: '#FECACA', activeBg: '#B91C1C', border: '#B91C1C' },
    'late': { bg: '#FDE68A', activeBg: '#B45309', border: '#B45309' },
  };

  const config: Record<HomeworkStatus, { bg: string; activeBg: string; border: string; icon: React.ReactNode }> = {
    'done': {
      bg: '#F0FDF4',
      activeBg: '#16A34A',
      border: '#16A34A',
      icon: <Check size={16} color={active ? '#FFFFFF' : '#16A34A'} strokeWidth={2.5} />,
    },
    'missing': {
      bg: Colors.negativeLight,
      activeBg: Colors.negative,
      border: Colors.negative,
      icon: <X size={16} color={active ? '#FFFFFF' : Colors.negative} strokeWidth={2.5} />,
    },
    'late': {
      bg: Colors.warningLight,
      activeBg: '#D97706',
      border: '#D97706',
      icon: <Clock size={14} color={active ? '#FFFFFF' : '#D97706'} strokeWidth={2.5} />,
    },
  };

  const c = config[status];
  const pc = pressedColors[status];

  const bgColor = pressed
    ? (active ? pc.activeBg : pc.bg)
    : (active ? c.activeBg : c.bg);
  const borderColor = pressed
    ? pc.border
    : (active ? c.border : 'transparent');

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[
          styles.homeworkBtn,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        {c.icon}
      </Pressable>
    </Animated.View>
  );
}

function ReasonMenu({
  visible,
  reasons,
  isNegative,
  onSelect,
  onClose,
}: {
  visible: boolean;
  reasons: ReasonOption[];
  isNegative: boolean;
  onSelect: (reason: ParticipationReason) => void;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.reasonMenu,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {reasons.map((item) => (
        <TouchableOpacity
          key={item.reason}
          style={[
            styles.reasonBtn,
            isNegative ? styles.reasonBtnNegative : styles.reasonBtnPositive,
          ]}
          onPress={() => {
            onSelect(item.reason);
          }}
          activeOpacity={0.6}
        >
          {item.icon}
          <Text style={[
            styles.reasonBtnLabel,
            isNegative ? styles.reasonBtnLabelNeg : styles.reasonBtnLabelPos,
          ]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

function LateEditRow({
  visible,
  initialMinutes,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  initialMinutes: number;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [value, setValue] = useState(String(initialMinutes));

  React.useEffect(() => {
    if (visible) {
      setValue(String(initialMinutes));
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, initialMinutes, fadeAnim]);

  if (!visible) return null;

  const parsed = parseInt(value, 10);
  const isValid = !isNaN(parsed) && parsed >= 1;

  return (
    <Animated.View style={[styles.lateEditRow, { opacity: fadeAnim }]}>
      <Timer size={14} color="#D97706" strokeWidth={1.8} />
      <Text style={styles.lateEditLabel}>Verspätung:</Text>
      <TextInput
        style={styles.lateEditInput}
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        maxLength={3}
        selectTextOnFocus
        autoFocus
      />
      <Text style={styles.lateEditMin}>Min</Text>
      <TouchableOpacity
        style={[styles.lateEditBtn, styles.lateEditBtnConfirm, !isValid && styles.lateEditBtnDisabled]}
        onPress={() => {
          if (isValid) onConfirm(parsed);
        }}
        activeOpacity={0.7}
      >
        <Check size={13} color={isValid ? '#FFFFFF' : '#AAAAAA'} strokeWidth={2.5} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.lateEditBtn, styles.lateEditBtnCancel]}
        onPress={onCancel}
        activeOpacity={0.7}
      >
        <X size={13} color={Colors.textSecondary} strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function getReasonLabel(reason: ParticipationReason): string | null {
  if (!reason) return null;
  const all = [...POSITIVE_REASONS, ...NEGATIVE_REASONS];
  return all.find((r) => r.reason === reason)?.label ?? null;
}

function getHomeworkLabel(status: HomeworkStatus): string {
  switch (status) {
    case 'done': return 'Abgegeben';
    case 'late': return 'Verspätet';
    case 'missing': return 'Nicht abgegeben';
  }
}

// ---------------------------------------------------------------------------
// In-App Live Activity Banner (fallback for ActivityKit / Foreground Service)
// ---------------------------------------------------------------------------
function InAppActivityBanner({
  timer,
  ratedCount,
  totalCount,
  className,
}: {
  timer: string;
  ratedCount: number;
  totalCount: number;
  className: string;
}) {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  const progress = totalCount > 0 ? ratedCount / totalCount : 0;
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 400, useNativeDriver: false }).start();
  }, [progress, progressAnim]);

  return (
    <Animated.View
      style={[
        bannerStyles.wrap,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={bannerStyles.left}>
        <View style={bannerStyles.dot} />
        <View>
          <Text style={bannerStyles.label}>Unterricht läuft</Text>
          <Text style={bannerStyles.className} numberOfLines={1}>{className}</Text>
        </View>
      </View>
      <View style={bannerStyles.right}>
        <Text style={bannerStyles.timer}>{timer}</Text>
        <Text style={bannerStyles.count}>{ratedCount}/{totalCount}</Text>
      </View>
      <Animated.View
        style={[
          bannerStyles.progressBar,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 },
      android: { elevation: 10 },
      default: {},
    }),
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A8F0C8' },
  label: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3 },
  className: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 1 },
  timer: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontVariant: ['tabular-nums'] as any },
  count: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function LessonActiveScreen() {
  const router = useRouter();
  const { data, isAuthenticated, rateStudent, rateHomework, markAbsent, markLate, endSession } = useApp();
  const session = data.activeSession;
  const isTeachingMode = Boolean(session);
  const timerStr = useLessonTimer(session?.startedAt ?? null);
  const [openMenuStudentId, setOpenMenuStudentId] = useState<string | null>(null);
  const [openMenuType, setOpenMenuType] = useState<'+' | '-' | null>(null);
  const [homeworkMode, setHomeworkMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingLateStudentId, setEditingLateStudentId] = useState<string | null>(null);

  const currentClass = data.classes.find((c) => c.id === session?.classId);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const homeworkProgressAnim = useRef(new Animated.Value(0)).current;

  const ratedCount = Object.keys(session?.ratings ?? {}).length;
  const totalCount = currentClass?.students.length ?? 0;
  const absentCount = Object.values(session?.absent ?? {}).filter(Boolean).length;
  const activeTotal = totalCount - absentCount;
  const progress = activeTotal > 0 ? ratedCount / activeTotal : 0;
  const homeworkRated = Object.keys(session?.homework ?? {}).length;
  const homeworkProgress = totalCount > 0 ? homeworkRated / totalCount : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    Animated.timing(homeworkProgressAnim, {
      toValue: homeworkProgress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [homeworkProgress, homeworkProgressAnim]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/lock' as any);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Keep-awake follows the existing teaching-mode state so the display
    // stays on only while a lesson is active.
    if (isTeachingMode) {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }

    // Cleanup is critical to avoid leaving keep-awake active after unmount.
    return () => {
      deactivateKeepAwake();
    };
  }, [isTeachingMode]);

  const handleEndLesson = useCallback(() => {
    Alert.alert(
      'Unterricht beenden?',
      'Alle nicht bewerteten Schüler erhalten eine neutrale Bewertung (o).',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Beenden',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            endSession();
            router.back();
          },
        },
      ]
    );
  }, [endSession, router]);

  const handleEnterHomeworkMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHomeworkMode(true);
    setOpenMenuStudentId(null);
    setOpenMenuType(null);
    setEditingLateStudentId(null);
  }, []);

  const handleExitHomeworkMode = useCallback(() => {
    if (!session || !currentClass) {
      setHomeworkMode(false);
      return;
    }

    const homework = session.homework ?? {};
    const unratedStudents = currentClass.students.filter((s) => !homework[s.id]);

    if (unratedStudents.length > 0) {
      Alert.alert(
        'Hausaufgaben beenden?',
        `${unratedStudents.length} Schüler wurden nicht bewertet. Alle unbewerteten Schüler erhalten ein ✕ (nicht abgegeben).`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Beenden',
            style: 'destructive',
            onPress: () => {
              unratedStudents.forEach((s) => {
                rateHomework(s.id, 'missing');
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setHomeworkMode(false);
            },
          },
        ]
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHomeworkMode(false);
    }
  }, [session, currentClass, rateHomework]);

  const handleHomeworkRate = useCallback(
    (studentId: string, status: HomeworkStatus) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const currentStatus = session?.homework?.[studentId];
      if (currentStatus === status) {
        return;
      }
      rateHomework(studentId, status);
    },
    [rateHomework, session]
  );

  const handleRatingPress = useCallback(
    (studentId: string, type: ParticipationRating) => {
      if (type === 'o') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        rateStudent(studentId, 'o', null);
        setOpenMenuStudentId(null);
        setOpenMenuType(null);
        return;
      }

      if (openMenuStudentId === studentId && openMenuType === type) {
        setOpenMenuStudentId(null);
        setOpenMenuType(null);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setOpenMenuStudentId(studentId);
      setOpenMenuType(type);
    },
    [openMenuStudentId, openMenuType, rateStudent]
  );

  const handleReasonSelect = useCallback(
    (studentId: string, rating: ParticipationRating, reason: ParticipationReason) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      rateStudent(studentId, rating, reason);
      setOpenMenuStudentId(null);
      setOpenMenuType(null);
    },
    [rateStudent]
  );

  const handleCloseMenu = useCallback(() => {
    setOpenMenuStudentId(null);
    setOpenMenuType(null);
  }, []);

  const handleToggleAbsent = useCallback(
    (studentId: string) => {
      if (!session) return;
      const isCurrentlyAbsent = session.absent?.[studentId] ?? false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      markAbsent(studentId, !isCurrentlyAbsent);
      if (!isCurrentlyAbsent) {
        setOpenMenuStudentId(null);
        setOpenMenuType(null);
        setEditingLateStudentId(null);
      }
    },
    [session, markAbsent]
  );

  const handleToggleLate = useCallback(
    (studentId: string) => {
      if (!session) return;
      const isCurrentlyLate = session.lateMinutes?.[studentId] != null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isCurrentlyLate) {
        markLate(studentId, null);
        setEditingLateStudentId(null);
      } else {
        const minutesSinceStart = Math.max(1, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000));
        markLate(studentId, minutesSinceStart);
        setEditingLateStudentId(null);
      }
    },
    [session, markLate]
  );

  const handleLateBadgePress = useCallback(
    (studentId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEditingLateStudentId((prev) => (prev === studentId ? null : studentId));
      setOpenMenuStudentId(null);
      setOpenMenuType(null);
    },
    []
  );

  const handleLateEditConfirm = useCallback(
    (studentId: string, minutes: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      markLate(studentId, minutes);
      setEditingLateStudentId(null);
    },
    [markLate]
  );

  if (!session || !currentClass) {
    return (
      <View style={styles.emptyContainer}>
        <AppCard style={styles.emptyCard}>
          <Text style={styles.emptyText}>Kein aktiver Unterricht.</Text>
          <AppButton label="Zurück" onPress={() => router.back()} style={styles.emptyBackBtn} />
        </AppCard>
      </View>
    );
  }

  const absentStudents = session.absent ?? {};
  const lateStudents = session.lateMinutes ?? {};

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Live Activity Banner */}
        <InAppActivityBanner
          timer={timerStr}
          ratedCount={ratedCount}
          totalCount={activeTotal}
          className={currentClass.name}
        />

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{currentClass.name}</Text>
              <Text style={styles.headerSubject}>{session.subject}</Text>
            </View>

            {homeworkMode ? (
              <TouchableOpacity style={styles.homeworkEndBtn} onPress={handleExitHomeworkMode} activeOpacity={0.55}>
                <BookOpen size={14} color={Colors.negative} strokeWidth={1.8} />
                <Text style={styles.homeworkEndBtnText}>HA beenden</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.homeworkToggleBtn} onPress={handleEnterHomeworkMode} activeOpacity={0.55}>
                  <BookOpen size={14} color={Colors.text} strokeWidth={1.8} />
                  <Text style={styles.homeworkToggleBtnText}>Hausaufgaben</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endBtn} onPress={handleEndLesson} activeOpacity={0.55}>
                  <CheckCircle size={15} color={Colors.primary} strokeWidth={1.8} />
                  <Text style={styles.endBtnText}>Beenden</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Stats chips row */}
          {!homeworkMode && (
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Timer size={11} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.statChipText}>{timerStr}</Text>
              </View>
              <View style={styles.statChip}>
                <CheckCircle size={11} color={Colors.positive} strokeWidth={2} />
                <Text style={[styles.statChipText, { color: Colors.positive }]}>{ratedCount} bewertet</Text>
              </View>
              {absentCount > 0 && (
                <View style={[styles.statChip, { backgroundColor: Colors.negativeLight }]}>
                  <UserX size={11} color={Colors.negative} strokeWidth={2} />
                  <Text style={[styles.statChipText, { color: Colors.negative }]}>{absentCount} abwesend</Text>
                </View>
              )}
            </View>
          )}

          {homeworkMode ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    styles.homeworkProgressFill,
                    {
                      width: homeworkProgressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{homeworkRated}/{totalCount}</Text>
            </View>
          ) : (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{ratedCount}/{activeTotal}</Text>
            </View>
          )}

          {homeworkMode && (
            <View style={styles.homeworkLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.legendText}>Abgegeben</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.legendText}>Verspätet</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.negative }]} />
                <Text style={styles.legendText}>Fehlt</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.textLight} strokeWidth={1.7} />
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
                <X size={15} color={Colors.textSecondary} strokeWidth={1.8} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {currentClass.students
            .filter((s) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q);
            })
            .sort((a, b) => a.lastName.localeCompare(b.lastName))
            .map((student) => {
              if (homeworkMode) {
                const hwStatus = session.homework?.[student.id] as HomeworkStatus | undefined;
                const hwLabel = hwStatus ? getHomeworkLabel(hwStatus) : null;

                return (
                  <View key={student.id} style={styles.studentCard}>
                    <View style={styles.studentRow}>
                      <View style={styles.studentInfo}>
                        <View style={[
                          styles.studentAvatar,
                          hwStatus === 'done' && styles.avatarHomeworkDone,
                          hwStatus === 'late' && styles.avatarHomeworkLate,
                          hwStatus === 'missing' && styles.avatarHomeworkMissing,
                        ]}>
                          <Text style={[
                            styles.avatarText,
                            hwStatus === 'done' && { color: '#16A34A' },
                            hwStatus === 'late' && { color: '#D97706' },
                            hwStatus === 'missing' && styles.avatarTextNegative,
                          ]}>
                            {(student.firstName || '?')[0]}{(student.lastName || '?')[0]}
                          </Text>
                        </View>
                        <View style={styles.studentTextWrap}>
                          <Text style={styles.studentName}>
                            {student.lastName}{student.lastName ? ', ' : ''}{student.firstName}
                          </Text>
                          {hwLabel ? (
                            <View style={styles.reasonBadgeRow}>
                              <View style={[
                                styles.reasonBadge,
                                hwStatus === 'done' && { backgroundColor: '#F0FDF4' },
                                hwStatus === 'late' && { backgroundColor: Colors.warningLight },
                                hwStatus === 'missing' && styles.reasonBadgeNeg,
                              ]}>
                                <Text style={[
                                  styles.reasonBadgeText,
                                  hwStatus === 'done' && { color: '#16A34A' },
                                  hwStatus === 'late' && { color: '#D97706' },
                                  hwStatus === 'missing' && styles.reasonBadgeTextNeg,
                                ]}>
                                  {hwLabel}
                                </Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.ratingRow}>
                        <HomeworkButton
                          status="done"
                          active={hwStatus === 'done'}
                          onPress={() => handleHomeworkRate(student.id, 'done')}
                        />
                        <HomeworkButton
                          status="late"
                          active={hwStatus === 'late'}
                          onPress={() => handleHomeworkRate(student.id, 'late')}
                        />
                        <HomeworkButton
                          status="missing"
                          active={hwStatus === 'missing'}
                          onPress={() => handleHomeworkRate(student.id, 'missing')}
                        />
                      </View>
                    </View>
                  </View>
                );
              }

              const isAbsent = absentStudents[student.id] ?? false;
              const lateMin = lateStudents[student.id] ?? null;
              const isLate = lateMin != null;
              const isEditingLate = editingLateStudentId === student.id;

              const currentRating = session.ratings[student.id] as ParticipationRating | undefined;
              const currentReason = session.reasons?.[student.id] ?? null;
              const reasonLabel = getReasonLabel(currentReason);
              const isMenuOpen = openMenuStudentId === student.id && !isAbsent;
              const menuIsPositive = isMenuOpen && openMenuType === '+';
              const menuIsNegative = isMenuOpen && openMenuType === '-';

              return (
                <View key={student.id} style={[styles.studentCard, (isMenuOpen || isEditingLate) && styles.studentCardOpen]}>
                  <View style={[styles.studentRow, isAbsent && styles.studentRowAbsent]}>
                    <View style={styles.studentInfo}>
                      <View style={[
                        styles.studentAvatar,
                        isAbsent && styles.avatarAbsent,
                        !isAbsent && currentRating === '+' && styles.avatarPositive,
                        !isAbsent && currentRating === '-' && styles.avatarNegative,
                      ]}>
                        <Text style={[
                          styles.avatarText,
                          isAbsent && styles.avatarTextAbsent,
                          !isAbsent && currentRating === '+' && styles.avatarTextPositive,
                          !isAbsent && currentRating === '-' && styles.avatarTextNegative,
                        ]}>
                          {(student.firstName || '?')[0]}{(student.lastName || '?')[0]}
                        </Text>
                      </View>
                      <View style={styles.studentTextWrap}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.studentName, isAbsent && styles.studentNameAbsent]} numberOfLines={1}>
                            {student.lastName}{student.lastName ? ', ' : ''}{student.firstName}
                          </Text>
                        </View>
                        {isAbsent ? (
                          <View style={styles.reasonBadgeRow}>
                            <View style={[styles.reasonBadge, styles.absentBadge]}>
                              <Text style={[styles.reasonBadgeText, styles.absentBadgeText]}>Abwesend</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.badgesRow}>
                            {isLate && (
                              <TouchableOpacity
                                onPress={() => handleLateBadgePress(student.id)}
                                activeOpacity={0.7}
                                testID={`late-badge-${student.id}`}
                              >
                                <View style={[styles.reasonBadge, styles.lateBadge, isEditingLate && styles.lateBadgeActive]}>
                                  <Timer size={10} color="#D97706" strokeWidth={2} />
                                  <Text style={[styles.reasonBadgeText, styles.lateBadgeText]}>{lateMin} Min</Text>
                                </View>
                              </TouchableOpacity>
                            )}
                            {!isLate && reasonLabel ? (
                              <View style={[
                                styles.reasonBadge,
                                currentRating === '-' ? styles.reasonBadgeNeg : styles.reasonBadgePos,
                              ]}>
                                <Text style={[
                                  styles.reasonBadgeText,
                                  currentRating === '-' ? styles.reasonBadgeTextNeg : styles.reasonBadgeTextPos,
                                ]}>
                                  {reasonLabel}
                                </Text>
                              </View>
                            ) : !isLate && student.note ? (
                              <Text style={styles.studentNote} numberOfLines={1}>
                                {student.note}
                              </Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.actionsAndRating}>
                      <View style={styles.studentActionBtns}>
                        <TouchableOpacity
                          style={[styles.microBtn, isAbsent && styles.microBtnAbsentActive]}
                          onPress={() => handleToggleAbsent(student.id)}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          testID={`absent-btn-${student.id}`}
                        >
                          <UserX size={13} color={isAbsent ? '#FFFFFF' : Colors.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.microBtn, isLate && styles.microBtnLateActive, isAbsent && styles.microBtnDisabled]}
                          onPress={() => !isAbsent && handleToggleLate(student.id)}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          testID={`late-btn-${student.id}`}
                        >
                          <Clock size={13} color={isLate ? '#FFFFFF' : isAbsent ? '#CCCCCC' : Colors.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.ratingRow, isAbsent && styles.ratingRowAbsent]}>
                        <RatingButton
                          type="+"
                          active={currentRating === '+'}
                          disabled={isAbsent}
                          onPress={() => handleRatingPress(student.id, '+')}
                        />
                        <RatingButton
                          type="o"
                          active={currentRating === 'o'}
                          disabled={isAbsent}
                          onPress={() => handleRatingPress(student.id, 'o')}
                        />
                        <RatingButton
                          type="-"
                          active={currentRating === '-'}
                          disabled={isAbsent}
                          onPress={() => handleRatingPress(student.id, '-')}
                        />
                      </View>
                    </View>
                  </View>

                  <LateEditRow
                    visible={isEditingLate}
                    initialMinutes={lateMin ?? 1}
                    onConfirm={(minutes) => handleLateEditConfirm(student.id, minutes)}
                    onCancel={() => setEditingLateStudentId(null)}
                  />

                  <ReasonMenu
                    visible={menuIsPositive}
                    reasons={POSITIVE_REASONS}
                    isNegative={false}
                    onSelect={(reason) => handleReasonSelect(student.id, '+', reason)}
                    onClose={handleCloseMenu}
                  />
                  <ReasonMenu
                    visible={menuIsNegative}
                    reasons={NEGATIVE_REASONS}
                    isNegative={true}
                    onSelect={(reason) => handleReasonSelect(student.id, '-', reason)}
                    onClose={handleCloseMenu}
                  />
                </View>
              );
            })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
  },
  emptyBackBtn: {
    width: '100%',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 0,
    zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: Colors.primaryLight,
  },
  statChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    fontVariant: ['tabular-nums'] as any,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  headerSubject: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  endBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  homeworkToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  homeworkToggleBtnText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  homeworkEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.negativeLight,
    borderWidth: 1,
    borderColor: '#F0D4D0',
  },
  homeworkEndBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.negative,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 100,
    backgroundColor: Colors.inputBg,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 100,
    backgroundColor: Colors.primary,
  },
  homeworkProgressFill: {
    backgroundColor: '#16A34A',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  homeworkLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 20,          // RADIUS.lg
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 8,
  },
  studentCard: {
    position: 'relative' as const,
    zIndex: 1,
  },
  studentCardOpen: {
    zIndex: 30,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 10 },
      android: { elevation: 3 },
      default: {},
    }),
  },
  studentRowAbsent: {
    backgroundColor: '#FAFAFA',
    opacity: 0.7,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,          // RADIUS.md
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPositive: {
    backgroundColor: Colors.positiveLight,
    borderWidth: 1.5,
    borderColor: Colors.positive,
  },
  avatarNegative: {
    backgroundColor: Colors.negativeLight,
    borderWidth: 1.5,
    borderColor: Colors.negative,
  },
  avatarAbsent: {
    backgroundColor: '#F0F0F2',
    borderWidth: 1.5,
    borderColor: '#C8C8CC',
  },
  avatarHomeworkDone: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#16A34A',
  },
  avatarHomeworkLate: {
    backgroundColor: Colors.warningLight,
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  avatarHomeworkMissing: {
    backgroundColor: Colors.negativeLight,
    borderWidth: 1.5,
    borderColor: Colors.negative,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  avatarTextPositive: {
    color: Colors.positive,
  },
  avatarTextNegative: {
    color: Colors.negative,
  },
  avatarTextAbsent: {
    color: '#999999',
  },
  studentTextWrap: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    flexShrink: 1,
  },
  studentNameAbsent: {
    color: '#AAAAAA',
    textDecorationLine: 'line-through' as const,
  },
  studentNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 120,
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  reasonBadgeRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,           // RADIUS.xs
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reasonBadgePos: {
    backgroundColor: Colors.positiveLight,
  },
  reasonBadgeNeg: {
    backgroundColor: Colors.negativeLight,
  },
  reasonBadgeText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  reasonBadgeTextPos: {
    color: Colors.positive,
  },
  reasonBadgeTextNeg: {
    color: Colors.negative,
  },
  absentBadge: {
    backgroundColor: '#F0F0F2',
  },
  absentBadgeText: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '500' as const,
  },
  lateBadge: {
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: '#F0C060',
  },
  lateBadgeActive: {
    borderColor: '#D97706',
    backgroundColor: '#FDE68A',
  },
  lateBadgeText: {
    color: '#D97706',
  },
  actionsAndRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  studentActionBtns: {
    flexDirection: 'column',
    gap: 5,
    alignItems: 'center',
  },
  microBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,           // RADIUS.xs
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  microBtnAbsentActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  microBtnLateActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  microBtnDisabled: {
    opacity: 0.35,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingRowAbsent: {
    opacity: 0.4,
  },
  ratingBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,          // RADIUS.md
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeworkBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,          // RADIUS.md
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonMenu: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    zIndex: 20,
    backgroundColor: Colors.white,
    borderRadius: 20,          // RADIUS.lg
    padding: 8,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 },
      android: { elevation: 3 },
      default: {},
    }),
  },
  reasonBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,          // RADIUS.md
    borderWidth: 1.5,
  },
  reasonBtnLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  reasonBtnLabelPos: {
    color: Colors.positive,
  },
  reasonBtnLabelNeg: {
    color: Colors.negative,
  },
  reasonBtnPositive: {
    backgroundColor: Colors.positiveLight,
    borderColor: Colors.positive,
  },
  reasonBtnNegative: {
    backgroundColor: Colors.negativeLight,
    borderColor: Colors.negative,
  },
  lateEditRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 20,          // RADIUS.lg
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F0C060',
  },
  lateEditLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#92400E',
  },
  lateEditInput: {
    width: 52,
    height: 34,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D97706',
    textAlign: 'center' as const,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    paddingHorizontal: 4,
  },
  lateEditMin: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#92400E',
    flex: 1,
  },
  lateEditBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lateEditBtnConfirm: {
    backgroundColor: '#D97706',
  },
  lateEditBtnCancel: {
    backgroundColor: '#E5E5EA',
  },
  lateEditBtnDisabled: {
    backgroundColor: '#E5E5EA',
  },
});
