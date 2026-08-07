import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { CAPTION_MAX, createPost } from '@/lib/db/posts';

type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Post a catch. The post is created as `pending` — it isn't visible to anyone
 * else until Coop approves it, and the screen says so plainly rather than
 * letting people wonder where their post went.
 */
export default function CreatePostScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [image, setImage] = useState<PickedImage | null>(null);
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
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    const asset = !result.canceled ? result.assets[0] : null;
    if (asset) {
      setImage({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  }

  function choosePhoto() {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take a photo', onPress: () => void pickFrom('camera') },
      { text: 'Choose from library', onPress: () => void pickFrom('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSubmit() {
    if (!profile || !image) return;

    setSubmitting(true);
    try {
      await createPost({
        profile,
        imageUri: image.uri,
        imageWidth: image.width,
        imageHeight: image.height,
        caption,
        species: species || null,
      });

      setImage(null);
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
        {image ? (
          <Pressable onPress={choosePhoto} disabled={submitting}>
            <Image
              source={{ uri: image.uri }}
              style={styles.preview}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.changeBadge}>
              <Ionicons name="swap-horizontal" size={16} color={Colors.textInverse} />
              <Text style={styles.changeLabel}>Change</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            onPress={choosePhoto}
            style={({ pressed }) => [styles.picker, pressed && styles.pickerPressed]}>
            <Ionicons name="camera-outline" size={36} color={Colors.primary} />
            <Text style={styles.pickerLabel}>Add a photo of your catch</Text>
            <Text style={styles.pickerHint}>Camera or photo library</Text>
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
          disabled={!image || !profile}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
