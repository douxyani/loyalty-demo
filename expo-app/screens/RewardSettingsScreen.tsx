import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { theme } from '../styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

type Reward = {
  id: string;
  title: string;
  description: string;
  usual_price: number;
  price: number;
  purchases_req: number;
};

export default function RewardSettingsScreen({ navigation }: { navigation: any }) {
  const [reward, setReward] = useState<Reward | null>(null);
  const [originalReward, setOriginalReward] = useState<Reward | null>(null); // For revert/cancel
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchasesReq, setPurchasesReq] = useState(1);
  const [priceInput, setPriceInput] = useState<string>(''); // For editable price
  const [usualPriceInput, setUsualPriceInput] = useState<string>(''); // For editable usual price
  const [showSuccess, setShowSuccess] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchReward = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('rewards')
        .select('id, title, description, usual_price, price, purchases_req')
        .order('purchases_req', { ascending: true })
        .limit(1)
        .single();
      if (error) {
        Alert.alert('Error', 'Could not load reward info');
        setReward(null);
        setOriginalReward(null);
        setPriceInput('');
        setUsualPriceInput('');
      } else {
        setReward(data);
        setOriginalReward(data);
        setPurchasesReq(data.purchases_req);
        setPriceInput(data.price !== undefined ? String(data.price) : '');
        setUsualPriceInput(data.usual_price !== undefined ? String(data.usual_price) : '');
      }
      setLoading(false);
    };
    fetchReward();
  }, []);

  // Keep price/inputs in sync with reward state
  useEffect(() => {
    if (reward) {
      setPriceInput(reward.price !== undefined ? String(reward.price) : '');
      setUsualPriceInput(reward.usual_price !== undefined ? String(reward.usual_price) : '');
    }
  }, [reward]);

  // Format price input for display (always show 2 decimals if valid)
  const formatPriceInput = (input: string) => {
    if (input === '' || isNaN(Number(input))) return '';
    const num = Number(input);
    return num.toFixed(2);
  };

  const handleSave = async () => {
    if (!reward) return;

    // Validation
    if (!reward.title.trim()) {
      Alert.alert('Validation Error', 'Title cannot be empty.');
      return;
    }
    if (!reward.description.trim()) {
      Alert.alert('Validation Error', 'Description cannot be empty.');
      return;
    }
    const usualPriceNum = parseFloat(usualPriceInput);
    const priceNum = parseFloat(priceInput);
    if (isNaN(usualPriceNum) || usualPriceNum < 0) {
      Alert.alert('Validation Error', 'Usual price must be a non-negative number.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Validation Error', 'Reward price must be a non-negative number.');
      return;
    }
    if (purchasesReq < 1 || purchasesReq > 10) {
      Alert.alert('Validation Error', 'Purchases required must be between 1 and 10.');
      return;
    }

    setSaving(true);
    const { error } = await supabaseAdmin
      .from('rewards')
      .update({
        title: reward.title.trim(),
        description: reward.description.trim(),
        usual_price: Number(usualPriceInput),
        price: Number(priceInput),
        purchases_req: purchasesReq,
      })
      .eq('id', reward.id);
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Failed to update reward');
    } else {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigation.goBack();
      }, 1200);
    }
  };

  const handleDotPress = (idx: number) => {
    setPurchasesReq(idx + 1);
  };

  const handleCancel = () => {
    if (originalReward) {
      setReward(originalReward);
      setPurchasesReq(originalReward.purchases_req);
      setPriceInput(String(originalReward.price));
      setUsualPriceInput(String(originalReward.usual_price));
    }
    navigation.goBack();
  };

  // Only format price input on blur, not while editing
  const handleUsualPriceBlur = () => {
    if (usualPriceInput !== '' && !isNaN(Number(usualPriceInput))) {
      setUsualPriceInput(Number(usualPriceInput).toFixed(2));
    }
  };
  const handlePriceBlur = () => {
    if (priceInput !== '' && !isNaN(Number(priceInput))) {
      setPriceInput(Number(priceInput).toFixed(2));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { paddingBottom: 0, marginBottom: 0, flex: 1 }]} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: 'transparent', paddingBottom: 0, marginBottom: 0 }}
        edges={['top', 'left', 'right']}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.header}>Edit Reward</Text>
            <View style={styles.form}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={reward?.title ?? ''}
                onChangeText={text => setReward(r => r ? { ...r, title: text } : r)}
                placeholder="Reward Title"
                placeholderTextColor="#aaa"
                maxLength={60}
              />
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={reward?.description ?? ''}
                onChangeText={text => setReward(r => r ? { ...r, description: text } : r)}
                placeholder="Reward Description"
                placeholderTextColor="#aaa"
                multiline
                maxLength={200}
              />
              <Text style={styles.label}>Usual Price (£)</Text>
              <TextInput
                style={styles.input}
                value={usualPriceInput}
                onChangeText={text => {
                  setUsualPriceInput(text);
                  setReward(r => r ? { ...r, usual_price: parseFloat(text) || 0 } : r);
                }}
                onBlur={handleUsualPriceBlur}
                placeholder="Usual Price"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
              <Text style={styles.label}>Your Price (£)</Text>
              <TextInput
                style={styles.input}
                value={priceInput}
                onChangeText={text => {
                  setPriceInput(text);
                  setReward(r => r ? { ...r, price: parseFloat(text) || 0 } : r);
                }}
                onBlur={handlePriceBlur}
                placeholder="Reward Price"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
              <Text style={styles.label}>Purchases Required</Text>
              <View style={styles.dotsRow}>
                {Array.from({ length: 10 }).map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dot,
                      idx < purchasesReq ? styles.dotFilled : styles.dotEmpty,
                    ]}
                    onPress={() => handleDotPress(idx)}
                    activeOpacity={0.7}
                  >
                    {idx < purchasesReq && (
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.purchasesReqText}>
                {purchasesReq} purchase{purchasesReq > 1 ? 's' : ''} required
              </Text>
            </View>
            <View style={styles.buttonColumn}>
              <TouchableOpacity
                style={[styles.cancelButton, saving && styles.saveButtonDisabled]}
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
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {/* Styled success popup, overlays entire screen including notch */}
      {showSuccess && (
        <BlurView
          intensity={100}
          style={[
            styles.successModalOverlay,
            { top: 0, left: 0, right: 0, bottom: 0, position: 'absolute', paddingTop: insets.top }
          ]}
        >
          <View style={styles.successModalContent}>
            <MaterialCommunityIcons name="check-circle" size={54} color="#43b581" style={{ marginBottom: 10 }} />
            <Text style={styles.successModalText}>Reward updated successfully!</Text>
          </View>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#f7f8fa',
    flexGrow: 1,
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: '100%',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 24,
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 15,
    color: '#555',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e6eaf3',
  },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
    justifyContent: 'center',
    gap: 8,
    maxWidth: 320,
    alignSelf: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 3,
    marginVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: '#fff',
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dotEmpty: {
    backgroundColor: '#fff',
    borderColor: '#e6eaf3',
  },
  purchasesReqText: {
    textAlign: 'center',
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 8,
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  cancelButton: {
    backgroundColor: '#e6eaf3',
    borderRadius: 10,
    paddingVertical: 16,
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
    paddingVertical: 16,
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
  bottomSpacer: {
    height: 32,
    backgroundColor: '#f7f8fa',
  },
  successModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 220,
  },
  successModalText: {
    fontSize: 18,
    color: '#43b581',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
});
