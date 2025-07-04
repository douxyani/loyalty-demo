import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { toast } from 'sonner-native';
import { signOut } from '../lib/auth';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TabStackParamList, RootStackParamList } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

type ProfileScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabStackParamList, 'ProfileScreen'>,
  NativeStackScreenProps<RootStackParamList, 'ProfileScreen'>
>;

export default function ProfileScreen({ route }: ProfileScreenProps) {
  const { email } = route.params;
  const navigation = useNavigation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState(true);

  // Fetch user name from users table (full_name)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setNameLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('email', email)
        .single();
      if (isMounted) {
        setName(data?.name ?? null);
        setNameLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [email]);

  const handleLogout = async () => {
    await signOut();
    toast.info('Logged out');
    navigation.reset && navigation.reset({
      index: 0,
      routes: [{ name: 'AuthScreen' as never }],
    });
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    // Re-authenticate user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setDeleteLoading(false);
      Alert.alert('Incorrect Password', 'The password you entered is incorrect.');
      return;
    }
    // Delete user from auth
    const { error: deleteError } = await supabase.rpc('delete_user_self');
    setDeleteLoading(false);
    if (deleteError) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } else {
      toast.success('Account deleted');
      navigation.reset && navigation.reset({
        index: 0,
        routes: [{ name: 'AuthScreen' as never }],
      });
    }
  };

  return (
    <View style={styles.container}>
      {nameLoading ? (
        <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 10 }} />
      ) : (
        name && <Text style={styles.name}>{name}</Text>
      )}
      <Text style={styles.email}>{email}</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.deleteButton]}
        onPress={() => setShowDeleteModal(true)}
      >
        <Text style={styles.buttonText}>Delete Account</Text>
      </TouchableOpacity>
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setPassword('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalDesc}>
              Please enter your password to confirm account deletion. This action cannot be undone.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, styles.modalActionButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setPassword('');
                }}
                disabled={deleteLoading}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton, styles.modalActionButton]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading || !password}
              >
                {deleteLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  name: { fontSize: 20, color: '#222', marginBottom: 6, fontWeight: '600' },
  email: { fontSize: 18, color: '#555', marginBottom: 30 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, marginBottom: 14, minWidth: 180, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: { backgroundColor: '#FF3B30' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    width: '85%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 15,
    color: '#444',
    marginBottom: 18,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e6eaf3',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 18,
    backgroundColor: '#f7f8fa',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  modalActionButton: {
    flex: 1,
    minWidth: 0,
  },
  cancelButton: {
    backgroundColor: '#bbb',
  },
});