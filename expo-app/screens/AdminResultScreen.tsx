import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminResultScreen'>;

export default function AdminResultScreen({ route, navigation }: Props) {
    const { success, message, adminUser } = route.params;

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <MaterialCommunityIcons
                    name={success ? 'check-circle' : 'close-circle'}
                    size={80}
                    color={success ? '#4CAF50' : '#F44336'}
                />
                <Text style={styles.message}>{message}</Text>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                        navigation.navigate('MainTabs', {
                            screen: 'AdminScreen', // Navigate directly to the AdminScreen tab
                            userId: adminUser.userId,
                            email: adminUser.email,
                            isAdmin: true, // Ensure isAdmin is preserved
                        });
                    }}
                >
                    <Text style={styles.buttonText}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
    },
    content: {
        alignItems: 'center',
    },
    message: {
        fontSize: 18,
        textAlign: 'center',
        marginVertical: 20,
        color: '#333',
    },
    button: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
