import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Filter, TrendingUp, TrendingDown, Minus, Check, X, Clock, ThumbsUp, BookOpen, Users, ChevronRight, ArrowLeft, UserX, Timer, ChevronDown, ChevronUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';
import { useApp } from '@/context/AppContext';
import { StatisticsScreenSkeleton } from '@/components/SkeletonLoader';
import AppContainer from '@/components/ui/AppContainer';
import type { Student, SchoolClass } from '@/types';

function AnimatedBar({
  segments,
  trigger,
}: {
  segments: { flex: number; color: string; borderRadius?: object }[];
  trigger: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 550,
        useNativeDriver: false,
        delay: 80,
      }).start();
    } else {
      anim.setValue(0);
    }
  }, [trigger, anim]);

  const total = segments.reduce((s, seg) => s + seg.flex, 0);
  if (total === 0) return null;

  return (
    <View style={animBarStyles.bg}>
      {segments.map((seg, i) => {
        const widthPct = (seg.flex / total) * 100;
        const animWidth = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', `${widthPct}%`],
        });
        return (
          <Animated.View
            key={i}
            style={[
              animBarStyles.segment,
              { width: animWidth, backgroundColor: seg.color },
              seg.borderRadius ?? {},
            ]}
          />
        );
      })}
    </View>
  );
}

const animBarStyles = StyleSheet.create({
  bg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inputBg,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segment: {
    height: 8,
  },
});

function RatingRow({ positive, neutral, negative, total, trigger }: { positive: number; neutral: number; negative: number; total: number; trigger: boolean }) {
  if (total === 0) return <Text style={ratingStyles.noData}>Keine Daten</Text>;

  const segments = [
    ...(positive > 0 ? [{ flex: positive, color: Colors.positive, borderRadius: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 } }] : []),
    ...(neutral > 0 ? [{ flex: neutral, color: Colors.neutral }] : []),
    ...(negative > 0 ? [{ flex: negative, color: Colors.negative, borderRadius: { borderTopRightRadius: 4, borderBottomRightRadius: 4 } }] : []),
  ];

  return (
    <View style={ratingStyles.container}>
      <View style={ratingStyles.chips}>
        <View style={[ratingStyles.chip, { backgroundColor: Colors.positiveLight }]}>
          <Check size={11} color={Colors.positive} strokeWidth={2.8} />
          <Text style={[ratingStyles.chipNum, { color: Colors.positive }]}>{positive}</Text>
        </View>
        <View style={[ratingStyles.chip, { backgroundColor: Colors.neutralLight }]}>
          <Minus size={11} color={Colors.neutral} strokeWidth={2.8} />
          <Text style={[ratingStyles.chipNum, { color: Colors.neutral }]}>{neutral}</Text>
        </View>
        <View style={[ratingStyles.chip, { backgroundColor: Colors.negativeLight }]}>
          <X size={11} color={Colors.negative} strokeWidth={2.8} />
          <Text style={[ratingStyles.chipNum, { color: Colors.negative }]}>{negative}</Text>
        </View>
        <Text style={ratingStyles.total}>{total} gesamt</Text>
      </View>
      <AnimatedBar segments={segments} trigger={trigger} />
    </View>
  );
}

const ratingStyles = StyleSheet.create({
  container: { gap: 8 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
  },
  chipNum: { fontSize: 13, fontWeight: '700' as const },
  total: { fontSize: 12, color: Colors.textLight, marginLeft: 2 },
  noData: { fontSize: 13, color: Colors.textLight },
});

