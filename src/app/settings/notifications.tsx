import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { Card, Divider, ListRow } from '@/components/ui/card';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import {
  DEFAULT_NOTIFICATION_PREFS,
  setNotificationPref,
  subscribeToNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/db/notifications';

const SETTINGS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}[] = [
  {
    key: 'postApproved',
    label: 'Catch approved',
    description: 'When Coop approves one of your catches',
  },
  {
    key: 'postLiked',
    label: 'Likes',
    description: 'When someone likes your catch',
  },
  {
    key: 'postCommented',
    label: 'Comments',
    description: 'When someone comments on your catch',
  },
  {
    key: 'newFollower',
    label: 'New followers',
    description: 'When another angler follows you',
  },
  {
    key: 'messages',
    label: 'Messages',
    description: 'When someone sends you a direct message',
  },
  {
    key: 'announcements',
    label: 'News from Coop',
    description: 'New baits, restocks, and shop news',
  },
];

/**
 * These are checked by the Cloud Functions before anything is sent, so turning
 * one off stops the push and the in-app record together.
 */
export default function NotificationSettingsScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotificationPrefs(
      user.uid,
      setPrefs,
      (error) => {
        console.warn('[notifications] prefs failed to load', error);
        setPrefs(DEFAULT_NOTIFICATION_PREFS);
      },
    );
  }, [user]);

  async function toggle(key: keyof NotificationPrefs, enabled: boolean) {
    if (!user || !prefs) return;
    // Move the switch straight away; the subscription confirms it a moment later.
    setPrefs({ ...prefs, [key]: enabled });
    setSaving(key);
    try {
      await setNotificationPref(user.uid, key, enabled);
    } catch (error) {
      setPrefs({ ...prefs, [key]: !enabled });
      Alert.alert('Could not save', authErrorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  if (!prefs) return <ScreenLoader />;

  return (
    <Screen scroll padded={false}>
      <View style={styles.body}>
        <Card style={styles.card}>
          {SETTINGS.map((setting, index) => (
            <View key={setting.key}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                label={setting.label}
                description={setting.description}
                right={
                  <Switch
                    value={prefs[setting.key]}
                    onValueChange={(next) => void toggle(setting.key, next)}
                    disabled={saving !== null}
                    trackColor={{ true: Colors.primaryLight, false: Colors.border }}
                    thumbColor={Colors.surface}
                  />
                }
              />
            </View>
          ))}
        </Card>

        <Text style={styles.note}>
          Turning everything off here still leaves your phone&apos;s own notification
          settings in charge — if you&apos;ve blocked notifications for the app at the
          system level, nothing gets through regardless.
        </Text>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  note: {
    ...Typography.caption,
  },
}));
