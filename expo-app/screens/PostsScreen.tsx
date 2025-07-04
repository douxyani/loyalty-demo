import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { Post } from '../types/database';
import { sendPostNotification } from '../lib/pushNotifications';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.94;

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

type Props = {
  route: { params: { userId: string; isAdmin: boolean } };
};

function formatTime(time: string | null) {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${h}:${m}`;
}

function formatDays(days: number[] | null) {
  if (!days || days.length === 0) return '';
  if (days.length === 7) return 'Every day';
  // Sort and map int to day abbreviation
  return days
    .sort((a, b) => a - b)
    .map(idx => DAYS[idx]?.slice(0, 3) ?? '')
    .join(', ');
}

function isPostActive(post: Post) {
  if (post.is_hidden) return false;
  if (post.is_forever) return true;
  const now = new Date();
  if (post.valid_until && new Date(post.valid_until) < now) return false;
  if (post.days_of_week && post.days_of_week.length > 0) {
    // 0 = Monday, 6 = Sunday
    const jsDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dbDay = jsDay === 0 ? 6 : jsDay - 1; // Convert JS Sunday(0) to 6, others -1
    if (!post.days_of_week.includes(dbDay)) return false;
  }
  if (post.time_start && post.time_end) {
    const [startH, startM] = post.time_start.split(':').map(Number);
    const [endH, endM] = post.time_end.split(':').map(Number);
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    const nowMin = nowH * 60 + nowM;
    if (nowMin < start || nowMin > end) return false;
  }
  return true;
}

function PostCard({
  post,
  isAdmin,
  onEdit,
  onDelete,
}: {
  post: Post;
  isAdmin?: boolean;
  onEdit?: (post: Post) => void;
  onDelete?: (post: Post) => void;
}) {
  const active = isPostActive(post);

  const handleNotify = () => {
    Alert.alert(
      'Notify Users',
      'Send a push notification about this post to all users?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Notify',
          style: 'destructive',
          onPress: async () => {
            try {
              await sendPostNotification(post.id, post.title, post.details);
              Alert.alert('Notification Sent', 'Users have been notified.');
            } catch (err) {
                console.error('Notification error:', err);
              Alert.alert('Notification Error', 'Failed to send notification.');
            }
          },
        },
      ]
    );
  };

  const showInactiveBanner = !active;

  return (
    <View
      style={[
        styles.card,
        !active && styles.cardInactive,
        Platform.OS === 'ios' ? styles.cardShadowIOS : styles.cardShadowAndroid,
      ]}
    >
      {showInactiveBanner && isAdmin && (
        <View style={styles.inactiveBanner}>
          <MaterialCommunityIcons name="eye-off" size={16} color="#bbb" />
          <Text style={styles.inactiveText}>Not Active</Text>
        </View>
      )}
      {showInactiveBanner && !isAdmin && (
        <View style={styles.inactiveOverlayUser}>
          <MaterialCommunityIcons name="eye-off" size={16} color="#bbb" />
          <Text style={styles.inactiveText}>Not Active</Text>
        </View>
      )}
      <View style={[
        styles.cardContent,
        showInactiveBanner && isAdmin && styles.cardContentWithBanner
      ]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, !active && styles.cardTitleInactive]}>
            {post.title}
          </Text>
          {isAdmin && (
            <View style={styles.adminActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onEdit && onEdit(post)}
                accessibilityLabel="Edit post"
              >
                <MaterialCommunityIcons name="pencil" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onDelete && onDelete(post)}
                accessibilityLabel="Delete post"
              >
                <MaterialCommunityIcons name="delete-outline" size={20} color="#F44336" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleNotify}
                accessibilityLabel="Notify users"
              >
                <MaterialCommunityIcons name="bell-ring-outline" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={[styles.cardDetails, !active && styles.cardDetailsInactive]}>
          {post.details}
        </Text>
        <View style={styles.cardMetaRow}>
          {post.is_forever ? (
            <Text style={styles.cardMeta}>Valid forever</Text>
          ) : (
            <>
              {post.valid_until && (
                <Text style={styles.cardMeta}>
                  Until {new Date(post.valid_until).toLocaleDateString()}
                </Text>
              )}
              {post.days_of_week && post.days_of_week.length > 0 && (
                <Text style={styles.cardMeta}>
                  {formatDays(post.days_of_week as number[])}
                </Text>
              )}
              {post.time_start && post.time_end && (
                <Text style={styles.cardMeta}>
                  {formatTime(post.time_start)} - {formatTime(post.time_end)}
                </Text>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default function PostsScreen({ route }: Props) {
  const { userId, isAdmin } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('is_hidden', { ascending: true })
      .order('is_forever', { ascending: false })
      .order('valid_until', { ascending: false });
    if (error) {
      setPosts([]);
    } else {
      setPosts(data.filter((p: Post) => !p.is_hidden));
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  // Admin: Edit post handler
  const handleEditPost = (post: Post) => {
    navigation.navigate('CreatePostScreen', { userId, post }); // Pass post for editing
  };

  // Admin: Delete post handler
  const handleDeletePost = (post: Post) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('posts')
              .delete()
              .eq('id', post.id);
            if (error) {
              Alert.alert('Error', 'Failed to delete post.');
            } else {
              setPosts(prev => prev.filter(p => p.id !== post.id));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* ...no header here, let navigation handle it... */}
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                isAdmin={isAdmin}
                onEdit={handleEditPost}
                onDelete={handleDeletePost}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="information-outline" size={40} color="#bbb" />
                <Text style={styles.emptyText}>No posts available.</Text>
              </View>
            }
          />
        )}
        {isAdmin && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreatePostScreen', { userId, post: null })}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            <Text style={styles.createButtonText}>Create Post</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fa' },
  container: { flex: 1, padding: 0, paddingBottom: 0 },
  listContent: {
    paddingBottom: 100,
    gap: 16,
    paddingTop: 12,
  },
  card: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    borderRadius: 16,
    padding: 0,
    marginBottom: 10,
    backgroundColor: '#fff',
    marginTop: 0,
    marginHorizontal: 0,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f1f5',
    flexDirection: 'column',
  },
  cardShadowIOS: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardShadowAndroid: {
    elevation: 1,
  },
  cardInactive: {
    opacity: 0.7,
    backgroundColor: '#f7f8fa',
    borderColor: '#e6eaf3',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    flex: 1,
    letterSpacing: 0.1,
  },
  cardTitleInactive: {
    color: '#aaa',
  },
  cardDetails: {
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
    fontWeight: '500',
  },
  cardDetailsInactive: {
    color: '#aaa',
  },
  cardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
    marginBottom: 0,
  },
  cardMeta: {
    fontSize: 13,
    color: theme.colors.primary,
    backgroundColor: '#f0f1f5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
    fontWeight: '600',
  },
  inactiveBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f8fa',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e6eaf3',
    minHeight: 24,
    height: 28,
    zIndex: 10,
    gap: 4,
  },
  inactiveOverlayUser: {
    position: 'absolute',
    top: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 10,
  },
  inactiveText: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  cardContent: {
    padding: 18,
    paddingTop: 12,
  },
  cardContentWithBanner: {
    paddingTop: 36,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#bbb',
    fontSize: 16,
    marginTop: 10,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  adminActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 2,
  },
  iconButton: {
    padding: 4,
    borderRadius: 8,
    marginLeft: 2,
  },
});
