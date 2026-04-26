import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { BookOpen, Users, BarChart3, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Map route names to icons
const ICONS: Record<string, React.ElementType> = {
  '(lesson)': BookOpen,
  'classes': Users,
  'statistics': BarChart3,
  'settings': Settings,
};

function TabBarButton({
  route,
  isFocused,
  options,
  onPress,
  onLongPress,
}: {
  route: any;
  isFocused: boolean;
  options: any;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  // Scale animation on press
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const IconComponent = ICONS[route.name] || BookOpen;
  
  // Use original app accent color for active state
  const color = isFocused ? Colors.primary : Colors.textSecondary;
  const label = options.title !== undefined ? options.title : route.name;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      testID={options.tabBarTestID}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.8}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale: scaleAnim }] }]}>
        <IconComponent 
          size={24} 
          color={color} 
          strokeWidth={isFocused ? 2 : 1.7} 
          style={{ opacity: isFocused ? 1 : 0.8 }}
        />
        <Text style={[styles.tabLabel, { color, opacity: isFocused ? 1 : 0.8 }]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  
  // Sit very low, slightly overlapping the safe area if necessary for a native floating look
  const bottomDistance = 24;

  return (
    <View style={[styles.container, { bottom: bottomDistance }]}>
      <BlurView 
        intensity={Platform.OS === 'ios' ? 40 : 80} 
        tint="light" 
        style={styles.blurContainer}
      >
        <View style={styles.tabBar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabBarButton
                key={route.key}
                route={route}
                isFocused={isFocused}
                options={options}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    // borderRadius applies to the outer view to clip the blur on Android
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  blurContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Platform.select({
      ios: 'rgba(255, 255, 255, 0.4)',
      android: 'rgba(255, 255, 255, 0.95)', // Android blur might not be reliable, give it a solid fallback
    }),
    borderWidth: Platform.select({ ios: 0.5, android: 0 }),
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});
