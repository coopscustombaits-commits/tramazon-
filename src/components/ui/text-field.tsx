import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Shown in red under the field. */
  error?: string | null;
  /** Shown in grey under the field when there is no error. */
  hint?: string;
  /** Adds a show/hide toggle and turns on secure entry. */
  secure?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, secure = false, style, ...inputProps },
  ref,
) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          Boolean(error) && styles.inputWrapperError,
        ]}>
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={Colors.textFaint}
          secureTextEntry={secure && !revealed}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          {...inputProps}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setRevealed((value) => !value)}
            style={styles.reveal}>
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((Colors) => ({
  container: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
  },
  inputWrapperError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  reveal: {
    paddingLeft: Spacing.sm,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
  },
  hint: {
    ...Typography.caption,
  },
}));
