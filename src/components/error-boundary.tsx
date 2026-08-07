import { Ionicons } from '@expo/vector-icons';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';

/**
 * Catches render errors anywhere below it.
 *
 * Without this, one bad value — a post with a malformed image, a null where a
 * string was expected — takes the whole app to a blank white screen with no
 * way out but force-quitting. With it, the user gets a message and a working
 * "try again" button.
 *
 * Only render errors are caught. Errors thrown inside an async callback or an
 * event handler never reach a boundary; those are handled where they happen.
 */

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In development this shows up in the Metro terminal. In production this
    // is where a crash reporter would go, once there is one.
    console.error('[error-boundary]', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A class component can't call hooks, so the themed fallback lives in its
    // own function component below.
    return <ErrorScreen error={error} onRetry={this.reset} />;
  }
}

function ErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const Colors = useThemeColors();
  const styles = useStyles();

  return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning-outline" size={32} color={Colors.danger} />
          </View>

          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            That&apos;s on us, not you. Try again — if it keeps happening, let us know
            from Settings → Contact &amp; support.
          </Text>

          {__DEV__ ? (
            <View style={styles.details}>
              <Text style={styles.detailsLabel}>Development detail</Text>
              <Text style={styles.detailsText}>{error.message}</Text>
            </View>
          ) : null}

          <Button label="Try again" onPress={onRetry} />
        </ScrollView>
      </SafeAreaView>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.title,
    textAlign: 'center',
  },
  body: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  details: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  detailsLabel: {
    ...Typography.label,
  },
  detailsText: {
    ...Typography.caption,
    color: Colors.text,
    fontFamily: 'monospace',
  },
}));
