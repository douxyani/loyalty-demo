import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Dimensions, Alert, Platform, Linking } from 'react-native';
import { CameraView, BarcodeScanningResult, Camera } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { theme } from '../styles/theme';
import { SvgXml } from 'react-native-svg';
import { RealtimeChannel } from '@supabase/supabase-js';

type Props = NativeStackScreenProps<RootStackParamList, 'QRScannerScreen'>;

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

const QR_FRAME = `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256">
  <path fill="rgba(0,0,0,0.5)" d="M24.8,216.5v-59H10v59c0,16.2,13.3,29.5,29.5,29.5h59v-14.7h-59C31.4,231.3,24.8,224.6,24.8,216.5z M10,39.5v59h14.8v-59c0-8.1,6.6-14.8,14.8-14.8h59V10h-59C23.3,10,10,23.3,10,39.5z M216.5,10h-59v14.8h59c8.1,0,14.8,6.6,14.8,14.8v59H246v-59C246,23.3,232.7,10,216.5,10z M231.3,216.5c0,8.1-6.6,14.8-14.8,14.8h-59V246h59c16.2,0,29.5-13.3,29.5-29.5v-59h-14.7V216.5z"/>
</svg>
`;

type UserRecord = {
  id: string;
  name: string;
  purchases_no: number;
  email?: string;
};

export default function QRScannerScreen({ route, navigation }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [scanHandled, setScanHandled] = useState(false);
  const { action, adminUser } = route.params;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please grant camera access to scan QR codes',
            [
              {
                text: 'Cancel',
                onPress: () => navigation.goBack(),
                style: 'cancel',
              },
              {
                text: 'Settings',
                onPress: () =>
                  Platform.OS === 'ios'
                    ? Linking.openURL('app-settings:')
                    : Linking.openSettings(),
              },
            ]
          );
        }
      } catch (err) {
        console.error('Camera permission error:', err);
        Alert.alert('Error', 'Could not access camera', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    })();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // Reset scan states when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Screen focused, resetting scan states');
      setScanHandled(false);
      setIsScanning(true);
    });
    return unsubscribe;
  }, [navigation]);

  const handleBarcodeScanned = async ({ data: userId }: BarcodeScanningResult) => {
    if (loading || !isScanning || scanHandled) return;
    if (debounceTimeout.current) return;
    debounceTimeout.current = setTimeout(() => {
      debounceTimeout.current = null;
    }, 200); // 200 ms debounce
    setScanHandled(true);
    setIsScanning(false);
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUser = session?.session?.user;

      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }

      const { data: userRole, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      if (roleError || !userRole) {
        throw new Error(`Failed to fetch user role: ${roleError?.message || 'Unknown error'}`);
      }

      console.log(userId)

      let { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, name, purchases_no')
        .eq('id', userId)
        .single();

      // if (!userData) {
      //   console.log('User not found in users table, checking auth...');
      //   const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

      //   if (authError || !user) {
      //     throw new Error(`User not found in auth system: ${authError?.message || 'Unknown error'}`);
      //   }

      //   const { data: newUser, error: createError } = await client
      //     .from('users')
      //     .insert([
      //       {
      //         id: userId,
      //         email: user.email,
      //         name: user.user_metadata?.name || 'Unknown User',
      //         purchases_no: 0,
      //       },
      //     ])
      //     .select()
      //     .single();

      //   if (createError || !newUser) throw new Error(`Failed to create user record: ${createError?.message || 'Unknown error'}`);
      //   userData = newUser;
      // }

      if (!userData) throw new Error('Failed to get or create user data');
      const user = userData as UserRecord;
      const currentPurchases = user.purchases_no || 0;

      if (action === 'claim') {
        if (currentPurchases < 6) {
          navigation.replace('AdminResultScreen', {
            success: false,
            message: `${user.name} needs ${6 - currentPurchases} more purchase(s) to claim a reward.`,
            adminUser,
          });
          return;
        }

        await supabaseAdmin.from('users').update({ purchases_no: 0 }).eq('id', userId);

        navigation.replace('AdminResultScreen', {
          success: true,
          message: `Reward claimed for ${user.name}!`,
          adminUser,
        });
      } else {
        const increment = action === 'purchase1' ? 1 : 2;
        console.log(`Registering ${increment} purchase(s) for userId: ${userId}`);

        const now = new Date();
        const purchasesToInsert = Array.from({ length: increment }).map(() => ({
          user_id: userId,
          purchase_date: now.toISOString(),
        }));

        const { error: purchasesInsertError } = await supabaseAdmin
          .from('purchases')
          .insert(purchasesToInsert);

        if (purchasesInsertError) {
          throw new Error(`Failed to record purchase(s): ${purchasesInsertError.message}`);
        }

        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ purchases_no: currentPurchases + increment })
          .eq('id', userId);

        if (updateError) {
          throw new Error(`Failed to update purchases_no: ${updateError.message}`);
        }

        navigation.replace('AdminResultScreen', {
          success: true,
          message: `${increment} purchase(s) credited to ${user.name}`,
          adminUser,
        });
      }
    } catch (error: any) {
      console.error('Error in handleBarcodeScanned:', error.message);
      navigation.replace('AdminResultScreen', {
        success: false,
        message: error.message,
        adminUser,
      });
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.statusText}>Requesting camera access...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.statusText}>No access to camera</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
      />

      <View style={StyleSheet.absoluteFillObject}>
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
        <View style={styles.scanAreaContainer}>
          <SvgXml
            xml={QR_FRAME}
            width={SCAN_AREA_SIZE}
            height={SCAN_AREA_SIZE}
          />
          <Text style={styles.scanText}>Centre QR code in frame</Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanAreaContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    opacity: 0.8,
  },
});