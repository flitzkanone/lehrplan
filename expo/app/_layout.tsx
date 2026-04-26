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
  const { data, isAuthenticated, isLoading, storedPinHash, isSubscribed } = useApp();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const navigatorLogged = useRef(false);
  const { registerInteraction } = useAutoLock();

  const onboardingDone = data.onboardingComplete || !!storedPinHash;

  useEffect(() => {
    // Wait until both app data AND subscription status have been resolved.
    // isSubscribed === null means the check hasn't finished yet — show nothing.
    if (isLoading || isSubscribed === null) return;

    const seg = segments as string[];
    const isOnboarding = seg[0] === 'onboarding';
    const isLock      = seg[0] === 'lock';
    const isPaywall   = seg[0] === 'paywall';
    const isProtected = !isOnboarding && !isLock && !isPaywall;

    // ── Step 1: Onboarding gate ───────────────────────────────────────────────
    if (!onboardingDone && isProtected) {
      console.log('[Guard] → onboarding');
      router.replace('/onboarding' as any);
      return;
    }

    // ── Step 2: PIN lock gate ─────────────────────────────────────────────────
    if (onboardingDone && !isAuthenticated && isProtected) {
      console.log('[Guard] → lock');
      router.replace('/lock' as any);
      return;
    }

    // ── Step 3: Subscription gate (HARD — no preview bypass) ─────────────────
    // Fired for every segment change: deep links, notifications, back-nav — all blocked.
    if (onboardingDone && isAuthenticated && !isSubscribed && isProtected) {
      console.log('[Guard] → paywall (no active subscription)');
      router.replace('/paywall' as any);
      return;
    }
  }, [isLoading, isSubscribed, onboardingDone, isAuthenticated, segments, router]);

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
      // Security: block all deep navigation if locked or unsubscribed.
      if (!isAuthenticated) {
        router.replace('/lock' as any);
        return;
      }
      if (!isSubscribed) {
        router.replace('/paywall' as any);
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
  }, [isAuthenticated, isSubscribed, router]);

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
        {/* fullScreenModal prevents swipe-to-dismiss bypassing the paywall */}
        <Stack.Screen name="paywall" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
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
