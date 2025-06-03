import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ActivityIndicator, Platform, Pressable } from 'react-native';
import { theme } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_LINK =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/app/idXXXXXXXXX'
    : 'https://play.google.com/store/apps/details?id=com.example.loyalty';

type Props = NativeStackScreenProps<RootStackParamList, 'ReferFriendScreen'>;

export default function ReferFriendScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchReferralCode = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', userId)
        .single();
      setReferralCode(data?.referral_code ?? null);
      setLoading(false);
    };
    fetchReferralCode();
  }, [userId]);

  const handleShare = async () => {
    if (!referralCode) return;
    const message = `Join me on Loyalty Rewards! Download the app and use my referral code "${referralCode}" during sign up to get started. ${APP_LINK}`;
    await Share.share({ message });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <LinearGradient colors={theme.colors.gradient} style={StyleSheet.absoluteFill} />
      {/* Back Button */}
      <Pressable
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        android_ripple={{ color: '#e6eaf3', borderless: true }}
        accessibilityLabel="Go back"
      >
        <MaterialCommunityIcons name="chevron-left" size={32} color="#333" />
      </Pressable>
      <View style={styles.container}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="account-multiple-plus" size={48} color={theme.colors.primary} />
          <Text style={styles.title}>Refer a Friend</Text>
          <Text style={styles.description}>
            Invite your friends to join the app! When they sign up and make their first purchase, you’ll earn bonus progress on your loyalty card.
          </Text>
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <>
              <Text style={styles.codeLabel}>Your Referral Code:</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{referralCode}</Text>
              </View>
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <MaterialCommunityIcons name="share-variant" size={22} color="#fff" />
                <Text style={styles.shareButtonText}>Share Invite</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backButton: {
    position: 'absolute',
    left: 18,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 22,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 6,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginVertical: 12 },
  description: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 18 },
  codeLabel: { fontSize: 15, color: '#555', marginTop: 10 },
  codeBox: {
    backgroundColor: '#f7f8fa',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e6eaf3',
  },
  codeText: { fontSize: 20, fontWeight: '700', color: theme.colors.primary, letterSpacing: 1.5 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 18,
    gap: 10,
  },
  shareButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