function HomeworkRow({ done, late, missing, total, trigger }: { done: number; late: number; missing: number; total: number; trigger: boolean }) {
  if (total === 0) return <Text style={ratingStyles.noData}>Keine Daten</Text>;

  const segments = [
    ...(done > 0 ? [{ flex: done, color: Colors.positive, borderRadius: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 } }] : []),
    ...(late > 0 ? [{ flex: late, color: Colors.warning }] : []),
    ...(missing > 0 ? [{ flex: missing, color: Colors.negative, borderRadius: { borderTopRightRadius: 4, borderBottomRightRadius: 4 } }] : []),
  ];

  return (
    <View style={ratingStyles.container}>
      <View style={ratingStyles.chips}>
        <View style={[ratingStyles.chip, { backgroundColor: Colors.positiveLight }]}>
          <Check size={11} color={Colors.positive} strokeWidth={2.8} />
          <Text style={[ratingStyles.chipNum, { color: Colors.positive }]}>{done}</Text>
        </View>
        <View style={[ratingStyles.chip, { backgroundColor: Colors.warningLight }]}>
          <Clock size={10} color={Colors.warning} strokeWidth={2.8} />
          <Text style={[ratingStyles.chipNum, { color: Colors.warning }]}>{late}</Text>
        </View>
        <View style={[ratingStyles.chip, { backgroundColor: Colors.negativeLight }]}>
          <X size={11} color={Colors.negative} strokeWidth={2.8} />
          <Text style={[ratingStyles.chipNum, { color: Colors.negative }]}>{missing}</Text>
        </View>
        <Text style={ratingStyles.total}>{total} gesamt</Text>
      </View>
      <AnimatedBar segments={segments} trigger={trigger} />
    </View>
  );
}

function ClassPickerScreen({
  classes,
  onSelect,
  insets,
}: {
  classes: SchoolClass[];
  onSelect: (cls: SchoolClass) => void;
  insets: { top: number };
}) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const q = searchQuery.toLowerCase().trim();
    return classes.filter((cls) => {
      if (cls.name.toLowerCase().includes(q)) return true;
      return cls.students.some(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q)
      );
    });
  }, [classes, searchQuery]);

  return (
    <AppContainer withPadding={false}>
      <View style={[pickerStyles.header, { paddingTop: UI.spacing.sm }]}>
        <Text style={pickerStyles.title}>Statistik</Text>
        <View style={pickerStyles.searchWrapper}>
          <BlurView intensity={Platform.OS === 'ios' ? 50 : 100} tint="light" style={pickerStyles.searchContainer}>
            <Search size={16} color={Colors.textSecondary} strokeWidth={2} />
            <TextInput
              style={pickerStyles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Klasse oder Schüler suchen..."
              placeholderTextColor={Colors.textLight}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={Colors.textSecondary} strokeWidth={1.8} />
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pickerStyles.list}>
        {filteredClasses.map((cls, index) => (
          <React.Fragment key={cls.id}>
            {index > 0 && <View style={pickerStyles.separator} />}
            <TouchableOpacity
              style={pickerStyles.card}
              onPress={() => onSelect(cls)}
              activeOpacity={0.55}
            >
              <View style={pickerStyles.cardLeft}>
                <View style={pickerStyles.classIcon}>
                  <Users size={18} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <View>
                  <Text style={pickerStyles.className}>{cls.name}</Text>
                  <Text style={pickerStyles.studentCount}>{cls.students.length} Schüler</Text>
                </View>
              </View>
              <ChevronRight size={18} color={Colors.textLight} strokeWidth={1.7} />
            </TouchableOpacity>
          </React.Fragment>
        ))}
        {filteredClasses.length === 0 && (
          <View style={pickerStyles.emptyContainer}>
            <View style={pickerStyles.emptyIcon}>
              <Users size={28} color={Colors.textLight} strokeWidth={1.4} />
            </View>
            <Text style={pickerStyles.emptyTitle}>Keine Ergebnisse</Text>
            <Text style={pickerStyles.emptySubtitle}>Suche anpassen</Text>
          </View>
        )}
      </ScrollView>
    </AppContainer>
  );
}

