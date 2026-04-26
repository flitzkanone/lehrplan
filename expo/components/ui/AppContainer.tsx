import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';

interface AppContainerProps extends ViewProps {
  useSafeArea?: boolean;
  withPadding?: boolean;
}

export default function AppContainer({
  children,
  style,
  useSafeArea = true,
  withPadding = true,
  ...props
}: AppContainerProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <View
      {...props}
      style={[
        styles.container,
        useSafeArea && {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        withPadding && { paddingHorizontal: UI.spacing.screenMargin },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
