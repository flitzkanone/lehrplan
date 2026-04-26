/**
 * onboarding.tsx
 *
 * WHY NO TEXTINPUT FOR PIN:
 *   - A user-typed 6-digit PIN is a weak AES key (only ~20 bits of entropy).
 *   - TextInput with autoFocus causes iOS to flash a white keyboard-avoidance
 *     overlay that blocks the entire screen — the reported UX bug.
 *   - System biometric (Face ID / Touch ID / Device Passcode) is:
 *       ① More secure: proves device ownership, not just knowledge of 6 digits.
 *       ② Faster UX: no typing, no confirmation, no mismatch errors.
 *       ③ Standard in Banking / Health apps (Apple Pay, N26, etc.).
 *
 * HOW IT WORKS:
 *   Step 3 ("auth") generates a cryptographically strong 32-byte random PIN
 *   (never shown to the user) and asks the OS to authenticate the device owner
 *   via expo-local-authentication. On success:
 *     - The random PIN is stored in SecureStore (BIOMETRIC_PIN_KEY).
 *     - completeOnboarding() uses it as the AES-256 encryption key.
 *     - lock.tsx retrieves it from SecureStore after every future biometric unlock.
 *
 * FALLBACK:
 *   If biometrics are not enrolled, LocalAuthentication falls back to the
 *   device passcode (disableDeviceFallback: false). The user can always retry.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, CheckCircle, Fingerprint, RefreshCw } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Colors from '@/constants/colors';
import { ALL_SUBJECTS } from '@/constants/subjects';
import { useApp } from '@/context/AppContext';
import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';

// Must match the constant in lock.tsx so unlock can retrieve the PIN.
const BIOMETRIC_PIN_KEY = 'teacher_app_biometric_pin';

/** Generates a cryptographically random 32-byte hex string used as the AES key. */
function generateStrongPin(): string {
  const bytes = new Uint8Array(32);
  // use expo-crypto for cross-platform secure random values
  Crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type Step = 'privacy' | 'profile' | 'auth' | 'subjects' | 'processing';

type AuthState = 'idle' | 'authenticating' | 'success' | 'failed' | 'cancelled';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding, acceptPrivacy } = useApp();

  const [step, setStep] = useState<Step>('privacy');
  const [name, setName] = useState<string>('');
  const [school, setSchool] = useState<string>('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // The internally generated PIN — never displayed to the user.
  const generatedPinRef = useRef<string>('');

  // Auth step state
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [authHint, setAuthHint] = useState<string>('');

  // Processing Step State
  const [progressText, setProgressText] = useState('Vorbereiten...');
  const [realProgressPercent, setRealProgressPercent] = useState(0);
  const [displayProgressPercent, setDisplayProgressPercent] = useState(0);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScaleAnim = useRef(new Animated.Value(0)).current;
  const processingPulseAnim = useRef(new Animated.Value(1)).current;
  const processingProgressAnim = useRef(new Animated.Value(0)).current;
  const displayedProgressRef = useRef(0);
  const processingStartedAtRef = useRef<number | null>(null);

  // ─── Pulse animation for the shield icon while waiting ───────────────────
  useEffect(() => {
    if (authState === 'authenticating' || authState === 'idle') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [authState, pulseAnim]);

  // ─── Success animation ────────────────────────────────────────────────────
  const playSuccess = useCallback(() => {
    Animated.spring(successScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 6,
    }).start();
  }, [successScaleAnim]);

  // Processing spinner pulse starts before storage/encryption work.
  useEffect(() => {
    if (step !== 'processing') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(processingPulseAnim, { toValue: 1.08, duration: 650, useNativeDriver: true }),
        Animated.timing(processingPulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [processingPulseAnim, step]);

  useEffect(() => {
    const id = processingProgressAnim.addListener(({ value }) => {
      displayedProgressRef.current = value;
      const rounded = Math.round(value);
      setDisplayProgressPercent(rounded);
      // Dynamic status text — gives the user a sense of forward movement
      if (!isSetupComplete) {
        if (rounded >= 70) {
          setProgressText('Fast fertig…');
        } else if (rounded >= 30) {
          setProgressText('Einrichtung läuft…');
        }
      }
    });
    return () => processingProgressAnim.removeListener(id);
  }, [isSetupComplete, processingProgressAnim]);

  // ─── Fake + Real Progress Driver ─────────────────────────────────────────
  // WHY: Animated.timing inside setInterval stacks competing animations and
  // causes the bar to freeze. Instead, we use setInterval to mutate a ref
  // directly and call setValue() — one clean update per tick, no queue.
  useEffect(() => {
    if (step !== 'processing' || isSetupComplete) return;

    const interval = setInterval(() => {
      const current = displayedProgressRef.current;

      // Never exceed 90% before the real work is done.
      // Real progress injected from completeOnboarding callbacks raises the floor.
      const realFloor = realProgressPercent * 0.88;
      const fakeNext = current + 0.6; // ~0.6% per 120ms ≈ full bar in ~18s
      const next = Math.min(90, Math.max(fakeNext, realFloor));

      if (next > current) {
        // Drive the Animated.Value directly — no stacking, no freezing.
        processingProgressAnim.setValue(next);
      }
    }, 120);

    return () => clearInterval(interval);
  // realProgressPercent intentionally excluded — the ref is read inside the interval
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetupComplete, processingProgressAnim, step]);

  useEffect(() => {
    if (!isSetupComplete) return;

    // WHY Animated.timing here (not setValue): the completion snap-to-100
    // benefits from an ease-out curve so it feels fast but not abrupt.
    Animated.timing(processingProgressAnim, {
      toValue: 100,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isSetupComplete, processingProgressAnim]);

  // ─── Cross-step fade transition ───────────────────────────────────────────
  const animateTransition = useCallback(
    (next: Step) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start(() => {
        setStep(next);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim]
  );

  // ─── OS Biometric / Passcode Auth ─────────────────────────────────────────
  /**
   * Triggers the OS authentication sheet.
   *
   * WHY disableDeviceFallback: false?
   *   If the user has not enrolled biometrics (no Face ID / no fingerprint),
   *   the OS fallback to the Device Passcode is the correct UX.
   *   This matches lock.tsx behaviour to keep the unlock experience consistent.
   */
  const triggerAuth = useCallback(async () => {
    if (authState === 'authenticating' || authState === 'success') return;

    setAuthState('authenticating');
    setAuthHint('');

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasBiometricType = supportedTypes.some(
        (type) =>
          type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION ||
          type === LocalAuthentication.AuthenticationType.FINGERPRINT ||
          type === LocalAuthentication.AuthenticationType.IRIS
      );

      if (!hasHardware || !isEnrolled || !hasBiometricType) {
        setAuthHint(
          'Biometrie nicht verfügbar. Bitte richten Sie Face ID / Fingerabdruck in den Geräteeinstellungen ein.'
        );
        setAuthState('failed');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Entsperren',
        fallbackLabel: 'Passcode verwenden',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Generate a strong random PIN and persist it in SecureStore.
        // This PIN is the AES encryption key; it never leaves the device.
        const newPin = generateStrongPin();
        generatedPinRef.current = newPin;
        await SecureStore.setItemAsync(BIOMETRIC_PIN_KEY, newPin);

        setAuthState('success');
        playSuccess();

        // Brief success display, then advance.
        setTimeout(() => {
          animateTransition('subjects');
        }, 700);
      } else if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        // User explicitly cancelled — stay on screen, show retry option.
        setAuthState('cancelled');
        setAuthHint('Authentifizierung abgebrochen. Tippen Sie zum Wiederholen.');
      } else {
        setAuthState('failed');
        setAuthHint('Authentifizierung fehlgeschlagen. Tippen Sie zum Wiederholen.');
      }
    } catch (e) {
      console.error('[Onboarding] Auth error:', e);
      setAuthState('failed');
      setAuthHint('Systemfehler. Bitte erneut versuchen.');
    }
  }, [authState, animateTransition, playSuccess]);

  // Auto-trigger auth as soon as the 'auth' step becomes active.
  useEffect(() => {
    if (step === 'auth') {
      // Small delay so the fade-in doesn't race with the OS sheet appearing.
      const t = setTimeout(() => triggerAuth(), 450);
      return () => clearTimeout(t);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset auth state when leaving the step (back navigation).
  const resetAuthStep = useCallback(() => {
    setAuthState('idle');
    setAuthHint('');
    successScaleAnim.setValue(0);
  }, [successScaleAnim]);

  // ─── Navigation handlers ──────────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 'privacy') {
      acceptPrivacy();
      animateTransition('profile');
    } else if (step === 'profile') {
      if (!name.trim()) {
        Alert.alert('Fehler', 'Bitte geben Sie Ihren Namen ein.');
        return;
      }
      Keyboard.dismiss();
      resetAuthStep();
      animateTransition('auth');
    } else if (step === 'subjects') {
      if (selectedSubjects.length === 0) {
        Alert.alert('Fehler', 'Bitte wählen Sie mindestens ein Fach.');
        return;
      }

      // UX: render loading screen first, then start heavy async work.
      setProgressText('Einrichtung läuft...');
      setRealProgressPercent(0);
      setDisplayProgressPercent(0);
      setIsSetupComplete(false);
      processingStartedAtRef.current = Date.now();
      processingProgressAnim.setValue(0);
      setStep('processing');
      // requestAnimationFrame guarantees at least one committed frame before compute/storage starts.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      try {
        await completeOnboarding(
          { name: name.trim(), school: school.trim(), subjects: selectedSubjects },
          generatedPinRef.current,
          (msg, percent) => {
            setProgressText(msg);
            setRealProgressPercent(percent);
          }
        );
        // Even if setup is very fast, keep a minimum visible loading duration.
        const elapsed = processingStartedAtRef.current ? Date.now() - processingStartedAtRef.current : 0;
        if (elapsed < 1000) {
          await new Promise((r) => setTimeout(r, 1000 - elapsed));
        }
        setIsSetupComplete(true);
        await new Promise((r) => setTimeout(r, 500));
        router.replace('/');
      } catch (e) {
        Alert.alert('Fehler', 'Einrichtungsfehler: ' + String(e));
        setStep('subjects');
      }
    }
  };

  const handleBack = () => {
    if (step === 'profile') animateTransition('privacy');
    else if (step === 'auth') {
      resetAuthStep();
      animateTransition('profile');
    } else if (step === 'subjects') animateTransition('auth');
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const stepIndex =
    step === 'privacy' ? 0
    : step === 'profile' ? 1
    : step === 'auth' ? 2
    : step === 'subjects' ? 3
    : 4;
  const totalSteps = 4;

  // ─── Processing screen ────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <View style={[styles.root, styles.processingRoot]}>
        <SafeAreaView style={styles.processingContainer}>
          <Animated.View style={[styles.processingContent, { opacity: fadeAnim }]}>
            <View style={styles.spinnerContainer}>
              <Animated.View style={{ transform: [{ scale: processingPulseAnim }] }}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </Animated.View>
            </View>
            <Text style={styles.processingTitle}>Daten werden verschlüsselt</Text>
            <Text style={styles.processingSubtitle}>
              {displayProgressPercent >= 70 && !isSetupComplete ? 'Fast fertig...' : progressText}
            </Text>

            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: processingProgressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressPercentText}>{displayProgressPercent}%</Text>

            <View style={styles.benefitsBox}>
              <View style={styles.benefitRow}>
                <CheckCircle size={16} color={Colors.positive} />
                <Text style={styles.benefitText}>AES-256 Verschlüsselung</Text>
              </View>
              <View style={styles.benefitRow}>
                <CheckCircle size={16} color={Colors.positive} />
                <Text style={styles.benefitText}>Lokal gespeicherte Chunks</Text>
              </View>
              <View style={styles.benefitRow}>
                <CheckCircle size={16} color={Colors.positive} />
                <Text style={styles.benefitText}>Maximale Offline-Performance</Text>
              </View>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Auth Step UI (Step 3) ─────────────────────────────────────────────────
  /**
   * WHY NO NUMPADS / TEXTINPUT:
   *   - The OS sheet handles everything — no custom input needed.
   *   - This screen only shows status feedback (animating icon + hint text).
   *   - The background remains fully visible; no white flash.
   */
  const renderAuthStep = () => {
    const isAuthenticating = authState === 'authenticating';
    const isSuccess = authState === 'success';
    const canRetry = authState === 'failed' || authState === 'cancelled';

    return (
      <View style={styles.authContainer}>
        {/* Animated shield icon */}
        <Animated.View
          style={[
            styles.authIconWrap,
            isSuccess && styles.authIconWrapSuccess,
            {
              transform: [
                {
                  scale: isSuccess
                    ? successScaleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.7, 1],
                      })
                    : pulseAnim,
                },
              ],
            },
          ]}
        >
          {isSuccess ? (
            <CheckCircle size={44} color={Colors.positive} strokeWidth={1.8} />
          ) : (
            <Fingerprint
              size={44}
              color={canRetry ? Colors.negative : Colors.primary}
              strokeWidth={1.8}
            />
          )}
        </Animated.View>

        <Text style={styles.authTitle}>
          {isSuccess
            ? 'Erfolgreich bestätigt'
            : isAuthenticating
            ? 'Bitte authentifizieren…'
            : canRetry
            ? 'Authentifizierung erforderlich'
            : 'Identität bestätigen'}
        </Text>

        <Text style={styles.authSubtitle}>
          {isSuccess
            ? 'Ihre Identität wurde bestätigt. Weiterleitung…'
            : isAuthenticating
            ? 'Das System-Dialog wird geöffnet…'
            : authHint ||
              'Verwenden Sie Face ID, Fingerabdruck oder Ihren Geräte-Code, um fortzufahren.'}
        </Text>

        {/* Security info box */}
        {!isSuccess && (
          <View style={styles.authInfoBox}>
            <Shield size={14} color={Colors.primary} />
            <Text style={styles.authInfoText}>
              Kein PIN-Eintippen nötig. Ihre Daten werden mit einem sicheren, gerätespezifischen Schlüssel verschlüsselt.
            </Text>
          </View>
        )}

        {/* Retry button — only shown after failure / cancel */}
        {canRetry && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={triggerAuth}
            activeOpacity={0.8}
          >
            <RefreshCw size={18} color={Colors.white} />
            <Text style={styles.retryBtnText}>Erneut versuchen</Text>
          </TouchableOpacity>
        )}

        {/* Subtle loading indicator while OS sheet is opening */}
        {isAuthenticating && (
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={{ marginTop: 24 }}
          />
        )}
      </View>
    );
  };

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Schritt {stepIndex + 1} von {totalSteps}</Text>
        </View>

        {/*
          KeyboardAvoidingView still wraps the whole content for Steps 1–2
          (profile TextInputs). For Step 3 (auth) the keyboard never appears,
          so this wrapper is harmless but avoids layout jumps when navigating.
        */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>

            {/* Step 1: Privacy */}
            {step === 'privacy' && (
              <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
                <View style={styles.iconContainer}>
                  <Shield size={48} color={Colors.primary} strokeWidth={1.5} />
                </View>
                <Text style={styles.title}>Dienstliche Nutzung & Datenschutz</Text>
                <Text style={styles.subtitle}>
                  Diese App speichert alles nur lokal und sicher verschlüsselt auf deinem Endgerät.
                </Text>
              </ScrollView>
            )}

            {/* Step 2: Profile */}
            {step === 'profile' && (
              <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Willkommen</Text>
                <Text style={styles.label}>Name</Text>
                <AppInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ihr Name"
                />
                <Text style={styles.label}>Schule (Optional)</Text>
                <AppInput
                  style={styles.input}
                  value={school}
                  onChangeText={setSchool}
                  placeholder="Name der Schule"
                />
              </ScrollView>
            )}

            {/* Step 3: Biometric Auth — NO TextInput, NO NumPad */}
            {step === 'auth' && (
              <ScrollView
                style={styles.flex}
                contentContainerStyle={[styles.content, styles.authContent]}
                keyboardShouldPersistTaps="handled"
              >
                {renderAuthStep()}
              </ScrollView>
            )}

            {/* Step 4: Subjects */}
            {step === 'subjects' && (
              <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Ihre Fächer</Text>
                <View style={styles.subjectGrid}>
                  {ALL_SUBJECTS.map((subject) => {
                    const selected = selectedSubjects.includes(subject);
                    return (
                      <TouchableOpacity
                        key={subject}
                        style={[styles.subjectChip, selected && styles.subjectChipActive]}
                        onPress={() => toggleSubject(subject)}
                      >
                        <Text
                          style={[styles.subjectText, selected && styles.subjectTextActive]}
                        >
                          {subject}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

          </Animated.View>
        </KeyboardAvoidingView>

        {/* Footer — hidden on auth step (navigation is driven by auth result) */}
        {step !== 'auth' && (
          <View style={styles.footer}>
            {step !== 'privacy' && (
              <TouchableOpacity onPress={handleBack}>
                <Text style={styles.backText}>Zurück</Text>
              </TouchableOpacity>
            )}
            <AppButton
              label={step === 'subjects' ? 'Schritt 4 abschließen' : 'Weiter'}
              onPress={handleNext}
              style={styles.nextBtn}
            />
          </View>
        )}

        {/* Auth step back button rendered separately at the bottom */}
        {step === 'auth' && (
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleBack}>
              <Text style={styles.backText}>Zurück</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { padding: 16, alignItems: 'center' },
  stepLabel: { fontSize: 14, color: Colors.textSecondary },
  content: { padding: 24 },
  iconContainer: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: Colors.text },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: { fontSize: 16 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  subjectChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  subjectText: { color: Colors.textSecondary, fontSize: 15 },
  subjectTextActive: { color: Colors.primary, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  backText: { color: Colors.textSecondary, fontSize: 16, padding: 16 },
  nextBtn: { marginLeft: 'auto', minWidth: 190 },

  // ── Auth Step ──────────────────────────────────────────────────────────────
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 32,
  },
  authIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  authIconWrapSuccess: {
    backgroundColor: '#DCFCE7', // light green
    shadowColor: Colors.positive,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  authSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  authInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    width: '100%',
    marginBottom: 8,
  },
  authInfoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 19,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 24,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Processing Step ────────────────────────────────────────────────────────
  processingRoot: { backgroundColor: '#F8FAFC' },
  processingContainer: { flex: 1, justifyContent: 'center', padding: 32 },
  processingContent: { alignItems: 'center' },
  spinnerContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  processingTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  processingSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  progressPercentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 48,
  },
  benefitsBox: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
});
