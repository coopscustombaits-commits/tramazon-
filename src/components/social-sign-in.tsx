import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { isAppleSignInAvailable } from '@/lib/auth/apple';
import { isGoogleSignInAvailable } from '@/lib/auth/google';

type SocialSignInProps = {
  onGoogle: () => void;
  onApple: () => void;
  busy?: 'google' | 'apple' | null;
  disabled?: boolean;
};

/**
 * Google and Apple buttons, shown only where they actually work.
 *
 * Apple's button has to follow Apple's Human Interface Guidelines, so it uses
 * their native component rather than our own `Button`.
 */
export function SocialSignIn({
  onGoogle,
  onApple,
  busy = null,
  disabled = false,
}: SocialSignInProps) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleAvailable = isGoogleSignInAvailable();

  useEffect(() => {
    let cancelled = false;
    void isAppleSignInAvailable().then((available) => {
      if (!cancelled) setAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!googleAvailable && !appleAvailable) {
    return Platform.OS === 'web' ? null : (
      <Text style={styles.unavailable}>
        Google and Apple sign-in need a development build. Use email for now — see
        docs/SETUP.md.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.separator}>
        <View style={styles.line} />
        <Text style={styles.separatorLabel}>or</Text>
        <View style={styles.line} />
      </View>

      {googleAvailable ? (
        <Button
          label="Continue with Google"
          icon="logo-google"
          variant="outline"
          onPress={onGoogle}
          loading={busy === 'google'}
          disabled={disabled}
        />
      ) : null}

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={Radius.md}
          style={styles.appleButton}
          onPress={onApple}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  separatorLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
  unavailable: {
    ...Typography.caption,
    textAlign: 'center',
  },
});
