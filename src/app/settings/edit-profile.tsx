import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { storagePaths } from '@/lib/db/paths';
import { changeUsername, updateUserProfile, validateUsername } from '@/lib/db/users';
import { mediaFileName, uploadFile } from '@/lib/storage/media';

const BIO_MAX = 200;

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [favoriteSpecies, setFavoriteSpecies] = useState(profile?.favoriteSpecies ?? '');
  /** Local URI of a newly picked photo, before it is uploaded. */
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!profile || !user) {
    return <ScreenLoader />;
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access in your device settings to change your profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingPhoto(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!profile || !user) return;

    const trimmedUsername = username.trim();
    const usernameError = validateUsername(trimmedUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let photoURL = profile.photoURL;
      if (pendingPhoto) {
        const uploaded = await uploadFile(
          pendingPhoto,
          storagePaths.avatar(user.uid, mediaFileName(pendingPhoto, 'avatar')),
        );
        photoURL = uploaded.url;
      }

      if (trimmedUsername !== profile.username) {
        // Handles both a real rename and a capitalization change; the
        // transaction inside keeps the `usernames` reservation in sync.
        await changeUsername(user.uid, trimmedUsername);
      }

      await updateUserProfile(user.uid, {
        bio: bio.trim(),
        favoriteSpecies: favoriteSpecies.trim() || null,
        photoURL,
      });

      router.back();
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <View style={styles.form}>
        <View style={styles.photoSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={pickPhoto}
            style={({ pressed }) => pressed && styles.pressed}>
            <Avatar uri={pendingPhoto ?? profile.photoURL} name={profile.username} size={96} />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color={Colors.textInverse} />
            </View>
          </Pressable>
          <Text style={styles.photoHint}>Tap to change your photo</Text>
        </View>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />

        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Where you fish, what you throw..."
          multiline
          maxLength={BIO_MAX}
          style={styles.bioInput}
          hint={`${bio.length}/${BIO_MAX}`}
        />

        <TextField
          label="Favorite species"
          value={favoriteSpecies}
          onChangeText={setFavoriteSpecies}
          placeholder="Largemouth bass"
          autoCapitalize="words"
          error={error}
        />

        <Button label="Save changes" onPress={handleSave} loading={saving} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => router.back()}
          disabled={saving}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  photoSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  photoHint: {
    ...Typography.caption,
  },
  bioInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  pressed: {
    opacity: 0.8,
  },
});
