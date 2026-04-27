import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
}

export default function AppButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
  leftIcon,
}: AppButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 280 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 280 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.base, styles[variant], disabled && styles.disabled]}
      >
        {leftIcon}
        <Text style={[
          styles.label,
          variant === 'secondary' && styles.labelSecondary,
          variant === 'ghost' && styles.labelGhost,
          variant === 'danger' && styles.labelDanger,
        ]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: UI.button.height,
    borderRadius: UI.button.radius,
    paddingHorizontal: UI.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: UI.spacing.sm,
  },
  primary: {
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  secondary: {
    backgroundColor: Colors.inputBg,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.negative,
    ...Platform.select({
      ios: {
        shadowColor: Colors.negative,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  label: {
    color: Colors.white,
    ...UI.font.bodySemibold,
  },
  labelSecondary: {
    color: Colors.text,
  },
  labelGhost: {
    color: Colors.text,
  },
  labelDanger: {
    color: Colors.white,
  },
  disabled: {
    opacity: 0.4,
  },
});
