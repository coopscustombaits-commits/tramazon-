import * as MailComposer from 'expo-mail-composer';
import { Alert, Linking, Text, View } from 'react-native';

import { Card, Divider, ListRow } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { CONTACT_CONTENT } from '@/constants/content';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';

export default function ContactScreen() {
  const styles = useStyles();
  const { profile, user } = useAuth();

  async function emailSupport() {
    // Include who is asking so Coop doesn't have to play detective.
    const signature = profile
      ? `\n\n---\nFrom: ${profile.username}${user?.email ? ` (${user.email})` : ''}`
      : '';

    const available = await MailComposer.isAvailableAsync();
    if (available) {
      await MailComposer.composeAsync({
        recipients: [CONTACT_CONTENT.supportEmail],
        subject: "Coop's Custom Baits app — support",
        body: signature,
      });
      return;
    }

    // No mail app configured — fall back to the system mailto handler.
    const url = `mailto:${CONTACT_CONTENT.supportEmail}?subject=${encodeURIComponent(
      "Coop's Custom Baits app — support",
    )}&body=${encodeURIComponent(signature)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('No email app found', `Write to us at ${CONTACT_CONTENT.supportEmail}`);
    }
  }

  const links = [
    { key: 'website', label: 'Website', value: CONTACT_CONTENT.website, icon: 'globe-outline' },
    {
      key: 'instagram',
      label: 'Instagram',
      value: CONTACT_CONTENT.instagram,
      icon: 'logo-instagram',
    },
    {
      key: 'facebook',
      label: 'Facebook',
      value: CONTACT_CONTENT.facebook,
      icon: 'logo-facebook',
    },
  ] as const;

  const visibleLinks = links.filter((link) => link.value.length > 0);

  return (
    <Screen scroll>
      <View style={styles.container}>
        <Text style={styles.headline}>Get in touch</Text>
        <Text style={styles.body}>
          Questions about an order, a bait, or the app itself — send it our way.{' '}
          {CONTACT_CONTENT.responseTime}
        </Text>

        <Card style={styles.card}>
          <ListRow
            label="Email support"
            description={CONTACT_CONTENT.supportEmail}
            icon="mail-outline"
            onPress={emailSupport}
          />
          {visibleLinks.map((link) => (
            <View key={link.key}>
              <Divider />
              <ListRow
                label={link.label}
                description={link.value}
                icon={link.icon}
                onPress={() => Linking.openURL(link.value)}
              />
            </View>
          ))}
        </Card>

        <Text style={styles.note}>
          Order and shipping questions are handled through the Shopify store, so include
          your order number if you have one.
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
  headline: {
    ...Typography.title,
  },
  body: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  note: {
    ...Typography.caption,
  },
}));
