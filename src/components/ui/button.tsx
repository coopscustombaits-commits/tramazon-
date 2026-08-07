import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

function variantPalette(
  variant: ButtonVariant,
  Colors: ThemeColors,
): { background: string; text: string; border?: string } {
  switch (variant) {
    case 'secondary':
      return { background: Colors.accent, text: Colors.textInverse };
    case 'outline':
      return {
        background: 'transparent',
        text: Colors.primary,
        border: Colors.borderStrong,
      };
    case 'ghost':
      return { background: 'transparent', text: Colors.primary };
    case 'danger':
      return { background: Colors.dangerTint, text: Colors.danger };
    default:
      return { background: Colors.primary, text: Colors.textInverse };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  style,
}: ButtonProps) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const palette = variantPalette(variant, Colors);
  const isInactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      onPress={onPress}
      disabled={isInactive}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border ?? 'transparent',
          borderWidth: palette.border ? 1 : 0,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        pressed && styles.pressed,
        isInactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={palette.text} /> : null}
          <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  base: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  inactive: {
    opacity: 0.5,
  },
}));
