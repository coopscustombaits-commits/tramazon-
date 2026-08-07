import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';

export type HeaderAction = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Shows a count bubble on the icon. Zero or undefined hides it. */
  badge?: number;
};

type AppHeaderProps = {
  title: string;
  /** Right-aligned icon buttons, in order. */
  actions?: HeaderAction[];
};

/** Lightweight in-screen header for the tab screens, which hide the nav bar. */
export function AppHeader({ title, actions = [] }: AppHeaderProps) {
  const Colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={8}
            onPress={action.onPress}
            style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons name={action.icon} size={24} color={Colors.primary} />
            {action.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>
                  {action.badge > 9 ? '9+' : action.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.title,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  pressed: {
    opacity: 0.6,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
}));