const pickerStyles = StyleSheet.create({
  header: { paddingHorizontal: UI.spacing.screenMargin, paddingBottom: UI.spacing.sm },
  title: { ...UI.font.largeTitle, color: Colors.text, marginBottom: UI.spacing.lg },
  searchWrapper: {
    marginBottom: UI.spacing.sm,
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Platform.select({ ios: 'rgba(255,255,255,0.5)', android: 'rgba(255,255,255,0.95)' }),
    borderRadius: UI.radius.xl,
    paddingHorizontal: 16, gap: UI.spacing.sm,
    overflow: 'hidden',
    borderWidth: Platform.select({ ios: 0.5, android: 0 }),
    borderColor: 'rgba(255,255,255,0.6)',
  },
  searchInput: { flex: 1, paddingVertical: 13, ...UI.font.body, color: Colors.text },
  list: { paddingHorizontal: UI.spacing.screenMargin, paddingBottom: 130 },
  separator: { height: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: UI.radius.xl, padding: UI.spacing.lg,
    ...UI.shadows.lg,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  classIcon: {
    width: 44, height: 44, borderRadius: UI.radius.md,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  className: { ...UI.font.headline, color: Colors.text },
  studentCount: { ...UI.font.caption, color: Colors.textSecondary, marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.neutralLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { ...UI.font.headline, color: Colors.text, marginBottom: 4 },
  emptySubtitle: { ...UI.font.body, color: Colors.textSecondary },
});

export default function StatisticsScreen() {
  const { data, isLoading } = useApp();
  const insets = useSafeAreaInsets();
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [search, setSearch] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'participation' | 'homework' | 'attendance'>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const multipleClasses = data.classes.length > 1;

  const activeClass = useMemo(() => {
    if (!multipleClasses) return data.classes[0] ?? null;
    return selectedClass;
  }, [multipleClasses, selectedClass, data.classes]);

  const studentsWithClass = useMemo(() => {
    if (!activeClass) return [];
    return activeClass.students
      .map((s) => ({ student: s, classId: activeClass.id, className: activeClass.name }))
      .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
  }, [activeClass]);

  const filtered = useMemo(() => {
    let items = studentsWithClass;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.student.firstName.toLowerCase().includes(q) ||
          i.student.lastName.toLowerCase().includes(q)
      );
    }
    return items;
  }, [studentsWithClass, search]);

  const getStudentStats = useCallback(
    (studentId: string) => {
      let entries = data.participations.filter((p) => p.studentId === studentId);
      if (filterSubject) entries = entries.filter((p) => p.subject === filterSubject);
      const positive = entries.filter((e) => e.rating === '+').length;
      const neutral = entries.filter((e) => e.rating === 'o').length;
      const negative = entries.filter((e) => e.rating === '-').length;
      return { positive, neutral, negative, total: entries.length };
    },
    [data.participations, filterSubject]
  );

  const getHomeworkStats = useCallback(
    (studentId: string) => {
      let filteredHw = (data.homeworkEntries || []).filter((h) => h.studentId === studentId);
      if (filterSubject) filteredHw = filteredHw.filter((h) => h.subject === filterSubject);
      const done = filteredHw.filter((h) => h.status === 'done').length;
      const late = filteredHw.filter((h) => h.status === 'late').length;
      const missing = filteredHw.filter((h) => h.status === 'missing').length;
      return { done, late, missing, total: filteredHw.length };
    },
    [data.homeworkEntries, filterSubject]
  );

  const getAttendanceStats = useCallback(
    (studentId: string) => {
      let absEntries = (data.absenceEntries || []).filter((a) => a.studentId === studentId);
      let lateEntries = (data.lateEntries || []).filter((l) => l.studentId === studentId);
      if (filterSubject) {
        absEntries = absEntries.filter((a) => a.subject === filterSubject);
        lateEntries = lateEntries.filter((l) => l.subject === filterSubject);
      }
      const absentCount = absEntries.length;
      const lateCount = lateEntries.length;
      const avgLateMinutes = lateCount > 0
        ? Math.round(lateEntries.reduce((sum, l) => sum + l.minutes, 0) / lateCount)
        : 0;
      return { absentCount, lateCount, avgLateMinutes };
    },
    [data.absenceEntries, data.lateEntries, filterSubject]
  );

  if (isLoading) return <StatisticsScreenSkeleton />;

  if (multipleClasses && !activeClass) {
    return (
      <ClassPickerScreen
        classes={data.classes}
        onSelect={(cls) => setSelectedClass(cls)}
        insets={insets}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        {multipleClasses && activeClass && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setSelectedClass(null);
              setSearch('');
              setFilterSubject(null);
              setFilterCategory('all');
              setShowFilters(false);
            }}
            activeOpacity={0.6}
          >
            <ArrowLeft size={17} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.backBtnText}>Klassen</Text>
          </TouchableOpacity>
        )}

        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>
            {activeClass ? activeClass.name : 'Statistik'}
          </Text>
          <View style={styles.filterBtnWrapper}>
            <BlurView intensity={80} tint="light" style={styles.filterBtnBlur}>
              <TouchableOpacity
                style={styles.filterIconBtn}
                onPress={() => setShowFilters(!showFilters)}
                activeOpacity={0.7}
              >
                <Filter size={18} color={showFilters ? Colors.text : Colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </BlurView>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <BlurView intensity={Platform.OS === 'ios' ? 50 : 100} tint="light" style={styles.searchContainer}>
            <Search size={16} color={Colors.textSecondary} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Schüler suchen..."
              placeholderTextColor={Colors.textLight}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={Colors.textSecondary} strokeWidth={1.8} />
              </TouchableOpacity>
            )}
          </BlurView>
        </View>

        {showFilters && (
          <View style={styles.filtersWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowContent}>
              {[
                { key: 'all', label: 'Alles' },
                { key: 'participation', label: 'Mitarbeit', Icon: ThumbsUp },
                { key: 'homework', label: 'Hausaufgaben', Icon: BookOpen },
                { key: 'attendance', label: 'Anwesenheit', Icon: UserX },
              ].map(({ key, label, Icon }) => {
                const active = filterCategory === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterCategory(key as typeof filterCategory)}
                    activeOpacity={0.7}
                  >
                    {Icon && <Icon size={12} color={active ? Colors.white : Colors.textSecondary} strokeWidth={2} />}
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {data.profile.subjects.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowContent}>
                <TouchableOpacity
                  style={[styles.chip, !filterSubject && styles.chipActive]}
                  onPress={() => setFilterSubject(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, !filterSubject && styles.chipTextActive]}>Alle Fächer</Text>
                </TouchableOpacity>
                {data.profile.subjects.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, filterSubject === s && styles.chipActive]}
                    onPress={() => setFilterSubject(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, filterSubject === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Keine Ergebnisse</Text>
            <Text style={styles.emptySubtitle}>Suche oder Filter anpassen</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const stats = getStudentStats(item.student.id);
            const hwStats = getHomeworkStats(item.student.id);
            const attendanceStats = getAttendanceStats(item.student.id);
            const trend = stats.total > 0 ? stats.positive - stats.negative : 0;
            const cardKey = `${item.classId}-${item.student.id}`;
            const isExpanded = expandedIds.has(cardKey);

            return (
              <StudentCard
                key={cardKey}
                cardKey={cardKey}
                student={item.student}
                stats={stats}
                hwStats={hwStats}
                attendanceStats={attendanceStats}
                trend={trend}
                isExpanded={isExpanded}
                filterCategory={filterCategory}
                onToggle={() => toggleExpanded(cardKey)}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

type StudentCardProps = {
  cardKey: string;
  student: Student;
  stats: { positive: number; neutral: number; negative: number; total: number };
  hwStats: { done: number; late: number; missing: number; total: number };
  attendanceStats: { absentCount: number; lateCount: number; avgLateMinutes: number };
  trend: number;
  isExpanded: boolean;
  filterCategory: 'all' | 'participation' | 'homework' | 'attendance';
  onToggle: () => void;
};

const StudentCard = React.memo(function StudentCard({
  student,
  stats,
  hwStats,
  attendanceStats,
  trend,
  isExpanded,
  filterCategory,
  onToggle,
}: StudentCardProps) {
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, expandAnim]);

  const initials = `${(student.firstName || '?')[0]}${(student.lastName || '?')[0]}`;
  const showParticipation = filterCategory === 'all' || filterCategory === 'participation';
  const showHomework = filterCategory === 'all' || filterCategory === 'homework';
  const showAttendance = filterCategory === 'all' || filterCategory === 'attendance';

  return (
    <View style={cardStyles.card}>
      <TouchableOpacity
        style={cardStyles.header}
        onPress={onToggle}
        activeOpacity={0.6}
      >
        <View style={cardStyles.left}>
          <View style={[
            cardStyles.avatar,
            trend > 0 && cardStyles.avatarPos,
            trend < 0 && cardStyles.avatarNeg,
          ]}>
            <Text style={[
              cardStyles.avatarText,
              trend > 0 && { color: Colors.positive },
              trend < 0 && { color: Colors.negative },
            ]}>{initials}</Text>
          </View>
          <View style={cardStyles.nameWrap}>
            <Text style={cardStyles.name} numberOfLines={1}>
              {student.lastName}{student.lastName ? ', ' : ''}{student.firstName}
            </Text>
            {!isExpanded && (
              <Text style={cardStyles.hint} numberOfLines={1}>
                {[
                  stats.total > 0 && `${stats.total} Bewertungen`,
                  attendanceStats.absentCount > 0 && `${attendanceStats.absentCount}× gefehlt`,
                  attendanceStats.lateCount > 0 && `${attendanceStats.lateCount}× zu spät`,
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
        </View>

        <View style={cardStyles.right}>
          {stats.total > 0 && (
            <View style={[cardStyles.trendBadge, {
              backgroundColor: trend > 0 ? Colors.positiveLight : trend < 0 ? Colors.negativeLight : Colors.neutralLight,
            }]}>
              {trend > 0
                ? <TrendingUp size={14} color={Colors.positive} strokeWidth={2} />
                : trend < 0
                ? <TrendingDown size={14} color={Colors.negative} strokeWidth={2} />
                : <Minus size={14} color={Colors.neutral} strokeWidth={2} />}
            </View>
          )}
          <View style={[cardStyles.chevronBtn, isExpanded && cardStyles.chevronBtnActive]}>
            {isExpanded
              ? <ChevronUp size={15} color={Colors.primary} strokeWidth={2.2} />
              : <ChevronDown size={15} color={Colors.textSecondary} strokeWidth={2.2} />}
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <Animated.View style={{ opacity: expandAnim }}>
          <View style={cardStyles.divider} />
          <View style={cardStyles.body}>
            {showParticipation && (
              <View style={cardStyles.section}>
                <View style={cardStyles.sectionHead}>
                  <View style={cardStyles.sectionLabel}>
                    <ThumbsUp size={12} color={Colors.textLight} strokeWidth={2} />
                    <Text style={cardStyles.sectionTitle}>MITARBEIT</Text>
                  </View>
                </View>
                <RatingRow {...stats} trigger={isExpanded} />
              </View>
            )}

            {(filterCategory === 'all') && showParticipation && showHomework && (
              <View style={cardStyles.innerDivider} />
            )}

            {showHomework && (
              <View style={cardStyles.section}>
                <View style={cardStyles.sectionHead}>
                  <View style={cardStyles.sectionLabel}>
                    <BookOpen size={12} color={Colors.textLight} strokeWidth={2} />
                    <Text style={cardStyles.sectionTitle}>HAUSAUFGABEN</Text>
                  </View>
                </View>
                <HomeworkRow {...hwStats} trigger={isExpanded} />
              </View>
            )}

            {(filterCategory === 'all') && showHomework && showAttendance && (
              <View style={cardStyles.innerDivider} />
            )}

            {showAttendance && (
              <View style={cardStyles.section}>
                <View style={cardStyles.sectionHead}>
                  <View style={cardStyles.sectionLabel}>
                    <UserX size={12} color={Colors.textLight} strokeWidth={2} />
                    <Text style={cardStyles.sectionTitle}>ANWESENHEIT</Text>
                  </View>
                </View>
                <View style={cardStyles.attendanceRow}>
                  <View style={[cardStyles.attChip, { backgroundColor: Colors.negativeLight }]}>
                    <UserX size={13} color={Colors.negative} strokeWidth={2.2} />
                    <View>
                      <Text style={[cardStyles.attValue, { color: Colors.negative }]}>{attendanceStats.absentCount}×</Text>
                      <Text style={[cardStyles.attLabel, { color: Colors.negative }]}>Gefehlt</Text>
                    </View>
                  </View>
                  <View style={[cardStyles.attChip, { backgroundColor: Colors.warningLight }]}>
                    <Timer size={13} color={Colors.warning} strokeWidth={2.2} />
                    <View>
                      <Text style={[cardStyles.attValue, { color: Colors.warning }]}>{attendanceStats.lateCount}×</Text>
                      <Text style={[cardStyles.attLabel, { color: Colors.warning }]}>Zu spät</Text>
                    </View>
                  </View>
                  {attendanceStats.lateCount > 0 && (
                    <View style={[cardStyles.attChip, { backgroundColor: Colors.warningLight }]}>
                      <Clock size={13} color={Colors.warning} strokeWidth={2.2} />
                      <View>
                        <Text style={[cardStyles.attValue, { color: Colors.warning }]}>Ø {attendanceStats.avgLateMinutes}&apos;</Text>
                        <Text style={[cardStyles.attLabel, { color: Colors.warning }]}>Ø Minuten</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: UI.radius.xl,
    overflow: 'hidden',
    ...UI.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: UI.spacing.lg,
    paddingVertical: 16,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: UI.radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarPos: { backgroundColor: Colors.positiveLight, borderWidth: 1.5, borderColor: Colors.positive },
  avatarNeg: { backgroundColor: Colors.negativeLight, borderWidth: 1.5, borderColor: Colors.negative },
  avatarText: { ...UI.font.body, fontWeight: '700' as const, color: Colors.primary },
  nameWrap: { flex: 1 },
  name: { ...UI.font.headline, color: Colors.text, letterSpacing: -0.1 },
  hint: { ...UI.font.caption, color: Colors.textSecondary, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendBadge: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, // RADIUS.md
  chevronBtn: {
    width: 36, height: 36, borderRadius: UI.radius.md,
    backgroundColor: Colors.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  chevronBtnActive: { backgroundColor: Colors.primaryLight },
  divider: { height: 1, backgroundColor: Colors.divider },
  body: { padding: UI.spacing.lg, gap: 0 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700' as const,
    color: Colors.textLight, letterSpacing: 1,
  },
  innerDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },
  attendanceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  attChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: UI.radius.md,
  },
  attValue: { ...UI.font.headline, lineHeight: 18 },
  attLabel: { ...UI.font.caption, opacity: 0.8 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  backBtnText: { ...UI.font.body, fontWeight: '500' as const, color: Colors.primary },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { ...UI.font.largeTitle, color: Colors.text, letterSpacing: -0.5 },
  filterBtnWrapper: {
    borderRadius: 22,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  filterBtnBlur: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  filterIconBtn: {
    width: 44, height: 44,
    backgroundColor: Platform.select({ ios: 'rgba(255,255,255,0.4)', android: 'rgba(255,255,255,0.9)' }),
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrapper: {
    marginTop: UI.spacing.sm,
    marginBottom: UI.spacing.xs,
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Platform.select({ ios: 'rgba(255,255,255,0.5)', android: 'rgba(255,255,255,0.95)' }),
    borderRadius: UI.radius.xl,
    paddingHorizontal: 16, gap: 8,
    overflow: 'hidden',
    borderWidth: Platform.select({ ios: 0.5, android: 0 }),
    borderColor: 'rgba(255,255,255,0.6)',
  },
  searchInput: { flex: 1, paddingVertical: 13, ...UI.font.body, color: Colors.text },
  filtersWrap: { gap: 8, paddingTop: 2 },
  filterRowContent: { gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: Colors.white,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  chipActive: {
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  chipText: { ...UI.font.caption, fontWeight: '600' as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  list: { flex: 1 },
  listContent: { padding: UI.spacing.screenMargin, gap: 12, paddingBottom: 130 },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { ...UI.font.headline, color: Colors.text, marginBottom: 6 },
  emptySubtitle: { ...UI.font.body, color: Colors.textSecondary },
});
