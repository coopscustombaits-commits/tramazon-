import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/components/post-media';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { CAPTION_MAX, createPost } from '@/lib/db/posts';
import type { MediaKind } from '@/types/models';

/** Anything longer gets rejected before the upload starts. */
const MAX_VIDEO_SECONDS = 60;

type PickedMedia = {
  uri: string;
  kind: MediaKind;
  width: number;
  height: number;
  durationMs: number | null;
  /** Generated poster frame for videos. */
  thumbnailUri: string | null;
};

/**
 * Post a catch. The post is created as `pending` — it isn't visible to anyone
 * else until Coop approves it, and the screen says so plainly rather than
 * letting people wonder where their post went.
 */
export default function CreatePostScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const router = useRouter();
  const { profile } = useAuth();

  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [species, setSpecies] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function pickFrom(source: 'library' | 'camera') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        'You can turn this on in your device settings.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    const asset = !result.canceled ? result.assets[0] : null;
    if (!asset) return;

    const kind: MediaKind = asset.type === 'video' ? 'video' : 'photo';

    if (kind === 'video' && asset.duration && asset.duration > MAX_VIDEO_SECONDS * 1000) {
      Alert.alert(
        'Clip too long',
        `Keep videos under ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`,
      );
      return;
    }

    setMedia({
      uri: asset.uri,
      kind,
      width: asset.width,
      height: asset.height,
      durationMs: kind === 'video' ? (asset.duration ?? null) : null,
      thumbnailUri: kind === 'video' ? await posterFrame(asset.uri) : null,
    });
  }

  /**
   * Grab a frame to use as the video's poster. Without one the feed shows a
   * black rectangle until the first frame decodes.
   */
  async function posterFrame(uri: string): Promise<string | null> {
    try {
      const { uri: thumbnail } = await VideoThumbnails.getThumbnailAsync(uri, { time: 500 });
      return thumbnail;
    } catch (error) {
      console.warn('[create] could not generate a poster frame', error);
      return null;
    }
  }

  function chooseMedia() {
    Alert.alert('Add a photo or video', undefined, [
      { text: 'Take a photo or video', onPress: () => void pickFrom('camera') },
      { text: 'Choose from library', onPress: () => void pickFrom('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSubmit() {
    if (!profile || !media) return;

    setSubmitting(true);
    try {
      await createPost({
        profile,
        uri: media.uri,
        kind: media.kind,
        width: media.width,
        height: media.height,
        durationMs: media.durationMs,
        thumbnailUri: media.thumbnailUri,
        caption,
        species: species || null,
      });

      setMedia(null);
      setCaption('');
      setSpecies('');

      Alert.alert(
        'Sent for review',
        "Coop will take a look and your catch will show up in the feed once it's approved. We'll let you know.",
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
      );
    } catch (caught) {
      Alert.alert('Could not post', authErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll avoidKeyboard padded={false}>
      <AppHeader title="New Catch" />

      <View style={styles.body}>
        {media ? (
          <Pressable onPress={chooseMedia} disabled={submitting}>
            <Image
              source={{ uri: media.thumbnailUri ?? media.uri }}
              style={styles.preview}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            {media.kind === 'video' ? (
              <View style={styles.videoMarker}>
                <Ionicons name="videocam" size={14} color={Colors.textInverse} />
                <Text style={styles.changeLabel}>
                  {media.durationMs ? formatDuration(media.durationMs) : 'Video'}
                </Text>
              </View>
            ) : null}
            <View style={styles.changeBadge}>
              <Ionicons name="swap-horizontal" size={16} color={Colors.textInverse} />
              <Text style={styles.changeLabel}>Change</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo or video"
            onPress={chooseMedia}
            style={({ pressed }) => [styles.picker, pressed && styles.pickerPressed]}>
            <Ionicons name="camera-outline" size={36} color={Colors.primary} />
            <Text style={styles.pickerLabel}>Add a photo or video of your catch</Text>
            <Text style={styles.pickerHint}>
              Camera or library · clips up to {MAX_VIDEO_SECONDS}s
            </Text>
          </Pressable>
        )}

        <TextField
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Where, what bait, how big..."
          multiline
          maxLength={CAPTION_MAX}
          style={styles.captionInput}
          editable={!submitting}
        />

        <TextField
          label="Species (optional)"
          value={species}
          onChangeText={setSpecies}
          placeholder="Largemouth bass"
          autoCapitalize="words"
          editable={!submitting}
        />

        <View style={styles.notice}>
          <Ionicons name="eye-off-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.noticeText}>
            Catches are reviewed before they go public. Yours won&apos;t be visible to
            anyone else until it&apos;s approved.
          </Text>
        </View>

        <Button
          label="Send for review"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!media || !profile}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  body: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  picker: {
    height: 220,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  pickerPressed: {
    backgroundColor: Colors.primaryTint,
  },
  pickerLabel: {
    ...Typography.bodyStrong,
  },
  pickerHint: {
    ...Typography.caption,
  },
  preview: {
    width: '100%',
    height: 260,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
  },
  videoMarker: {
    position: 'absolute',
    left: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  changeBadge: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  changeLabel: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: '600',
  },
  captionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.warningTint,
    borderRadius: Radius.md,
  },
  noticeText: {
    ...Typography.caption,
    flex: 1,
    color: Colors.text,
  },
}));
