import React from 'react';
import { Text, View, StyleSheet, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabStackParamList, RootStackParamList, ActionType } from '../navigation/types';
import { theme } from '../styles/theme';

type AdminScreenNavigationProp = CompositeNavigationProp<
  BottomTabScreenProps<TabStackParamList, 'AdminScreen'>['navigation'],
  NativeStackNavigationProp<RootStackParamList>
>;

type Props = {
  route: BottomTabScreenProps<TabStackParamList, 'AdminScreen'>['route'];
  navigation: AdminScreenNavigationProp;
};

const { width } = Dimensions.get('window');
const GRID_PADDING = 20;
const GRID_GAP = 10;
const ITEMS_PER_ROW = Math.max(2, Math.floor((width - GRID_PADDING * 2) / 200));
const ITEM_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP * (ITEMS_PER_ROW - 1)) / ITEMS_PER_ROW;

export default function AdminScreen({ route, navigation }: Props) {
  const handleAction = (action: ActionType) => {
    navigation.navigate('QRScannerScreen', {
      action,
      adminUser: {
        userId: route.params.userId,
        email: route.params.email,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => handleAction('purchase1')}
        >
          <MaterialCommunityIcons name="cash-plus" size={32} color={theme.colors.primary} />
          <Text style={styles.gridItemText}>Register 1 Purchase</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => handleAction('purchase2')}
        >
          <MaterialCommunityIcons name="cash-multiple" size={32} color={theme.colors.primary} />
          <Text style={styles.gridItemText}>Register 2 Purchases</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => handleAction('claim')}
        >
          <MaterialCommunityIcons name="gift" size={32} color={theme.colors.primary} />
          <Text style={styles.gridItemText}>Claim Reward</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.rewardSettingsButton}
        onPress={() => navigation.navigate('RewardSettingsScreen')}
      >
        <MaterialCommunityIcons name="cog-outline" size={22} color="#fff" />
        <Text style={styles.rewardSettingsButtonText}>Reward Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: GRID_PADDING,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GRID_GAP,
  },
  gridItem: {
    width: ITEM_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  gridItemText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  rewardSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 30,
    alignSelf: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rewardSettingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});