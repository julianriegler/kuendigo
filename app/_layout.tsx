import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { loadApiKey, loadDeviceToken } from '../utils/storage';

export default function RootLayout() {
  // Eigener Key und anonymer Geräte-Token einmalig vorladen, damit die
  // Screens synchron darauf zugreifen können.
  useEffect(() => {
    loadApiKey();
    loadDeviceToken();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
