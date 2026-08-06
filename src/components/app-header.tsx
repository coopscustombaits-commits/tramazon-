import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';

type AppHeaderProps = {
  title: string;
  action?: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  };
};

/** Lightweight in-screen header for the tab screens, which hide the nav bar. */
export function AppHeader({ title, action }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          onPress={action.onPress}
          style={({ pressed }) => pressed && styles.pressed}>
          <Ionicons name={action.icon} size={24} color={Colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.6,
  },
});
