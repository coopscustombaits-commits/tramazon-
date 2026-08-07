import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/card';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { orderStatusLabel, orderStatusTone, subscribeToOrders } from '@/lib/db/orders';
import { formatMoney } from '@/lib/shopify/client';
import { shortTimeAgo } from '@/lib/format';
import type { Order } from '@/types/models';

/**
 * Order history and status.
 *
 * The record is written when checkout opens; Shopify's webhook fills in the
 * order number, status, and tracking afterwards. Until that arrives an order
 * reads as "Order placed", which is accurate rather than optimistic.
 */
export default function OrdersScreen() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToOrders(
      user.uid,
      (next) => {
        setOrders(next);
        setLoaded(true);
      },
      (error) => {
        console.warn('[orders] subscription failed', error);
        setLoaded(true);
      },
    );
  }, [user]);

  if (!loaded) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Your Orders' }} />

      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <OrderCard order={item} />}
        ListEmptyComponent={
          <EmptyState
            title="No orders yet"
            message="Anything you buy in the shop will show up here with its status."
          />
        }
      />
    </SafeAreaView>
  );
}

function OrderCard({ order }: { order: Order }) {
  async function openStatus() {
    if (!order.statusUrl) return;
    await WebBrowser.openBrowserAsync(order.statusUrl);
  }

  const trackingUrl = order.trackingUrls[0];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.orderNumber}>
            {order.orderNumber ?? 'Order placed'}
          </Text>
          <Text style={styles.date}>{shortTimeAgo(order.createdAt)}</Text>
        </View>
        <Badge label={orderStatusLabel(order)} tone={orderStatusTone(order)} />
      </View>

      {order.lines.map((line, index) => (
        <View key={`${line.title}-${index}`} style={styles.line}>
          {line.imageUrl ? (
            <Image
              source={{ uri: line.imageUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailFallback]}>
              <Ionicons name="fish-outline" size={18} color={Colors.textFaint} />
            </View>
          )}
          <View style={styles.lineBody}>
            <Text style={styles.lineTitle} numberOfLines={2}>
              {line.title}
            </Text>
            {line.variantTitle ? (
              <Text style={styles.lineVariant}>{line.variantTitle}</Text>
            ) : null}
          </View>
          <Text style={styles.quantity}>×{line.quantity}</Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.total}>
          {formatMoney({ amount: order.totalAmount, currencyCode: order.totalCurrency })}
        </Text>

        {trackingUrl ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(trackingUrl)}
            hitSlop={8}>
            <Text style={styles.link}>Track shipment</Text>
          </Pressable>
        ) : order.statusUrl ? (
          <Pressable accessibilityRole="button" onPress={openStatus} hitSlop={8}>
            <Text style={styles.link}>Order status</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, flexGrow: 1 },
  separator: { height: Spacing.lg },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  orderNumber: { ...Typography.bodyStrong },
  date: { ...Typography.caption },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceMuted,
  },
  thumbnailFallback: { alignItems: 'center', justifyContent: 'center' },
  lineBody: { flex: 1, gap: 2 },
  lineTitle: { ...Typography.body },
  lineVariant: { ...Typography.caption },
  quantity: { ...Typography.caption, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  total: { ...Typography.heading },
  link: { ...Typography.body, color: Colors.link, fontWeight: '600' },
});
