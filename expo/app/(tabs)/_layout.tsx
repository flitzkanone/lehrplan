import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/components/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(lesson)"
        options={{
          title: 'Unterricht',
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Klassen',
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistik',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
        }}
      />
    </Tabs>
  );
}
