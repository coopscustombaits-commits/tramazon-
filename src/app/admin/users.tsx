import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { accountStatusLabel, setAccountStatus } from '@/lib/db/admin';
import { adjustPoints } from '@/lib/db/rewards';
import { searchUsers } from '@/lib/db/users';
import type { AccountStatus, UserProfile } from '@/types/models';

const DEBOUNCE_MS = 350;

/** A temporary suspension in days, and the indefinite option. */
const SUSPENSIONS = [
  { label: '1 day', days: 1 },
  { label: '1 week', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'Indefinite', days: null },
];

/**
 * Admin-only: find an angler and act on them.
 *
 * Search only — no "all users" list. Firestore has no way to browse a
 * collection cheaply, and a list of everyone isn't what moderation actually
 * needs: you come here because of a name in a report.
 */
export default function AdminUsersScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { isAdmin, status, user } = useAuth();

  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<{ key: string; users: UserProfile[] } | null>(
    null,
  );
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Results carry the query that produced them, so "still searching" is
  // derived and a slow response for an old term can't overwrite a new one.
  const queryKey = term.length >= 2 ? term : '';
  const current = results?.key === queryKey ? results : null;
  const searching = queryKey !== '' && current === null;

  useEffect(() => {
    if (!queryKey || !isAdmin) return;
    let cancelled = false;
    searchUsers(queryKey)
      .then((found) => {
        if (!cancelled) setResults({ key: queryKey, users: found });
      })
      .catch((error: unknown) => {
        console.warn('[admin/users] search failed', error);
        if (!cancelled) setResults({ key: queryKey, users: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, isAdmin]);

  async function changeStatus(next: AccountStatus, days: number | null = null) {
    if (!selected) return;
    setBusy(true);
    try {
      const until =
        next === 'suspended' && days !== null
          ? new Date(Date.now() + days * 86_400_000)
          : null;
      await setAccountStatus(selected.uid, next, until);
      // Reflect it locally — the search results aren't a live subscription.
      setSelected({ ...selected, accountStatus: next });
      setResults((currentResults) =>
        currentResults
          ? {
              ...currentResults,
              users: currentResults.users.map((entry) =>
                entry.uid === selected.uid ? { ...entry, accountStatus: next } : entry,
              ),
            }
          : currentResults,
      );
    } catch (error) {
      Alert.alert('Could not change the account', authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function confirmSuspend() {
    Alert.alert(
      `Suspend ${selected?.username}?`,
      'They can still sign in and read, but cannot post, comment, like, follow, message, or review until it lifts.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...SUSPENSIONS.map((option) => ({
          text: option.label,
          onPress: () => void changeStatus('suspended', option.days),
        })),
      ],
    );
  }

  function confirmBan() {
    Alert.alert(
      `Ban ${selected?.username}?`,
      'Permanent until you reinstate them. Their existing catches stay up — delete those separately if they need to go.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Ban', style: 'destructive', onPress: () => void changeStatus('banned') },
      ],
    );
  }

  function grantPoints() {
    if (!selected || !user) return;
    Alert.alert('Adjust points', 'Add points to this angler.', [
      { text: 'Cancel', style: 'cancel' },
      ...[25, 50, 100].map((amount) => ({
        text: `+${amount}`,
        onPress: () => {
          void adjustPoints(selected.uid, amount, 'Manual adjustment').catch(
            (error: unknown) => Alert.alert('Could not adjust', authErrorMessage(error)),
          );
        },
      })),
    ]);
  }

  if (!isAdmin) return <ScreenLoader />;

  const empty =
    term.length < 2
      ? { title: 'Find an angler', message: 'Type the start of a username.' }
      : searching
        ? null
        : { title: 'Nobody found', message: `No angler whose name starts with "${term}".` };

  return (
    <Screen padded={false}>
      <View style={styles.searchRow}>
        <TextField
          label="Find an angler"
          value={input}
          onChangeText={setInput}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>

      <FlatList
        data={current?.users ?? []}
        keyExtractor={(angler) => angler.uid}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${item.username}`}
            onPress={() => setSelected(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Avatar uri={item.photoURL} name={item.username} size={40} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.username}</Text>
              <Text style={styles.meta}>
                {item.postCount} catches · {item.points ?? 0} pts
              </Text>
            </View>
            {item.accountStatus !== 'active' ? (
              <View style={styles.statusPill}>
                <Text style={styles.statusLabel}>
                  {accountStatusLabel(item.accountStatus)}
                </Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
          </Pressable>
        )}
        ListEmptyComponent={empty ? <EmptyState {...empty} /> : null}
      />

      <Modal
        visible={selected !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => setSelected(null)}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {selected ? (
              <>
                <View style={styles.sheetHeader}>
                  <Avatar uri={selected.photoURL} name={selected.username} size={56} />
                  <View style={styles.sheetIdentity}>
                    <Text style={styles.sheetName}>{selected.username}</Text>
                    <Text style={styles.meta}>
                      {accountStatusLabel(selected.accountStatus)} ·{' '}
                      {selected.postCount} catches · {selected.points ?? 0} pts
                    </Text>
                  </View>
                </View>

                {selected.bio ? <Text style={styles.bio}>{selected.bio}</Text> : null}

                <Button
                  label="View their profile"
                  variant="outline"
                  icon="person-outline"
                  disabled={busy}
                  onPress={() => {
                    const uid = selected.uid;
                    setSelected(null);
                    router.push(`/user/${uid}`);
                  }}
                />

                {selected.accountStatus === 'active' ? (
                  <>
                    <Button
                      label="Suspend"
                      variant="outline"
                      icon="pause-circle-outline"
                      disabled={busy}
                      onPress={confirmSuspend}
                    />
                    <Button
                      label="Ban"
                      variant="danger"
                      icon="ban-outline"
                      disabled={busy}
                      onPress={confirmBan}
                    />
                  </>
                ) : (
                  <Button
                    label="Reinstate"
                    icon="checkmark-circle-outline"
                    disabled={busy}
                    onPress={() => void changeStatus('active')}
                  />
                )}

                <Button
                  label="Adjust points"
                  variant="ghost"
                  icon="star-outline"
                  disabled={busy}
                  onPress={grantPoints}
                />

                <Text style={styles.sheetNote}>
                  Suspending and banning are enforced by the security rules, not by this
                  screen — a modified app can&apos;t work around either. Points
                  adjustments go on their ledger as adjustments, so the total stays
                  explainable.
                </Text>

                <Button label="Close" variant="ghost" onPress={() => setSelected(null)} />
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  searchRow: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: { height: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowPressed: { opacity: 0.85 },
  rowBody: { flex: 1, gap: 2 },
  name: { ...Typography.bodyStrong, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textMuted },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dangerTint,
  },
  statusLabel: { ...Typography.caption, color: Colors.danger, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
  },
  sheetBody: { padding: Spacing.lg, gap: Spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sheetIdentity: { flex: 1, gap: 2 },
  sheetName: { ...Typography.heading, color: Colors.text },
  bio: { ...Typography.body, color: Colors.textMuted },
  sheetNote: { ...Typography.caption, color: Colors.textFaint },
}));
