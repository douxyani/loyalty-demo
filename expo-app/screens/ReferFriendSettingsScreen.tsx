import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { theme } from '../styles/theme';

export default function ReferFriendSettingsScreen({ navigation }: { navigation: any }) {
  const [reward, setReward] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchReward = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('referral_settings')
        .select('purchase_increment_value')
        .single();
      setReward(data?.purchase_increment_value?.toString() ?? '1');
      setLoading(false);
    };
    fetchReward();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const value = parseInt(reward, 10);
    if (isNaN(value) || value < 1 || value > 10) {
      Alert.alert('Invalid value', 'Reward must be between 1 and 10.');
      setSaving(false);
      return;
    }
    const { error } = await supabaseAdmin
      .from('referral_settings')
      .update({ purchase_increment_value: value })
      .eq('id', 'default_config');
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Failed to update setting');
    } else {
      // Automatically go back after saving
      navigation.goBack && navigation.goBack();
    }
  };

  const handleCancel = () => {
    navigation.goBack && navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Refer-a-Friend Reward</Text>
        <Text style={styles.description}>
          Set how many purchases are credited to a referrer when their friend makes their first purchase.
        </Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={reward}
              onChangeText={setReward}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View style={styles.buttonColumn}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.primary, marginBottom: 12 },
  description: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 18 },
  input: {
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    color: '#222',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6eaf3',
    width: 80,
    textAlign: 'center',
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
    marginBottom: 0,
    width: 140,
    alignSelf: 'center',
  },
  cancelButton: {
    backgroundColor: '#e6eaf3',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 0,
  },
  cancelButtonText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 0,
  },
  saveButtonDisabled: {
    backgroundColor: '#b3c2e6',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
