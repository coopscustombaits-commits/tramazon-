import { Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ABOUT_CONTENT } from '@/constants/content';
import { Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';

export default function AboutScreen() {
  const styles = useStyles();
  return (
    <Screen scroll>
      <View style={styles.container}>
        <Text style={styles.brand}>COOP&apos;S CUSTOM BAITS</Text>
        <Text style={styles.headline}>{ABOUT_CONTENT.headline}</Text>

        <Card style={styles.card}>
          {ABOUT_CONTENT.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </Card>

        <Text style={styles.footer}>
          Making baits since {ABOUT_CONTENT.foundedYear}.
        </Text>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  container: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  brand: {
    ...Typography.label,
    color: Colors.accent,
    letterSpacing: 2,
  },
  headline: {
    ...Typography.title,
  },
  card: {
    gap: Spacing.lg,
  },
  paragraph: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  footer: {
    ...Typography.caption,
    textAlign: 'center',
  },
}));
