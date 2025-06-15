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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types.ts';
import { supabaseAdmin } from '../lib/supabase.ts';
import { theme } from '../styles/theme.ts';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePostScreen'>;

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

function formatTimeStr(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
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

  // Date/time picker states
  const [pickerType, setPickerType] = useState<'start' | 'end' | 'date' | null>(null);

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

  const toggleDay = (dayIdx: number) => {
    setDaysOfWeek(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required.');
      return;
    }
    if (!details.trim()) {
      Alert.alert('Validation Error', 'Details are required.');
      return;
    }
    if (!isForever) {
      if (!timeStart || !timeEnd) {
        Alert.alert('Validation Error', 'Start and end time are required unless post is forever.');
        return;
      }
      if (daysOfWeek.length === 0) {
        Alert.alert('Validation Error', 'Select at least one day.');
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
        Alert.alert('Error', error.message);
      } else {
        navigation.goBack();
      }
    } else {
      // Create new post
      const { data, error } = await supabaseAdmin.from('posts').insert(postPayload).select().single();
      setSaving(false);
      if (error) {
        Alert.alert('Error', error.message);
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>{editing ? 'Edit Post' : 'Create Post'}</Text>
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
            <View style={styles.row}>
              <Text style={styles.label}>Start Time</Text>
              <TouchableOpacity
                style={[styles.input, { flex: 1, marginLeft: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setPickerType('start')}
                activeOpacity={0.7}
              >
                <Text style={{ color: timeStart ? '#222' : '#aaa', fontSize: 16 }}>
                  {timeStart ? timeStart : 'Select time'}
                </Text>
                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>End Time</Text>
              <TouchableOpacity
                style={[styles.input, { flex: 1, marginLeft: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setPickerType('end')}
                activeOpacity={0.7}
              >
                <Text style={{ color: timeEnd ? '#222' : '#aaa', fontSize: 16 }}>
                  {timeEnd ? timeEnd : 'Select time'}
                </Text>
                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} />
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
            <Text style={styles.label}>Valid Until</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setPickerType('date')}
              activeOpacity={0.7}
            >
              <Text style={{ color: isValidUntil ? '#222' : '#aaa', fontSize: 16 }}>
                {isValidUntil ? isValidUntil : 'Select date'}
              </Text>
              <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
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
        <View style={styles.buttonRow}>
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
        </View>

        {/* DateTimePickerModal */}
        <DateTimePickerModal
          isVisible={pickerType !== null}
          mode={pickerType === 'date' ? 'date' : 'time'}
          date={
            pickerType === 'start'
              ? parseTime(timeStart)
              : pickerType === 'end'
              ? parseTime(timeEnd)
              : pickerType === 'date'
              ? parseDate(isValidUntil)
              : new Date()
          }
          onConfirm={date => {
            if (pickerType === 'start') setTimeStart(formatTimeStr(date));
            else if (pickerType === 'end') setTimeEnd(formatTimeStr(date));
            else if (pickerType === 'date') setIsValidUntil(formatDateStr(date));
            setPickerType(null);
          }}
          onCancel={() => setPickerType(null)}
          is24Hour={true}
          display="default"
          // Optionally, add minimumDate for valid_until if needed
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#f7f8fa',
    flexGrow: 1,
    minHeight: '100%',
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 24,
    textAlign: 'center',
    marginTop: 8,
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignSelf: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignSelf: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
});
