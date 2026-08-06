import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

type ListRowProps = {
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  /** Renders the label in the danger color, for destructive rows. */
  destructive?: boolean;
  right?: ReactNode;
};

/** A tappable settings-style row. */
export function ListRow({
  label,
  description,
  icon,
  onPress,
  destructive = false,
  right,
}: ListRowProps) {
  const color = destructive ? Colors.danger : Colors.text;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? Colors.danger : Colors.primary}
        />
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
        ) : null)}
    </Pressable>
  );
}

/** Small colored pill, e.g. post status. */
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'pending' | 'approved' | 'rejected';
}) {
  const tones = {
    neutral: { background: Colors.surfaceMuted, text: Colors.textMuted },
    pending: { background: Colors.warningTint, text: Colors.warning },
    approved: { background: Colors.successTint, text: Colors.success },
    rejected: { background: Colors.dangerTint, text: Colors.danger },
  } as const;
  const palette = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeLabel, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  sectionHeader: {
    ...Typography.label,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  rowPressed: {
    backgroundColor: Colors.primaryTint,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...Typography.body,
    fontWeight: '500',
  },
  rowDescription: {
    ...Typography.caption,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
