import { Platform } from 'react-native';
import Colors from './colors';

// --------------------------------------------------------
// GLOBAL DESIGN SYSTEM TOKENS
// --------------------------------------------------------
// This file acts as the single source of truth for the entire app's UI.
// No hardcoded padding, margins, border radii or typography sizes
// should exist outside of this file.

export const UI = {
  // Border Radius
  radius: {
    xs: 8,
    sm: 12,
    md: 16,     // Default container / button radius
    lg: 20,     // Cards & Modals
    xl: 24,     // Large Modals / Bottom Sheets
    pill: 100,  // Fully rounded buttons / badges
  },

  // Spacing & Layout
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,     // Default gap
    lg: 24,
    xl: 32,
    screenMargin: 20, // Default paddingHorizontal for screens
  },

  // Font Typography
  font: {
    largeTitle: {
      fontSize: 34,
      fontWeight: '700' as const,
      letterSpacing: -0.8,
    },
    title: {
      fontSize: 24,
      fontWeight: '700' as const,
      letterSpacing: -0.6,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      letterSpacing: -0.4,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      letterSpacing: -0.2,
    },
    bodySemibold: {
      fontSize: 16,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
    },
    small: {
      fontSize: 14,
      fontWeight: '400' as const,
    },
    smallSemibold: {
      fontSize: 14,
      fontWeight: '600' as const,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
    },
  },

  // Component Defaults
  button: {
    height: 52,
    radius: 24, // Consistently soft iOS rectangle
  },
  
  card: {
    radius: 24,
    padding: 20,
  },

  shadows: {
    none: {
      shadowColor: 'transparent',
      elevation: 0,
    },
    sm: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
    md: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
      default: {},
    }),
    lg: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.20,
        shadowRadius: 28,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
};

export default UI;
