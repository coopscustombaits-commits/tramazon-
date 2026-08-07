import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useTheme, type ThemePreference } from '@/constants/theme-context';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Automatic', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/**
 * Light / dark / follow-the-phone.
 *
 * "Automatic" is the default and first option — most people set this once at
 * the OS level and expect apps to respect it.
 */
export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label} theme`}
            onPress={() => setPreference(option.value)}
            style={[styles.option, active && styles.optionActive]}>
            <Ionicons
              name={option.icon}
              size={20}
              style={[styles.icon, active && styles.iconActive]}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  icon: {
    color: Colors.textMuted,
  },
  iconActive: {
    color: Colors.primary,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
}));
