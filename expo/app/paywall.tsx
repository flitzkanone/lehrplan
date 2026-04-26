/**
 * paywall.tsx
 *
 * SECURITY RULES:
 *   - No back button / swipe-to-dismiss (presentation: fullScreenModal + gestureEnabled: false in layout)
 *   - "App ansehen" (preview bypass) is permanently removed
 *   - All subscription mutations go through AppContext so the Guard reacts instantly
 *   - On successful trial/purchase → router.replace('/(tabs)/unterricht') and Guard lets through
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Lock, ShieldCheck, KeyRound, X, Download, Sparkles } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { UI } from '@/constants/ui';
import Colors from '@/constants/colors';
import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';
import ExportModal from '@/components/modals/ExportModal';
import { BlurView } from 'expo-blur';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

// Matches the key in AppContext
const SUB_DATA_KEY = 'teacher_app_subscription_data';

export default function PaywallScreen() {
  const router = useRouter();
  const { startTrial, setSubscribedState, isSubscribed } = useApp();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isPromoModalVisible, setIsPromoModalVisible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoAttempts, setPromoAttempts] = useState(0);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);

  // If the guard has already set isSubscribed = true (e.g. on re-render after trial),
  // navigate into the app. This is the reactive exit from the paywall.
  React.useEffect(() => {
    if (isSubscribed === true) {
      // (lesson) is the Unterricht tab — first tab in the navigator
      router.replace('/(tabs)/(lesson)' as any);
    }
  }, [isSubscribed, router]);

  // ─── Trial (Mock) ──────────────────────────────────────────────────────────
  const handleStartTrial = async () => {
    try {
      setIsProcessing(true);
      // Simulate brief processing so UI feels real
      await new Promise((r) => setTimeout(r, 900));
      await startTrial();
      // Navigation is handled by the useEffect above reacting to isSubscribed
    } catch (e) {
      Alert.alert('Fehler', 'Trial konnte nicht gestartet werden. Bitte erneut versuchen.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Purchase (Mock / Expo Go) ─────────────────────────────────────────────
  const handlePurchase = async () => {
    try {
      setIsProcessing(true);
      // Simulate native payment sheet
      await new Promise((r) => setTimeout(r, 2000));
      const expiresAt = Date.now() + 31 * 24 * 60 * 60 * 1000;
      await setSubscribedState(expiresAt, 'MOCK_RECEIPT_EXPO_GO');
      Alert.alert('Erfolg', 'Mock-Kauf erfolgreich!');
    } catch (e) {
      Alert.alert('Kauf abgebrochen', 'Der Kauf konnte nicht abgeschlossen werden.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Restore (Mock) ────────────────────────────────────────────────────────
  const handleRestore = async () => {
    try {
      setIsProcessing(true);
      await new Promise((r) => setTimeout(r, 1500));
      Alert.alert('Hinweis', 'In Expo Go gibt es keine nativen Käufe zum Wiederherstellen.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Promo Code ────────────────────────────────────────────────────────────
  const handleRedeemCode = async () => {
    if (!promoCode.trim()) return;
    if (promoAttempts >= 5) {
      Alert.alert('Zu viele Versuche', 'Bitte warte einen Moment.');
      return;
    }

    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 800));

    try {
      const cleanCode = promoCode.trim().toUpperCase();
      const parts = cleanCode.split('-');
      if (parts.length !== 3 || parts[0] !== 'RORK') {
        setPromoAttempts((p) => p + 1);
        Alert.alert('Ungültiger Code', 'Dieser Code ist leider nicht gültig.');
        return;
      }

      const duration = parts[1];
      const signature = parts[2];
      const secret = ['RORK', '_OFFLINE', '_SEC', '_99X'].join('');
      const expectedSig = CryptoJS.SHA256(secret + duration)
        .toString(CryptoJS.enc.Hex)
        .substring(0, 6)
        .toUpperCase();

      if (signature !== expectedSig) {
        setPromoAttempts((p) => p + 1);
        Alert.alert('Ungültiger Code', 'Dieser Code ist leider nicht gültig.');
        return;
      }

      let daysToAdd = 0;
      if (duration === '7D') daysToAdd = 7;
      else if (duration === '30D') daysToAdd = 30;
      else if (duration === 'LIFE') daysToAdd = 365 * 100;
      else {
        setPromoAttempts((p) => p + 1);
        Alert.alert('Ungültiger Code', 'Unbekannte Laufzeit.');
        return;
      }

      const expiresAt = Date.now() + daysToAdd * 24 * 60 * 60 * 1000;
      await setSubscribedState(expiresAt, 'PROMO_CODE_' + duration);
      setPromoCode('');
      setIsPromoModalVisible(false);
      Alert.alert('Aktiviert', 'Dein Code wurde erfolgreich eingelöst!');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Lock size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Rork Lehrer App</Text>
          <Text style={styles.subtitle}>Schalte alle Premium-Funktionen frei</Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          {[
            'Unbegrenzte Klassen & Schüler',
            'Sichere Offline-Datenspeicherung',
            'Schnelle Noten & Hausaufgaben',
            '100% DSGVO-konform (alles lokal)',
          ].map((benefit, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <View style={styles.checkCircle}>
                <Check size={16} color={Colors.white} strokeWidth={3} />
              </View>
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {/* Pricing Card */}
        <View style={styles.pricingCard}>
          <Text style={styles.pricingTitle}>30 Tage kostenlos testen</Text>
          <Text style={styles.price}>
            2,99 €
            <Text style={styles.pricePeriod}> / Monat</Text>
          </Text>
          <Text style={styles.pricingDesc}>
            Danach zahlungspflichtig. Jederzeit im Store kündbar.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {/* PRIMARY: Trial */}
          <AppButton
            label={isProcessing ? 'Bitte warten…' : '30 Tage kostenlos testen'}
            onPress={handleStartTrial}
            disabled={isProcessing}
            style={styles.mainButton}
            leftIcon={
              isProcessing
                ? <ActivityIndicator color={Colors.text} />
                : <Sparkles size={18} color={Colors.text} />
            }
          />

          {/* SECONDARY: Purchase without trial */}
          <TouchableOpacity
            style={[styles.secondaryButton, isProcessing && styles.secondaryButtonDisabled]}
            onPress={handlePurchase}
            disabled={isProcessing}
          >
            <Text style={styles.secondaryButtonText}>Direkt kaufen (2,99 €/Monat)</Text>
          </TouchableOpacity>

          {/* Restore */}
          <TouchableOpacity
            style={[styles.secondaryButton, isProcessing && styles.secondaryButtonDisabled]}
            onPress={handleRestore}
            disabled={isProcessing}
          >
            <Text style={styles.secondaryButtonText}>Käufe wiederherstellen</Text>
          </TouchableOpacity>

          {/* Export data (data export before subscribing) */}
          <TouchableOpacity
            style={[styles.secondaryButton, isProcessing && styles.secondaryButtonDisabled]}
            onPress={() => setIsExportModalVisible(true)}
            disabled={isProcessing}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Download size={16} color={Colors.textSecondary} />
              <Text style={styles.secondaryButtonText}>Daten exportieren</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Legal & Promo */}
        <View style={styles.footer}>
          <View style={styles.legalLinks}>
            <TouchableOpacity><Text style={styles.legalText}>Nutzungsbedingungen (EULA)</Text></TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity><Text style={styles.legalText}>Datenschutz</Text></TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.promoLink}
            onPress={() => setIsPromoModalVisible(true)}
          >
            <KeyRound size={14} color={Colors.textLight} style={{ marginRight: 6 }} />
            <Text style={styles.promoText}>Aktivierungscode einlösen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Promo Code Modal */}
      <Modal visible={isPromoModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsPromoModalVisible(false)}
            >
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <ShieldCheck size={32} color={Colors.primary} />
              <Text style={styles.modalTitle}>Code einlösen</Text>
              <Text style={styles.modalSubtitle}>
                Gib deinen Aktivierungs- oder Promo-Code ein, um die App freizuschalten.
              </Text>
            </View>

            <AppInput
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Z.B. RORK-30D-A1B2C3"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ marginBottom: UI.spacing.lg }}
            />

            <AppButton
              label={isProcessing ? 'Prüfe…' : 'Aktivieren'}
              onPress={handleRedeemCode}
              disabled={isProcessing || promoCode.length < 3}
              leftIcon={isProcessing ? <ActivityIndicator color={Colors.text} /> : undefined}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ExportModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: UI.spacing.lg,
    paddingTop: UI.spacing.xl * 2,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: UI.spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: UI.spacing.md,
    ...UI.shadows.md,
  },
  title: {
    ...UI.font.title,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    ...UI.font.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  benefitsContainer: {
    backgroundColor: Colors.white,
    borderRadius: UI.radius.xl,
    padding: UI.spacing.lg,
    ...UI.shadows.sm,
    marginBottom: UI.spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitText: {
    ...UI.font.bodySemibold,
    color: Colors.text,
    flex: 1,
  },
  pricingCard: {
    alignItems: 'center',
    marginBottom: UI.spacing.xl,
  },
  pricingTitle: {
    ...UI.font.smallSemibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  price: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  pricePeriod: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pricingDesc: {
    ...UI.font.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: UI.spacing.sm,
    marginBottom: UI.spacing.xl,
    alignItems: 'center',
  },
  mainButton: {
    width: '100%',
    marginBottom: UI.spacing.xs,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.4,
  },
  secondaryButtonText: {
    ...UI.font.bodySemibold,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: UI.spacing.lg,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  legalText: {
    ...UI.font.caption,
    color: Colors.textLight,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: Colors.textLight,
  },
  promoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  promoText: {
    ...UI.font.caption,
    fontWeight: '600',
    color: Colors.textLight,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: UI.spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: UI.radius.xl,
    padding: UI.spacing.xl,
    ...UI.shadows.lg,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: UI.spacing.xl,
    marginTop: 8,
  },
  modalTitle: {
    ...UI.font.title,
    color: Colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  modalSubtitle: {
    ...UI.font.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
