import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../lib/supabase';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { TabStackParamList } from '../navigation/types';
import { theme } from '../styles/theme';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CARD_ASPECT_RATIO = 1.586; // Standard credit card ratio
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT_RATIO;

type Purchase = {
  id: string;
  purchase_date: string;
};

type PurchaseStats = {
  week: number;
  month: number;
  year: number;
};

type Props = BottomTabScreenProps<TabStackParamList, 'Home'>;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getYearOptions() {
  const now = new Date();
  const currentYear = now.getFullYear();
  return Array.from({ length: 5 }, (_, i) => currentYear - i);
}

type Reward = {
  id: string;
  title: string;
  description: string;
  usual_price: number;
  price: number;
  purchases_req: number;
};

export default function HomeScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const [showQR, setShowQR] = useState(false);
  const [count, setCount] = useState(0); // Reflects purchases_no
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats] = useState<PurchaseStats>({ week: 0, month: 0, year: 0 });
  const [loading, setLoading] = useState(true); // Add loading state
  const [loadingPurchases, setLoadingPurchases] = useState(false); // For purchases
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);
  const [rewardLoading, setRewardLoading] = useState(true);
  const [showRewardInfo, setShowRewardInfo] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null); // Ref to store the channel instance

  useEffect(() => {
    fetchData();

    // Set up a real-time subscription for purchases_no updates
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('users-purchases-no')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
          (payload) => {
            const updatedPurchasesNo = payload.new.purchases_no;
            setCount(updatedPurchasesNo);
            fetchData(); // Refetch all data on real-time update
          }
        )
        .subscribe();
    }
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // Refetch data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [userId])
  );

  const fetchData = async () => {
    setLoading(true);
    setStatsLoading(true);
    setLoadingPurchases(true);
    try {
      // Fetch purchases_no from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('purchases_no')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error fetching purchases_no:', userError.message);
        setLoading(false);
        setStatsLoading(false);
        setLoadingPurchases(false);
        return;
      }
      setCount(userData?.purchases_no ?? 0);

      // Fetch recent purchases (no product_name)
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .select('id, purchase_date')
        .eq('user_id', userId)
        .order('purchase_date', { ascending: false });

      if (purchaseError) {
        console.error('Error fetching purchases:', purchaseError.message);
        setLoading(false);
        setStatsLoading(false);
        setLoadingPurchases(false);
        return;
      }

      const mappedPurchases = purchaseData?.map((purchase) => ({
        ...purchase,
        created_at: purchase.purchase_date,
      }));

      // Calculate stats
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const stats = {
        week: 0,
        month: 0,
        year: 0,
      };

      mappedPurchases?.forEach((purchase) => {
        const date = new Date(purchase.created_at);
        if (date >= weekAgo) stats.week++;
        if (date >= monthAgo) stats.month++;
        if (date >= yearAgo) stats.year++;
      });

      setPurchases(mappedPurchases ?? []);
      setStats(stats);
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
      setStatsLoading(false);
      setLoadingPurchases(false);
    }
  };

  // Fetch reward info on mount
  useEffect(() => {
    const fetchReward = async () => {
      setRewardLoading(true);
      try {
        const { data, error } = await supabase
          .from('rewards')
          .select('id, title, description, usual_price, price, purchases_req')
          .order('purchases_req', { ascending: true })
          .limit(1)
          .single();
        if (error) {
          console.error('Error fetching reward:', error.message);
          setReward(null);
        } else {
          setReward(data);
        }
      } catch (err) {
        setReward(null);
      } finally {
        setRewardLoading(false);
      }
    };
    fetchReward();
  }, []);

  // Filter purchases for selected month/year
  const filteredPurchases = purchases.filter(p => {
    const date = new Date(p.purchase_date);
    return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
  });

  // Calendar selector component
  const renderCalendarSelector = () => (
    <View style={styles.calendarSelectorContainer}>
      <View style={styles.calendarRow}>
        <TouchableOpacity
          style={styles.arrowButton}
          onPress={() => {
            if (selectedMonth === 0) {
              if (selectedYear > getYearOptions()[getYearOptions().length - 1]) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              }
            } else {
              setSelectedMonth(selectedMonth - 1);
            }
          }}
          accessibilityLabel="Previous month"
          disabled={
            selectedMonth === 0 &&
            selectedYear === getYearOptions()[getYearOptions().length - 1]
          }
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={
              selectedMonth === 0 &&
              selectedYear === getYearOptions()[getYearOptions().length - 1]
                ? "#bbb"
                : theme.colors.primary
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.monthYearDisplay}
          activeOpacity={0.8}
          onPress={() => setShowMonthPicker(true)}
        >
          <Text style={styles.monthYearText}>
            {MONTHS[selectedMonth]} {selectedYear}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.arrowButton}
          onPress={() => {
            if (selectedMonth === 11) {
              if (selectedYear < getYearOptions()[0]) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              }
            } else {
              setSelectedMonth(selectedMonth + 1);
            }
          }}
          accessibilityLabel="Next month"
          disabled={
            selectedMonth === 11 &&
            selectedYear === getYearOptions()[0]
          }
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={28}
            color={
              selectedMonth === 11 &&
              selectedYear === getYearOptions()[0]
                ? "#bbb"
                : theme.colors.primary
            }
          />
        </TouchableOpacity>
      </View>
      {/* Month/Year Picker Modal */}
      {showMonthPicker && (
        <Modal
          visible={showMonthPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMonthPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerModalOverlay}
            activeOpacity={1}
            onPressOut={() => setShowMonthPicker(false)}
          >
            <View style={styles.pickerModalContent}>
              <Text style={styles.pickerModalTitle}>Select Month & Year</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerModalMonths}>
                {MONTHS.map((month, idx) => (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.pickerModalMonthButton,
                      selectedMonth === idx && styles.pickerModalMonthButtonSelected
                    ]}
                    onPress={() => setSelectedMonth(idx)}
                  >
                    <Text style={[
                      styles.pickerModalMonthText,
                      selectedMonth === idx && styles.pickerModalMonthTextSelected
                    ]}>
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerModalYears}>
                {getYearOptions().map(year => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.pickerModalYearButton,
                      selectedYear === year && styles.pickerModalYearButtonSelected
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text style={[
                      styles.pickerModalYearText,
                      selectedYear === year && styles.pickerModalYearTextSelected
                    ]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.pickerModalCloseButton}
                onPress={() => setShowMonthPicker(false)}
              >
                <Text style={styles.pickerModalCloseButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );

  // Use purchases_req from reward for loyalty card
  const purchasesRequired = reward?.purchases_req ?? 6;
  const dots = Array.from({ length: purchasesRequired }, (_, i) => i < count);

  // Loyalty Card with Info Button
  const renderLoyaltyCard = () => (
    <LinearGradient
      colors={theme.colors.gradient}
      style={styles.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Loyalty Card</Text>
          <Text style={styles.cardSubtitle}>{count}/{purchasesRequired} Purchases</Text>
        </View>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => setShowRewardInfo(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="information-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.dotsContainer}>
        {dots.map((filled, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              filled ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      {/* Reward Info Modal */}
      <Modal
        visible={showRewardInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRewardInfo(false)}
      >
        {/* Use BlurView for background, matching QR modal */}
        <BlurView intensity={100} style={styles.rewardModalOverlay}>
          <View style={styles.rewardModalContent}>
            {rewardLoading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            ) : reward ? (
              <>
                <Text style={styles.rewardTitle}>{reward.title}</Text>
                <Text style={styles.rewardDescription}>{reward.description}</Text>
                <View style={styles.rewardRow}>
                  <Text style={styles.rewardLabel}>Usual Price:</Text>
                  <Text style={styles.rewardValue}>
                    {reward.usual_price === 0 ? 'Free' : `£${reward.usual_price.toFixed(2)}`}
                  </Text>
                </View>
                <View style={styles.rewardRow}>
                  <Text style={styles.rewardLabel}>Your Price:</Text>
                  <Text style={[styles.rewardValue, reward.price === 0 && styles.rewardFree]}>
                    {reward.price === 0 ? 'Free' : `£${reward.price.toFixed(2)}`}
                  </Text>
                </View>
                <View style={styles.rewardRow}>
                  <Text style={styles.rewardLabel}>Purchases Required:</Text>
                  <Text style={styles.rewardValue}>{reward.purchases_req}</Text>
                </View>
                <TouchableOpacity
                  style={styles.rewardModalCloseButton}
                  onPress={() => setShowRewardInfo(false)}
                >
                  <Text style={styles.rewardModalCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.rewardError}>Unable to load reward info.</Text>
            )}
          </View>
        </BlurView>
      </Modal>
    </LinearGradient>
  );

  // Purchases list for selected month/year
  const renderPurchases = () => {
    if (loadingPurchases) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading Purchases...</Text>
        </View>
      );
    }
    if (filteredPurchases.length === 0) {
      return (
        <View style={styles.noPurchasesContainer}>
          <Text style={styles.noPurchasesText}>No purchases for this month.</Text>
        </View>
      );
    }
    // Show purchase number (reverse order, so most recent is #1)
    return filteredPurchases.map((purchase, idx) => {
      const date = new Date(purchase.purchase_date);
      const day = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return (
        <View key={purchase.id} style={styles.purchaseItem}>
          <View style={styles.purchaseIconContainer}>
            <LinearGradient
              colors={theme.colors.gradient}
              style={styles.purchaseIconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="cart-outline" size={22} color="#fff" />
            </LinearGradient>
          </View>
          <View style={styles.purchaseInfo}>
            <Text style={styles.purchaseDay}>{day} <Text style={styles.purchaseTime}>{time}</Text></Text>
            <Text style={styles.purchaseNumber}>Purchase #{filteredPurchases.length - idx}</Text>
          </View>
        </View>
      );
    });
  };

  const renderQRModal = () => (
    <Modal
      visible={showQR}
      transparent
      animationType="fade"
      onRequestClose={() => setShowQR(false)}
    >
      <BlurView intensity={100} style={styles.modalContainer}>
        <View style={styles.qrContainer}>
          <QRCode value={userId} size={200} />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowQR(false)}
          >
            <LinearGradient
              colors={theme.colors.gradient}
              style={styles.closeButtonGradient}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>Your Activity</Text>
      {statsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.week}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.month}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.year}</Text>
            <Text style={styles.statLabel}>This Year</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {renderLoyaltyCard()}

        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setShowQR(true)}
        >
          <MaterialCommunityIcons name="qrcode" size={24} color="#fff" />
          <Text style={styles.qrButtonText}>Show QR Code</Text>
        </TouchableOpacity>

        {renderStats()}

        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Recent Purchases</Text>
          {renderCalendarSelector()}
          {renderPurchases()}
        </View>
      </ScrollView>
      {renderQRModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 20,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#fff',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    gap: 10,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
  },
  closeButton: {
    marginTop: 20,
    width: '100%',
  },
  closeButtonGradient: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    margin: 20,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  historyContainer: {
    margin: 20,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  calendarSelectorContainer: {
    marginBottom: 10,
    marginTop: 10,
    backgroundColor: '#f7f8fa',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  arrowButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#e6eaf3',
    marginHorizontal: 2,
  },
  monthYearDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e6eaf3',
    minWidth: 120,
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  // Modal styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: theme.colors.primary,
  },
  pickerModalMonths: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pickerModalMonthButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 6,
    backgroundColor: '#e6eaf3',
  },
  pickerModalMonthButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  pickerModalMonthText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 15,
  },
  pickerModalMonthTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  pickerModalYears: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pickerModalYearButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 6,
    backgroundColor: '#e6eaf3',
  },
  pickerModalYearButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  pickerModalYearText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 15,
  },
  pickerModalYearTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  pickerModalCloseButton: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  pickerModalCloseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  noPurchasesContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  noPurchasesText: {
    color: '#888',
    fontSize: 16,
    fontStyle: 'italic',
  },
  purchaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f1f5',
  },
  purchaseIconContainer: {
    marginRight: 16,
  },
  purchaseIconGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseInfo: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  purchaseDay: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
  },
  purchaseTime: {
    fontSize: 13,
    color: '#888',
    fontWeight: '400',
  },
  purchaseNumber: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.primary,
  },
  selectedMonthLabel: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  selectedMonthHighlight: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  infoButton: {
    padding: 6,
    marginLeft: 8,
    marginTop: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  // Reward Modal Styles
  rewardModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Remove backgroundColor here, BlurView will handle it
  },
  rewardModalContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  rewardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  rewardDescription: {
    fontSize: 16,
    color: '#444',
    marginBottom: 18,
    textAlign: 'center',
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  rewardLabel: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  rewardValue: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  rewardFree: {
    color: '#43b581',
    fontWeight: '700',
  },
  rewardModalCloseButton: {
    marginTop: 18,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  rewardModalCloseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  rewardError: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 20,
    textAlign: 'center',
  },
});