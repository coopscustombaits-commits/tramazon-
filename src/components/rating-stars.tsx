import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { RATING_MAX } from '@/lib/db/reviews';

/**
 * A star rating — read-only by default, tappable when `onChange` is given.
 *
 * Half stars are shown for averages (4.5 reads as four filled and one half)
 * but can't be picked: a rating is an integer, and offering halves in the
 * picker would mean a scale the aggregate can't represent.
 */
export function RatingStars({
  value,
  size = 18,
  onChange,
  label,
}: {
  value: number;
  size?: number;
  onChange?: (rating: number) => void;
  /** Accessibility label for the whole control when it's interactive. */
  label?: string;
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const stars = Array.from({ length: RATING_MAX }, (_, index) => index + 1);

  if (!onChange) {
    return (
      <View
        style={styles.row}
        accessibilityRole="image"
        accessibilityLabel={`${value.toFixed(1)} out of ${RATING_MAX} stars`}>
        {stars.map((star) => (
          <Ionicons
            key={star}
            name={value >= star ? 'star' : value >= star - 0.5 ? 'star-half' : 'star-outline'}
            size={size}
            color={Colors.accent}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityLabel={label}>
      {stars.map((star) => (
        <Pressable
          key={star}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === star }}
          accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
          hitSlop={4}
          onPress={() => onChange(star)}>
          <Ionicons
            name={value >= star ? 'star' : 'star-outline'}
            size={size}
            color={Colors.accent}
          />
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', gap: 2, alignItems: 'center' },
}));
