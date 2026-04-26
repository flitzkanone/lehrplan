import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';

export default function AppInput(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      placeholderTextColor={Colors.textLight}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.input, focused && styles.focused, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: UI.button.radius, // Match button radius
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: UI.spacing.md,
    height: UI.button.height,       // Match button height
    color: Colors.text,
    ...UI.font.body,
  },
  focused: {
    borderColor: Colors.primary,
    ...UI.shadows.sm,
  },
});
