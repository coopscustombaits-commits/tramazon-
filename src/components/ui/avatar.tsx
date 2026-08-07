import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { makeStyles } from '@/constants/theme-context';



type AvatarProps = {
  uri?: string | null;
  /** Used for the fallback initial. */
  name?: string | null;
  size?: number;
};

export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const styles = useStyles();
  const dimensions = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, dimensions]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.fallback, dimensions]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  image: {
    backgroundColor: Colors.surfaceMuted,
  },
  fallback: {
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: Colors.primary,
    fontWeight: '700',
  },
}));
