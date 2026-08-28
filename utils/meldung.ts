/**
 * Alert.alert ist in react-native-web ein No-Op, deshalb die Weiche:
 * auf Web window.alert, sonst die native Alert-API.
 */
import { Platform, Alert } from 'react-native';

export function meldung(titel: string, text: string): void {
  if (Platform.OS === 'web') window.alert(`${titel}\n\n${text}`);
  else Alert.alert(titel, text);
}
