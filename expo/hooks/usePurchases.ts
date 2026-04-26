import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

// MOCKED for Expo Go testing.
// In a real build, we would import 'react-native-iap' here.
const ITEM_SKUS = Platform.select({
  ios: ['com.rork.teacher.monthly'],
  android: ['com.rork.teacher.monthly'],
  default: ['com.rork.teacher.monthly'],
});

const SUB_DATA_KEY = 'teacher_app_subscription_data';

export interface SubscriptionData {
  status: 'active' | 'expired';
  expiresAt: number;
  lastKnownTime: number;
  lastOnlineVerification: number;
  storeReceipt: string | null;
}

export function usePurchases() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);

  // Initial Check from SecureStore
  const checkLocalSubscription = useCallback(async () => {
    try {
      const now = Date.now();
      const dataStr = await SecureStore.getItemAsync(SUB_DATA_KEY);
      
      if (dataStr) {
        const data: SubscriptionData = JSON.parse(dataStr);
        if (now < data.lastKnownTime) {
          console.warn('[IAP] Time manipulation detected! Current time is before last known time.');
        }
        if (data.status === 'active' && now < data.expiresAt) {
          setHasActiveSubscription(true);
          return; // Valid subscription
        }
      }

      // No active sub
      setHasActiveSubscription(false);
    } catch (e) {
      console.error('[IAP] Local check failed', e);
      setHasActiveSubscription(false);
    }
  }, []);

  useEffect(() => {
    checkLocalSubscription();
  }, [checkLocalSubscription]);

  // Setup IAP Connection (MOCKED)
  useEffect(() => {
    const setupIAP = async () => {
      try {
        // Mocking fetching products
        setTimeout(() => {
          setSubscriptions([
            {
              productId: 'com.rork.teacher.monthly',
              title: 'Rork Premium',
              description: 'Monatsabo für Rork',
              localizedPrice: '2,99 €',
              currency: 'EUR',
              price: '2.99',
            } as any,
          ]);
        }, 1000);
      } catch (err) {
        console.warn('[IAP] Init error', err);
      }
    };

    setupIAP();
  }, []);

  const purchaseSubscription = async (sku: string) => {
    try {
      setIsProcessing(true);
      // Simulate native payment sheet delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const expiresAt = Date.now() + 31 * 24 * 60 * 60 * 1000; 
      const subData: SubscriptionData = {
        status: 'active',
        expiresAt,
        lastKnownTime: Date.now(),
        lastOnlineVerification: Date.now(),
        storeReceipt: 'MOCK_RECEIPT_EXPO_GO',
      };

      await SecureStore.setItemAsync(SUB_DATA_KEY, JSON.stringify(subData));
      setHasActiveSubscription(true);
      Alert.alert('Erfolg', 'Mock-Kauf in Expo Go war erfolgreich!');
    } catch (err: any) {
      Alert.alert('Kauf abgebrochen', 'Der Kauf konnte nicht abgeschlossen werden.');
    } finally {
      setIsProcessing(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      Alert.alert('Hinweis', 'In Expo Go gibt es keine nativen Käufe zum Wiederherstellen.');
    } catch (err) {
      console.error('[IAP] Restore failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const redeemPromoCode = async (code: string): Promise<boolean> => {
    setIsProcessing(true);
    
    // Slight artificial delay to prevent brute-forcing
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const cleanCode = code.trim().toUpperCase();
      const parts = cleanCode.split('-');
      
      // Expected format: RORK-[DURATION]-[SIGNATURE]
      if (parts.length !== 3 || parts[0] !== 'RORK') {
        setIsProcessing(false);
        return false;
      }

      const duration = parts[1];
      const signature = parts[2];

      // Obfuscated secret construction
      const secret = ['RORK', '_OFFLINE', '_SEC', '_99X'].join('');
      
      // Calculate expected signature
      const expectedSignature = CryptoJS.SHA256(secret + duration)
        .toString(CryptoJS.enc.Hex)
        .substring(0, 6)
        .toUpperCase();

      if (signature !== expectedSignature) {
        setIsProcessing(false);
        return false;
      }

      let daysToAdd = 0;
      if (duration === '7D') daysToAdd = 7;
      else if (duration === '30D') daysToAdd = 30;
      else if (duration === 'LIFE') daysToAdd = 365 * 100;
      else {
        setIsProcessing(false);
        return false;
      }

      const expiresAt = Date.now() + daysToAdd * 24 * 60 * 60 * 1000;
      const subData: SubscriptionData = {
        status: 'active',
        expiresAt,
        lastKnownTime: Date.now(),
        lastOnlineVerification: Date.now(),
        storeReceipt: 'PROMO_CODE_' + duration,
      };
      
      await SecureStore.setItemAsync(SUB_DATA_KEY, JSON.stringify(subData));
      setHasActiveSubscription(true);
      return true;
    } catch (e) {
      console.error('[IAP] Promo code error', e);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    subscriptions,
    purchaseSubscription,
    restorePurchases,
    redeemPromoCode,
    isProcessing,
    hasActiveSubscription,
  };
}
