import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ImageStyle } from 'expo-image';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { PostMedia } from '@/types/models';

/**
 * A catch photo, or a catch video.
 *
 * Video starts as its poster frame with a play button rather than
 * autoplaying — a feed of clips all playing at once is unusable, and it burns
 * through data on a boat with one bar of signal.
 */
export function PostMediaView({
  media,
  style,
  /** Muted autoplay-on-tap; off in lists where only a preview is wanted. */
  playable = true,
}: {
  media: PostMedia;
  style?: StyleProp<ViewStyle>;
  playable?: boolean;
}) {
  const aspectRatio =
    media.width && media.height
      ? Math.min(Math.max(media.width / media.height, 0.6), 1.6)
      : 1;

  if (media.kind === 'photo') {
    return (
      <Image
        source={{ uri: media.url }}
        style={[styles.media, { aspectRatio }, style as StyleProp<ImageStyle>]}
        contentFit="cover"
        transition={200}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return <PostVideo media={media} aspectRatio={aspectRatio} playable={playable} style={style} />;
}

function PostVideo({
  media,
  aspectRatio,
  playable,
  style,
}: {
  media: PostMedia;
  aspectRatio: number;
  playable: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [started, setStarted] = useState(false);

  const player = useVideoPlayer(media.url, (instance) => {
    instance.loop = true;
    // Sound off by default — nobody wants a feed shouting at them.
    instance.muted = true;
  });

  // Until it's played once, show the poster frame. Mounting the video view
  // for every item in a list would spin up a decoder per row.
  if (!started) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play video"
        onPress={
          playable
            ? () => {
                setStarted(true);
                player.play();
              }
            : undefined
        }
        style={[styles.media, { aspectRatio }, styles.poster, style]}>
        {media.thumbnailUrl ? (
          <Image
            source={{ uri: media.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <View style={styles.playButton}>
          <Ionicons name="play" size={26} color={Colors.textInverse} />
        </View>

        {media.durationMs ? (
          <View style={styles.duration}>
            <Text style={styles.durationLabel}>{formatDuration(media.durationMs)}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <VideoView
      player={player}
      style={StyleSheet.flatten([styles.media, { aspectRatio }, style])}
      contentFit="cover"
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

/** 95000 -> "1:35" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  media: {
    width: '100%',
    backgroundColor: Colors.surfaceMuted,
  },
  poster: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  duration: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.overlay,
  },
  durationLabel: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
});
