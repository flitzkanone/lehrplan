import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import ErrorBoundary from "@/components/ErrorBoundary";
import FeatureTour from "@/components/FeatureTour";
import { AppProvider, useApp } from "@/context/AppContext";
import { TutorialProvider } from "@/context/TutorialContext";
import { useAutoLock } from "@/hooks/useAutoLock";
import { usePurchases } from "@/hooks/usePurchases";
import {
  logAppBoot,
  logModuleStarting,
  logModuleReady,
  logStartupSummary,
} from "@/utils/startupLogger";

import {
  addNotificationResponseListener,
  setupNotificationCategories,
} from "@/utils/lessonNotification";

SplashScreen.preventAutoHideAsync();

logAppBoot();


function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { data, isAuthenticated, isLoading, storedPinHash, isPreviewMode } = useApp();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const navigatorLogged = useRef(false);
  const { registerInteraction } = useAutoLock();
  const { hasActiveSubscription } = usePurchases();

  const onboardingDone = data.onboardingComplete || !!storedPinHash;

  useEffect(() => {
    if (isLoading || hasActiveSubscription === null) return;
    const isOnboarding = (segments as string[])[0] === 'onboarding';
    const isLock = segments[0] === 'lock';
    const isPaywall = segments[0] === 'paywall';
    const isProtected = !isOnboarding && !isLock && !isPaywall;
    
    if (!onboardingDone && isProtected) {
      console.log('[AuthGuard] Redirecting to onboarding');
      router.replace('/onboarding' as any);
    } else if (onboardingDone && !isAuthenticated && isProtected) {
      console.log('[AuthGuard] Redirecting to lock');
      router.replace('/lock' as any);
    } else if (onboardingDone && isAuthenticated && hasActiveSubscription === false && !isPreviewMode && isProtected) {
      console.log('[AuthGuard] Redirecting to paywall');
      router.replace('/paywall' as any);
    }
  }, [isLoading, onboardingDone, isAuthenticated, hasActiveSubscription, isPreviewMode, segments, router]);

  useEffect(() => {
    if (!navigatorLogged.current) {
      navigatorLogged.current = true;
      logModuleStarting("Navigator");
      logModuleReady("Navigator");
      logStartupSummary();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      logModuleStarting("NotificationSystem");
      logModuleReady("NotificationSystem");
      return;
    }

    logModuleStarting("NotificationSystem");
    try {
      setupNotificationCategories();
      logModuleReady("NotificationSystem");
    } catch (e) {
      console.log('[RootLayout] NotificationSystem setup error:', e);
      logModuleReady("NotificationSystem");
    }

    notificationListener.current = addNotificationResponseListener((response) => {
      console.log('[RootLayout] Notification response received:', response.actionIdentifier);
      // Security: never allow deep navigation into protected routes while locked.
      if (!isAuthenticated) {
        router.replace('/lock' as any);
        return;
      }
      const data = response.notification.request.content.data;
      if (data?.type === 'lesson-active') {
        const actionId = response.actionIdentifier;
        if (actionId === 'resume' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          console.log('[RootLayout] Navigating to lesson-active');
          router.push('/lesson-active' as any);
        } else if (actionId === 'end') {
          console.log('[RootLayout] End lesson action - navigating to lesson to end');
          router.push('/lesson-active' as any);
        }
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, [isAuthenticated, router]);

  return (
    <View
      style={{ flex: 1 }}
      // Capture top-level interactions to keep the inactivity timer accurate.
      onStartShouldSetResponderCapture={() => {
        registerInteraction();
        return false;
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="lock" options={{ presentation: "transparentModal", animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="paywall" options={{ presentation: "modal", gestureEnabled: false }} />
        <Stack.Screen name="lesson-active" options={{ presentation: "modal", gestureEnabled: false }} />
      </Stack>
    </View>
  );
}

logModuleStarting("GestureHandler");

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView
      style={{ flex: 1 }}
      onLayout={() => logModuleReady("GestureHandler")}
    >
      <ErrorBoundary>
        <AppProvider>
          <TutorialProvider>
            <StatusBar style="dark" />
            <RootLayoutNav />
            <FeatureTour />
          </TutorialProvider>
        </AppProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
