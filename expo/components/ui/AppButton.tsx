import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';

type Variant = 'primary' | 'secondary' | 'ghost';

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
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 8, tension: 280 }).start();
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
        <Text style={[styles.label, variant !== 'primary' && styles.labelAlt]}>{label}</Text>
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
    backgroundColor: Colors.white,
    ...UI.shadows.lg,
  },
  secondary: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    color: Colors.text,
    ...UI.font.bodySemibold,
  },
  labelAlt: {
    color: Colors.text,
  },
  disabled: {
    opacity: 0.45,
  },
});
