import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Switch,
    SafeAreaView,
    Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { supabaseAdmin } from '../lib/supabase';
import { theme } from '../styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePostScreen'>;

const DAYS = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

function formatTimeStr(date: Date) {
    // Only show hours and minutes, no seconds, and never show seconds
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

function formatDateStr(date: Date) {
    return date.toISOString().slice(0, 10);
}

export default function CreatePostScreen({ route, navigation }: Props) {
    const { userId, post } = route.params as any; // post is optional for edit

    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    const [timeStart, setTimeStart] = useState('');
    const [timeEnd, setTimeEnd] = useState('');
    // Change daysOfWeek to be an array of numbers (0=Monday, 6=Sunday)
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [isForever, setIsForever] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [isValidUntil, setIsValidUntil] = useState('');
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [sendNotification, setSendNotification] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);
    // Remove showWarningModal and custom modal usage

    // Date/time picker states
    const [pickerType, setPickerType] = useState<'start' | 'end' | 'date' | null>(null);
    const [pickerValue, setPickerValue] = useState<Date>(new Date());

    // Prefill fields if editing
    useEffect(() => {
        if (post) {
            setTitle(post.title || '');
            setDetails(post.details || '');
            setTimeStart(post.time_start || '');
            setTimeEnd(post.time_end || '');
            // If editing, ensure daysOfWeek is an array of numbers
            setDaysOfWeek(Array.isArray(post.days_of_week) ? post.days_of_week : []);
            setIsForever(post.is_forever || false);
            setIsHidden(post.is_hidden || false);
            setIsValidUntil(post.valid_until || '');
            setEditing(true);
        }
    }, [post]);

    // Show custom modal when pickerType is set
    const showCustomPicker = pickerType !== null;

    // Set pickerValue when opening modal
    useEffect(() => {
        if (pickerType === 'start' && timeStart) setPickerValue(parseTime(timeStart));
        else if (pickerType === 'end' && timeEnd) setPickerValue(parseTime(timeEnd));
        else if (pickerType === 'date' && isValidUntil) setPickerValue(parseDate(isValidUntil));
        else setPickerValue(new Date());
        // eslint-disable-next-line
    }, [pickerType]);

    // Helper to get a display string for the picker value
    const getPickerDisplayValue = () => {
        if (pickerType === 'start' || pickerType === 'end') {
            return formatTimeStr(pickerValue);
        }
        if (pickerType === 'date') {
            return formatDateStr(pickerValue);
        }
        return '';
    };

    // Helper for iOS: show picker inline in modal, for Android: show native picker dialog
    const [androidTempValue, setAndroidTempValue] = useState<Date | null>(null);

    const toggleDay = (dayIdx: number) => {
        setDaysOfWeek(prev =>
            prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx]
        );
    };

    // Helper to show a warning using Alert
    const showWarning = (msg: string) => {
        Alert.alert('Validation Error', msg);
    };

    const handleSave = async () => {
        setWarning(null);
        if (!title.trim()) {
            showWarning('Title is required.');
            return;
        }
        if (!details.trim()) {
            showWarning('Details are required.');
            return;
        }
        if (!isForever) {
            if (!timeStart || !timeEnd) {
                showWarning('Start and end time are required unless post is forever.');
                return;
            }
            // Check that end time is strictly after start time
            const start = parseTime(timeStart);
            const end = parseTime(timeEnd);
            if (end <= start) {
                showWarning('End time must be after start time.');
                return;
            }
            if (daysOfWeek.length === 0) {
                showWarning('Select at least one day.');
                return;
            }
        }
        setSaving(true);
        const postPayload = {
            title: title.trim(),
            details: details.trim(),
            time_start: isForever ? null : timeStart,
            time_end: isForever ? null : timeEnd,
            days_of_week: isForever ? null : daysOfWeek.sort((a, b) => a - b),
            is_forever: isForever,
            is_hidden: isHidden,
            valid_until: isValidUntil ? isValidUntil : null,
            notify_on_creation: sendNotification,
        };
        if (editing && post?.id) {
            const { error } = await supabaseAdmin.from('posts').update(postPayload).eq('id', post.id);
            setSaving(false);
            if (error) {
                Alert.alert('Error saving post', error.message);
            } else {
                navigation.goBack();
            }
        } else {
            // Create new post
            const { data, error } = await supabaseAdmin.from('posts').insert(postPayload).select().single();
            setSaving(false);
            if (error) {
                Alert.alert('Error creating post', error.message);
            } else {
                navigation.goBack();
            }
        }
    };

    const handleDelete = async () => {
        if (!editing || !post?.id) return;
        Alert.alert(
            'Delete Post',
            'Are you sure you want to delete this post? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setSaving(true);
                        const { error } = await supabaseAdmin.from('posts').delete().eq('id', post.id);
                        setSaving(false);
                        if (error) {
                            Alert.alert('Error', error.message);
                        } else {
                            navigation.goBack();
                        }
                    },
                },
            ]
        );
    };

    // Parse time string to Date for picker
    const parseTime = (str: string) => {
        if (!str) return new Date();
        const [h, m] = str.split(':');
        const d = new Date();
        d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
        return d;
    };

    // Parse date string to Date for picker
    const parseDate = (str: string) => {
        if (!str) return new Date();
        const [y, m, d] = str.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d));
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#f7f8fa' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <SafeAreaView style={{ backgroundColor: '#f7f8fa' }}>
                <View style={styles.headerContainer}>
                    <Text style={styles.header}>{editing ? 'Edit Post' : 'Create Post'}</Text>
                </View>
            </SafeAreaView>
            <ScrollView
                contentContainerStyle={styles.formContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <TextInput
                    style={styles.input}
                    placeholder="Title"
                    placeholderTextColor="#aaa"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={60}
                />
                <TextInput
                    style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="Details"
                    placeholderTextColor="#aaa"
                    value={details}
                    onChangeText={setDetails}
                    multiline
                    maxLength={200}
                />
                <View style={styles.row}>
                    <Text style={styles.label}>Valid Forever</Text>
                    <Switch
                        value={isForever}
                        onValueChange={setIsForever}
                        thumbColor={isForever ? theme.colors.primary : '#ccc'}
                        trackColor={{ true: theme.colors.primary, false: '#ccc' }}
                    />
                </View>
                {!isForever && (
                    <>
                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>Start Time</Text>
                            <TouchableOpacity
                                style={styles.pickerInput}
                                onPress={() => setPickerType('start')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                                <Text style={[styles.pickerValue, !timeStart && styles.pickerPlaceholder]}>
                                    {timeStart ? formatTimeStr(parseTime(timeStart)) : 'Select time'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>End Time</Text>
                            <TouchableOpacity
                                style={styles.pickerInput}
                                onPress={() => setPickerType('end')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                                <Text style={[styles.pickerValue, !timeEnd && styles.pickerPlaceholder]}>
                                    {timeEnd ? formatTimeStr(parseTime(timeEnd)) : 'Select time'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>Valid Until</Text>
                            <TouchableOpacity
                                style={styles.pickerInput}
                                onPress={() => setPickerType('date')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.primary} style={{ marginRight: 10 }} />
                                <Text style={[styles.pickerValue, !isValidUntil && styles.pickerPlaceholder]}>
                                    {isValidUntil ? isValidUntil : 'Select date'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.label}>Days of Week</Text>
                        <View style={styles.daysRow}>
                            {DAYS.map((day, idx) => (
                                <TouchableOpacity
                                    key={day}
                                    style={[
                                        styles.dayButton,
                                        daysOfWeek.includes(idx) && styles.dayButtonSelected,
                                    ]}
                                    onPress={() => toggleDay(idx)}
                                >
                                    <Text
                                        style={[
                                            styles.dayButtonText,
                                            daysOfWeek.includes(idx) && styles.dayButtonTextSelected,
                                        ]}
                                    >
                                        {day.slice(0, 3)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}
                <View style={styles.row}>
                    <Text style={styles.label}>Hidden</Text>
                    <Switch
                        value={isHidden}
                        onValueChange={setIsHidden}
                        thumbColor={isHidden ? theme.colors.primary : '#ccc'}
                        trackColor={{ true: theme.colors.primary, false: '#ccc' }}
                    />
                </View>
                {!editing && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Send push notification to all users</Text>
                        <Switch
                            value={sendNotification}
                            onValueChange={setSendNotification}
                            thumbColor={sendNotification ? theme.colors.primary : '#ccc'}
                            trackColor={{ true: theme.colors.primary, false: '#ccc' }}
                        />
                    </View>
                )}
                {/* Add some bottom padding so content is not hidden behind buttons */}
                <View style={{ height: 100 }} />
            </ScrollView>
            <View style={styles.bottomButtonBar}>
                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                            <Text style={styles.saveButtonText}>{editing ? 'Save Changes' : 'Save Post'}</Text>
                        </>
                    )}
                </TouchableOpacity>
                <View style={styles.bottomRow}>
                    <TouchableOpacity
                        style={[
                            styles.cancelButton,
                            !editing && styles.cancelButtonFullWidth
                        ]}
                        onPress={() => navigation.goBack()}
                        disabled={saving}
                    >
                        <MaterialCommunityIcons name="close" size={20} color={theme.colors.primary} />
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    {editing && (
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={handleDelete}
                            disabled={saving}
                        >
                            <MaterialCommunityIcons name="delete-outline" size={20} color="#fff" />
                            <Text style={styles.deleteButtonText}>Delete</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {/* Custom Date/Time Picker Modal */}
            {Platform.OS === 'ios' && (
                <Modal
                    visible={showCustomPicker}
                    animationType="fade"
                    transparent
                    onRequestClose={() => setPickerType(null)}
                >
                    <View style={styles.pickerModalOverlay}>
                        <TouchableOpacity
                            style={styles.pickerModalBackdrop}
                            activeOpacity={1}
                            onPress={() => setPickerType(null)}
                        />
                        <View style={styles.pickerModalCard}>
                            <Text style={styles.pickerModalTitle}>
                                {pickerType === 'start' && 'Select Start Time'}
                                {pickerType === 'end' && 'Select End Time'}
                                {pickerType === 'date' && 'Select Date'}
                            </Text>
                            <DateTimePicker
                                value={pickerValue}
                                mode={pickerType === 'date' ? 'date' : 'time'}
                                display="spinner"
                                onChange={(_, date) => {
                                    if (date) {
                                        setPickerValue(date);
                                        // Live update the preview value in the input as user scrolls
                                        if (pickerType === 'start') setTimeStart(formatTimeStr(date));
                                        else if (pickerType === 'end') setTimeEnd(formatTimeStr(date));
                                        else if (pickerType === 'date') setIsValidUntil(formatDateStr(date));
                                    }
                                }}
                                is24Hour={true}
                                style={styles.nativePicker}
                                textColor="#222"
                            />
                            <View style={styles.pickerModalActions}>
                                <TouchableOpacity
                                    style={[styles.pickerModalButton, styles.pickerModalCancel]}
                                    onPress={() => setPickerType(null)}
                                >
                                    <Text style={styles.pickerModalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.pickerModalButton, styles.pickerModalConfirm]}
                                    onPress={() => {
                                        // No need to set again, already set on scroll
                                        setPickerType(null);
                                    }}
                                >
                                    <Text style={styles.pickerModalConfirmText}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
            {Platform.OS === 'android' && showCustomPicker && (
                <DateTimePicker
                    value={pickerValue}
                    mode={pickerType === 'date' ? 'date' : 'time'}
                    display="default"
                    is24Hour={true}
                    onChange={(_, date) => {
                        if (date) {
                            setPickerValue(date);
                            if (pickerType === 'start') setTimeStart(formatTimeStr(date));
                            else if (pickerType === 'end') setTimeEnd(formatTimeStr(date));
                            else if (pickerType === 'date') setIsValidUntil(formatDateStr(date));
                        }
                        setPickerType(null);
                    }}
                />
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingBottom: 12,
    backgroundColor: '#f7f8fa',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e6eaf3',
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  formContainer: {
    padding: 24,
    backgroundColor: '#f7f8fa',
    flexGrow: 1,
    paddingBottom: 0,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6eaf3',
  },
  label: {
    fontSize: 15,
    color: '#555',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  dayButton: {
    backgroundColor: '#e6eaf3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 4,
  },
  dayButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
    justifyContent: 'space-between',
  },
  pickerInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e6eaf3',
    minHeight: 44,
  },
  pickerValue: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#aaa',
    fontWeight: '400',
  },
  bottomButtonBar: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 36, // Increased padding for space above home bar
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e6eaf3',
    gap: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    justifyContent: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  cancelButtonFullWidth: {
    flex: 1,
    // If only cancel button, take full width
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30,40,60,0.25)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pickerModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  nativePicker: {
    width: '100%',
    marginBottom: 12,
    // textColor is set via prop for iOS, not here
  },
  pickerModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    gap: 16,
  },
  pickerModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerModalCancel: {
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginRight: 8,
  },
  pickerModalConfirm: {
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
  pickerModalCancelText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  pickerModalConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});