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
    // Anonymer Nutzungszähler (dritte Stufe der Messkette): ein Aufruf je
    // App-Start, keine IP, kein Cookie, keine Kennung. Nicht im Entwicklungs-
    // modus, sonst zählt jeder Reload als Nutzung.
    if (!__DEV__) {
      fetch('https://klickmill.app/api/ping?app=kuendigo').catch(() => {});
    }
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
