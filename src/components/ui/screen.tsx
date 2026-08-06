import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Wraps content in a ScrollView. Off for screens with their own list. */
  scroll?: boolean;
  /** Lifts content above the keyboard — on for anything with a text input. */
  avoidKeyboard?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  avoidKeyboard = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  contentContainerStyle,
  style,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        padded && styles.padded,
        styles.scrollContent,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

/** Full-screen spinner, for auth restore and initial loads. */
export function ScreenLoader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {label ? <Text style={styles.loaderLabel}>{label}</Text> : null}
    </View>
  );
}

/** Consistent empty/placeholder block. */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: Spacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxl,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  loaderLabel: {
    ...Typography.caption,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.heading,
    textAlign: 'center',
  },
  emptyMessage: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
