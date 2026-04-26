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
import { Check, Lock, ShieldCheck, KeyRound, X, Download, Eye } from 'lucide-react-native';
import { usePurchases } from '@/hooks/usePurchases';
import { useApp } from '@/context/AppContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { UI } from '@/constants/ui';
import Colors from '@/constants/colors';
import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';
import ExportModal from '@/components/modals/ExportModal';
import { BlurView } from 'expo-blur';

export default function PaywallScreen() {
  const router = useRouter();
  const {
    subscriptions,
    purchaseSubscription,
    restorePurchases,
    redeemPromoCode,
    isProcessing: isPurchasing,
    hasActiveSubscription,
  } = usePurchases();

  const { data, setIsPreviewMode } = useApp();
  const [isPromoModalVisible, setIsPromoModalVisible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoAttempts, setPromoAttempts] = useState(0);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  
  const isProcessing = isPurchasing;

  // If the user successfully subscribed, navigate back to tabs
  React.useEffect(() => {
    if (hasActiveSubscription) {
      router.replace('/(tabs)' as any);
    }
  }, [hasActiveSubscription, router]);

  const handlePurchase = async () => {
    // Pick the first available subscription (e.g. monthly)
    const sub = subscriptions[0];
    if (sub) {
      await purchaseSubscription(sub.productId);
    } else {
      // Fallback if products haven't loaded yet
      await purchaseSubscription('com.rork.teacher.monthly');
    }
  };

  const handleRedeemCode = async () => {
    if (!promoCode.trim()) return;

    if (promoAttempts >= 5) {
      Alert.alert('Zu viele Versuche', 'Bitte warte einen Moment, bevor du es erneut versuchst.');
      return;
    }

    const success = await redeemPromoCode(promoCode);
    if (success) {
      setPromoCode('');
      setIsPromoModalVisible(false);
      // hasActiveSubscription becomes true, triggering the useEffect redirect
      Alert.alert('Aktiviert', 'Dein Code wurde erfolgreich eingelöst!');
    } else {
      setPromoAttempts(prev => prev + 1);
      Alert.alert('Ungültiger Code', 'Dieser Code ist leider nicht gültig.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Icon */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Lock size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Rork Lehrer App</Text>
          <Text style={styles.subtitle}>Schalte alle Premium-Funktionen frei</Text>
        </View>

        {/* Benefits List */}
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
          <Text style={styles.pricingTitle}>1 Monat kostenlos testen</Text>
          <Text style={styles.price}>
            {subscriptions.length > 0 && subscriptions[0].localizedPrice 
              ? subscriptions[0].localizedPrice 
              : '2,99 €'}
            <Text style={styles.pricePeriod}> / Monat</Text>
          </Text>
          <Text style={styles.pricingDesc}>
            Danach zahlungspflichtig. Jederzeit im Store kündbar.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <AppButton
            label={isProcessing ? "Verarbeite..." : "Kostenlos testen"}
            onPress={handlePurchase}
            disabled={isProcessing}
            style={styles.mainButton}
            leftIcon={isProcessing ? <ActivityIndicator color={Colors.text} /> : undefined}
          />

          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={restorePurchases}
              disabled={isProcessing}
            >
              <Text style={styles.secondaryButtonText}>Käufe wiederherstellen</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => setIsExportModalVisible(true)}
              disabled={isProcessing}
            >
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <Download size={16} color={Colors.textSecondary} />
                <Text style={styles.secondaryButtonText}>Daten exportieren</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => {
                setIsPreviewMode(true);
                router.replace('/(tabs)' as any);
              }}
              disabled={isProcessing}
            >
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <Eye size={16} color={Colors.textSecondary} />
                <Text style={styles.secondaryButtonText}>App ansehen</Text>
              </View>
            </TouchableOpacity>
          </View>
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
      <Modal
        visible={isPromoModalVisible}
        transparent
        animationType="fade"
      >
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
              label={isProcessing ? "Prüfe..." : "Aktivieren"}
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
  },
  actions: {
    gap: UI.spacing.md,
    marginBottom: UI.spacing.xl,
  },
  mainButton: {
    width: '100%',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: UI.spacing.sm,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...UI.font.bodySemibold,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    gap: 16,
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
  
  // Modal Styles
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
