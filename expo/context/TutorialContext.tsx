import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useRef } from 'react';
import { logModuleStarting, logModuleReady } from '@/utils/startupLogger';

const TUTORIAL_COMPLETED_KEY = 'teacher_app_tutorial_completed';

export const [TutorialProvider, useTutorial] = createContextHook(() => {
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const tutorialProviderLogged = useRef(false);

  useEffect(() => {
    if (!tutorialProviderLogged.current) {
      tutorialProviderLogged.current = true;
      logModuleStarting('TutorialProvider');
    }
  }, []);

  useEffect(() => {
    const fetchTutorialState = async () => {
      try {
        const val = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
        setTutorialCompleted(val === 'true');
      } catch (e) {
        console.error('Failed to load tutorial state:', e);
      } finally {
        setIsLoading(false);
        logModuleReady('TutorialProvider');
      }
    };
    fetchTutorialState();
  }, []);

  const markCompleted = async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setTutorialCompleted(true);
    } catch (e) {
      console.error('Failed to set tutorial status', e);
    }
  };

  const resetCompleted = async () => {
    try {
      await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
      setTutorialCompleted(false);
    } catch (e) {
      console.error('Failed to reset tutorial', e);
    }
  };

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setShowTutorial(true);
  }, []);

  const nextStep = useCallback((totalSteps: number) => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setShowTutorial(false);
      setCurrentStep(0);
      markCompleted();
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    setShowTutorial(false);
    setCurrentStep(0);
    markCompleted();
  }, []);

  const replayTutorial = useCallback(() => {
    resetCompleted();
    setCurrentStep(0);
    setShowTutorial(true);
  }, []);

  const triggerFirstTimeTutorial = useCallback(() => {
    if (tutorialCompleted === false) {
      startTutorial();
    }
  }, [tutorialCompleted, startTutorial]);

  return {
    showTutorial,
    currentStep,
    tutorialCompleted,
    isLoading,
    startTutorial,
    nextStep,
    skipTutorial,
    replayTutorial,
    triggerFirstTimeTutorial,
  };
});
