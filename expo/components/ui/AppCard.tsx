import React from 'react';
import { StyleSheet, View, ViewProps, Platform } from 'react-native';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';

export default function AppCard({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: UI.card.radius,
    padding: UI.card.padding,
    ...UI.shadows.sm,
  },
});
