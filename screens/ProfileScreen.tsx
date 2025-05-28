import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { toast } from 'sonner-native';
import { signOut } from '../lib/auth';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TabStackParamList, RootStackParamList } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';

type ProfileScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabStackParamList, 'ProfileScreen'>,
  NativeStackScreenProps<RootStackParamList, 'ProfileScreen'>
>;

export default function ProfileScreen({ route }: ProfileScreenProps) {
  const { email } = route.params;
  const navigation = useNavigation();

  const handleLogout = async () => {
    await signOut();
    toast.info('Logged out');
    navigation.reset && navigation.reset({
      index: 0,
      routes: [{ name: 'AuthScreen' as never }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome,</Text>
      <Text style={styles.email}>{email}</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  email: { fontSize: 18, color: '#555', marginBottom: 30 },
  button: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});