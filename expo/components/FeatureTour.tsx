import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, PartyPopper, BookOpen } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useTutorial } from '@/context/TutorialContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SpotlightRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

interface TourStep {
  tab: 'schedule' | 'classes' | 'settings' | null;
  spotlight: SpotlightRegion | null;
  bubbleText: string;
  bubblePosition: 'below' | 'above' | 'center';
  arrowDirection: 'up' | 'down' | 'left' | 'right' | 'none';
  sectionTitle?: string;
  showLockScreen?: boolean;
}

const TOTAL_STEPS = 10;
const TAB_BAR_HEIGHT_IOS = 49;
const TAB_BAR_HEIGHT_ANDROID = 56;

export default function FeatureTour() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showTutorial, currentStep, nextStep, skipTutorial } = useTutorial();

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const bubbleTranslateY = useRef(new Animated.Value(20)).current;
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  const confettiScale = useRef(new Animated.Value(0.3)).current;

  const tabWidth = SCREEN_WIDTH / 5;

  const tabBarVisualHeight = Platform.OS === 'ios' ? TAB_BAR_HEIGHT_IOS : TAB_BAR_HEIGHT_ANDROID;
  const tabBarTotalHeight = tabBarVisualHeight + insets.bottom;
  const tabBarTop = SCREEN_HEIGHT - tabBarTotalHeight;

  const steps = useMemo((): TourStep[] => {
    const headerTop = insets.top + 8;
    const spotW = 72;
    const spotH = tabBarVisualHeight - 4;

    const classesX = 2 * tabWidth + (tabWidth - spotW) / 2;
    const scheduleX = 1 * tabWidth + (tabWidth - spotW) / 2;
    const settingsX = 4 * tabWidth + (tabWidth - spotW) / 2;

    const tabSpotY = tabBarTop + (tabBarVisualHeight - spotH) / 2;

    return [
      {
        tab: null,
        spotlight: { x: classesX, y: tabSpotY, width: spotW, height: spotH, borderRadius: 26 },
        bubbleText: 'Basis schaffen: Hier verwaltest du deine Klassen.',
        bubblePosition: 'above',
        arrowDirection: 'down',
        sectionTitle: 'Teil 1: Das Fundament',
      },
      {
        tab: 'classes',
        spotlight: { x: SCREEN_WIDTH - 20 - 68, y: SCREEN_HEIGHT - tabBarTotalHeight - 20 - 68, width: 68, height: 68, borderRadius: 34 },
        bubbleText: 'Klasse anlegen (z.B. 10b).',
        bubblePosition: 'above',
        arrowDirection: 'down',
      },
      {
        tab: 'classes',
        spotlight: { x: 16, y: insets.top + 66, width: SCREEN_WIDTH - 32, height: 88, borderRadius: 24 },
        bubbleText: 'Lehrer & Schülerliste hinzufügen. Wichtig für dein Live-Tracking!',
        bubblePosition: 'below',
        arrowDirection: 'up',
      },
      {
        tab: null,
        spotlight: { x: scheduleX, y: tabSpotY, width: spotW, height: spotH, borderRadius: 26 },
        bubbleText: 'Dein Zentrum: Hier findet dein Alltag statt.',
        bubblePosition: 'above',
        arrowDirection: 'down',
        sectionTitle: 'Teil 2: Die Planung',
      },
      {
        tab: 'schedule',
        spotlight: { x: SCREEN_WIDTH - 14 - 46, y: headerTop - 4, width: 46, height: 46, borderRadius: 23 },
        bubbleText: 'Planen: Wähle zwischen regulärer Stunde, Event oder Vertretung.',
        bubblePosition: 'below',
        arrowDirection: 'up',
      },
      {
        tab: 'schedule',
        spotlight: { x: SCREEN_WIDTH * 0.12, y: headerTop + 44, width: SCREEN_WIDTH * 0.76, height: 48, borderRadius: 24 },
        bubbleText: 'Wochenwechsel: Tippen oder einfach wischen.',
        bubblePosition: 'below',
        arrowDirection: 'up',
      },
      {
        tab: null,
        spotlight: { x: settingsX, y: tabSpotY, width: spotW, height: spotH, borderRadius: 26 },
        bubbleText: 'Einstellungen: Hier verwaltest du Profil, Sicherheit und Backup.',
        bubblePosition: 'above',
        arrowDirection: 'down',
        sectionTitle: 'Teil 3: Die Einstellungen',
      },
      {
        tab: 'settings',
        spotlight: null,
        bubbleText: 'Daten sichern & exportieren: Erstelle Backups und exportiere Statistiken als Excel, CSV oder PDF.',
        bubblePosition: 'center',
        arrowDirection: 'none',
      },
      {
        tab: 'settings',
        spotlight: null,
        bubbleText: 'Hilfe: Falls du später etwas vergessen hast, findest du hier „Tour erneut starten".',
        bubblePosition: 'center',
        arrowDirection: 'none',
      },
      {
        tab: null,
        spotlight: null,
        bubbleText: 'Live-Status: Während der Stunde siehst du deinen Fortschritt auf dem Sperrbildschirm.',
        bubblePosition: 'center',
        arrowDirection: 'none',
        sectionTitle: 'Teil 4: Live-Funktionen',
        showLockScreen: true,
      },
    ];
  }, [insets.top, tabBarVisualHeight, tabBarTotalHeight, tabWidth, tabBarTop]);

  useEffect(() => {
    if (!showTutorial) return;
    const step = steps[currentStep];
    if (!step || !step.tab) return;

    const timer = setTimeout(() => {
      if (step.tab === 'classes') {
        router.navigate('/classes' as never);
      } else if (step.tab === 'schedule') {
        router.navigate('/schedule' as never);
      } else if (step.tab === 'settings') {
        router.navigate('/settings' as never);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [showTutorial, currentStep, steps, router]);

  useEffect(() => {
    if (showTutorial) {
      overlayOpacity.setValue(0);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showTutorial, overlayOpacity]);

  useEffect(() => {
    if (!showTutorial) return;

    bubbleScale.setValue(0.7);
    bubbleTranslateY.setValue(15);
    Animated.parallel([
      Animated.spring(bubbleScale, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    if (currentStep === TOTAL_STEPS - 1) {
      confettiOpacity.setValue(0);
      confettiScale.setValue(0.3);
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(confettiOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(confettiScale, {
            toValue: 1,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [showTutorial, currentStep, bubbleScale, bubbleTranslateY, confettiOpacity, confettiScale]);

  if (!showTutorial) return null;

  const step = steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const spotlight = step.spotlight;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastStep) {
      setTimeout(() => {
        router.navigate('/schedule' as never);
      }, 100);
    }
    nextStep(TOTAL_STEPS);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.navigate('/schedule' as never);
    skipTutorial();
  };

  const pad = 0;

  const renderSpotlightOverlay = () => {
    if (!spotlight) {
      return (
        <View style={styles.overlayFull} />
      );
    }

    const sx = spotlight.x - pad;
    const sy = spotlight.y - pad;
    const sw = spotlight.width + pad * 2;
    const sh = spotlight.height + pad * 2;

    const r = spotlight.borderRadius;
    const effectiveR = Math.min(r, Math.floor(sw / 2), Math.floor(sh / 2));

    return (
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.overlayPiece, { top: 0, left: 0, right: 0, height: sy }]} />
        <View style={[styles.overlayPiece, { top: sy, left: 0, width: sx, height: sh }]} />
        <View style={[styles.overlayPiece, { top: sy, left: sx + sw, right: 0, height: sh }]} />
        <View style={[styles.overlayPiece, { top: sy + sh, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.overlayPiece, { top: sy, left: sx, width: effectiveR, height: effectiveR, borderBottomRightRadius: effectiveR }]} />
        <View style={[styles.overlayPiece, { top: sy, left: sx + sw - effectiveR, width: effectiveR, height: effectiveR, borderBottomLeftRadius: effectiveR }]} />
        <View style={[styles.overlayPiece, { top: sy + sh - effectiveR, left: sx, width: effectiveR, height: effectiveR, borderTopRightRadius: effectiveR }]} />
        <View style={[styles.overlayPiece, { top: sy + sh - effectiveR, left: sx + sw - effectiveR, width: effectiveR, height: effectiveR, borderTopLeftRadius: effectiveR }]} />
        <View
          style={[
            styles.spotlightBorder,
            {
              top: sy - 2,
              left: sx - 2,
              width: sw + 4,
              height: sh + 4,
              borderRadius: effectiveR + 2,
            },
          ]}
          pointerEvents="none"
        />
      </View>
    );
  };

  const getBubblePosition = (): { top?: number; bottom?: number; left: number; right: number } => {
    if (step.bubblePosition === 'center' || !spotlight) {
      return { top: SCREEN_HEIGHT * 0.28, left: 32, right: 32 };
    }

    const sy = spotlight.y - pad;
    const sh = spotlight.height + pad * 2;

    if (step.bubblePosition === 'below') {
      return { top: sy + sh + 20, left: 32, right: 32 };
    }

    return { bottom: SCREEN_HEIGHT - sy + 20, left: 32, right: 32 };
  };

  const getArrowPosition = () => {
    if (!spotlight || step.arrowDirection === 'none') return null;

    const sx = spotlight.x - pad;
    const sy = spotlight.y - pad;
    const sw = spotlight.width + pad * 2;
    const sh = spotlight.height + pad * 2;

    if (step.arrowDirection === 'up') {
      return {
        left: Math.min(Math.max(sx + sw / 2 - 8, 40), SCREEN_WIDTH - 60),
        top: sy + sh + 6,
      };
    }
    if (step.arrowDirection === 'down') {
      return {
        left: Math.min(Math.max(sx + sw / 2 - 8, 40), SCREEN_WIDTH - 60),
        top: sy - 22,
      };
    }
    if (step.arrowDirection === 'left') {
      return {
        left: sx + sw + 4,
        top: sy + sh / 2 - 8,
      };
    }
    return null;
  };

  const bubblePos = getBubblePosition();
  const arrowPos = getArrowPosition();

  const renderLockScreenMock = () => (
    <View style={styles.lockScreenContainer}>
      <View style={styles.lockScreenNotif}>
        <View style={styles.lockScreenRow}>
          <View style={styles.lockScreenIcon}>
            <BookOpen size={11} color="#fff" strokeWidth={2.2} />
          </View>
          <Text style={styles.lockScreenApp}>LehrPlan</Text>
          <Text style={styles.lockScreenNow}>jetzt</Text>
        </View>
        <Text style={styles.lockScreenTitle}>Mathe · 10b</Text>
        <Text style={styles.lockScreenSub}>Raum 204 · noch 23 Min</Text>
        <View style={styles.lockScreenBarBg}>
          <View style={[styles.lockScreenBarFill, { width: '62%' }]} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
        pointerEvents="box-none"
      >
        {renderSpotlightOverlay()}
      </Animated.View>

      <Animated.View
        style={[
          styles.stepIndicator,
          { top: insets.top + 12, opacity: overlayOpacity },
        ]}
        pointerEvents="none"
      >
        {steps.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.stepDot,
              idx === currentStep && styles.stepDotActive,
              idx < currentStep && styles.stepDotCompleted,
            ]}
          />
        ))}
      </Animated.View>

      {arrowPos && (
        <Animated.View
          style={[styles.arrowContainer, { left: arrowPos.left, top: arrowPos.top, opacity: overlayOpacity }]}
          pointerEvents="none"
        >
          {step.arrowDirection === 'up' && <View style={styles.arrowUp} />}
          {step.arrowDirection === 'down' && <View style={styles.arrowDown} />}
          {step.arrowDirection === 'left' && <View style={styles.arrowLeft} />}
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.bubbleContainer,
          bubblePos,
          {
            transform: [
              { scale: bubbleScale },
              { translateY: bubbleTranslateY },
            ],
            opacity: overlayOpacity,
          },
        ]}
      >
        <View style={styles.bubble}>
          {step.sectionTitle && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{step.sectionTitle}</Text>
            </View>
          )}

          {isLastStep && (
            <Animated.View
              style={[
                styles.confettiIcon,
                { opacity: confettiOpacity, transform: [{ scale: confettiScale }] },
              ]}
            >
              <PartyPopper size={28} color="#F59E0B" strokeWidth={1.8} />
            </Animated.View>
          )}

          {step.showLockScreen && renderLockScreenMock()}

          <Text style={styles.bubbleText}>{step.bubbleText}</Text>

          {isLastStep && (
            <Text style={styles.finishSubtext}>Viel Erfolg!</Text>
          )}

          <View style={styles.bottomRow}>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.nextBtnText}>
                {isLastStep ? 'Los geht\'s' : 'Weiter'}
              </Text>
              {!isLastStep && (
                <ChevronRight size={15} color={Colors.white} strokeWidth={2.5} />
              )}
            </TouchableOpacity>

            {!isLastStep && (
              <TouchableOpacity
                onPress={handleSkip}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.skipText}>Überspringen</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.stepCount}>
            {currentStep + 1} / {TOTAL_STEPS}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  overlayPiece: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  stepIndicator: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
    flexWrap: 'wrap',
    maxWidth: SCREEN_WIDTH * 0.6,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  stepDotActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 18,
    borderRadius: 3,
  },
  stepDotCompleted: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  arrowContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  arrowLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
  },
  bubbleContainer: {
    position: 'absolute',
    zIndex: 10000,
  },
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 36,
    padding: 22,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.18)',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 1,
        shadowRadius: 36,
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  sectionBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: 'rgba(22,23,26,0.85)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  confettiIcon: {
    alignSelf: 'center' as const,
    marginBottom: 8,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  finishSubtext: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
    borderRadius: 100,
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 4,
    flex: 1,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textLight,
    letterSpacing: 0.2,
  },
  stepCount: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textLight,
    textAlign: 'center' as const,
    marginTop: 10,
  },
  lockScreenContainer: {
    marginBottom: 14,
    alignItems: 'center' as const,
  },
  lockScreenNotif: {
    backgroundColor: 'rgba(28,28,30,0.82)',
    borderRadius: 24,
    padding: 14,
    width: '100%',
  },
  lockScreenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  lockScreenIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3A3A3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  lockScreenApp: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#8E8E93',
    flex: 1,
  },
  lockScreenNow: {
    fontSize: 11,
    color: '#8E8E93',
  },
  lockScreenTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  lockScreenSub: {
    fontSize: 12,
    color: '#AEAEB2',
    marginBottom: 10,
  },
  lockScreenBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3C',
    overflow: 'hidden' as const,
  },
  lockScreenBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#30D158',
  },
});
