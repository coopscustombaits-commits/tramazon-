import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { DEFAULT_CONFIG, saveRemoteConfig, subscribeToRemoteConfig } from '@/lib/db/admin';
import type { RemoteConfig } from '@/types/models';

/**
 * Admin-only: switches Coop can flip without shipping an app update.
 *
 * That's the whole reason this exists — an app store review takes days, so
 * anything that might need turning off in a hurry has to be a document rather
 * than a constant.
 *
 * Nothing here grants access. Permission is decided by the security rules,
 * which run on the server; these are switches for behaviour. A flag that
 * granted access would be one a modified client could simply ignore.
 */
export default function AdminConfigScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { isAdmin, status, user } = useAuth();

  const [config, setConfig] = useState<RemoteConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    // Only the first value seeds the form; later ones would fight the editor
    // while Coop is typing into it.
    let seeded = false;
    return subscribeToRemoteConfig((next) => {
      if (!seeded) {
        seeded = true;
        setConfig(next);
      }
    });
  }, [isAdmin]);

  function set<K extends keyof RemoteConfig>(key: K, value: RemoteConfig[K]) {
    setConfig((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!config || !user) return;
    setSaving(true);
    try {
      await saveRemoteConfig(user.uid, {
        maintenanceMode: config.maintenanceMode,
        maintenanceMessage: config.maintenanceMessage,
        announcementBanner: config.announcementBanner,
        postingEnabled: config.postingEnabled,
        messagingEnabled: config.messagingEnabled,
      });
      Alert.alert('Saved', 'Every app picks this up within a few seconds.');
    } catch (error) {
      Alert.alert('Could not save', authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin || !config) return <ScreenLoader />;

  return (
    <Screen scroll>
      <Text style={styles.intro}>
        These take effect within seconds, on every phone, without an app update. Use them
        when something needs stopping faster than a store review takes.
      </Text>

      <Toggle
        label="Maintenance mode"
        hint="Shows the message below instead of the app. Use it if something is badly broken."
        value={config.maintenanceMode}
        onValueChange={(value) => set('maintenanceMode', value)}
        disabled={saving}
        tone="danger"
      />

      {config.maintenanceMode ? (
        <TextField
          label="Maintenance message"
          value={config.maintenanceMessage}
          onChangeText={(value) => set('maintenanceMessage', value)}
          placeholder="Back shortly — fixing something."
          multiline
          maxLength={300}
          editable={!saving}
        />
      ) : null}

      <Toggle
        label="Posting enabled"
        hint="Turning this off pauses new catches for everyone, without banning anyone."
        value={config.postingEnabled}
        onValueChange={(value) => set('postingEnabled', value)}
        disabled={saving}
      />

      <Toggle
        label="Messaging enabled"
        hint="Turning this off pauses direct messages. Existing threads stay readable."
        value={config.messagingEnabled}
        onValueChange={(value) => set('messagingEnabled', value)}
        disabled={saving}
      />

      <TextField
        label="Banner on the feed (optional)"
        value={config.announcementBanner}
        onChangeText={(value) => set('announcementBanner', value)}
        placeholder="Restock Friday — new Deep Divers"
        multiline
        maxLength={200}
        editable={!saving}
      />

      <Button label="Save" onPress={() => void save()} loading={saving} />

      <View style={styles.warning}>
        <Text style={styles.warningText}>
          These switches change what the app does, not who can do what. Suspensions,
          bans, and every other permission are enforced by the security rules on the
          server, where a modified app can&apos;t reach them.
        </Text>
      </View>

      <Button
        label="Reset to defaults"
        variant="ghost"
        disabled={saving}
        onPress={() =>
          Alert.alert('Reset everything?', 'Turns maintenance off and clears the banner.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reset',
              onPress: () => setConfig({ ...DEFAULT_CONFIG }),
            },
          ])
        }
      />
      <Text style={styles.hint}>Reset fills the form — you still have to save it.</Text>
    </Screen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onValueChange,
  disabled,
  tone = 'normal',
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  tone?: 'normal' | 'danger';
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const on = tone === 'danger' ? Colors.danger : Colors.primary;

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: on, false: Colors.border }}
      />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  intro: { ...Typography.body, color: Colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...Typography.bodyStrong, color: Colors.text },
  rowHint: { ...Typography.caption, color: Colors.textMuted },
  warning: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
  },
  warningText: { ...Typography.caption, color: Colors.textMuted },
  hint: { ...Typography.caption, color: Colors.textFaint, textAlign: 'center' },
}));
