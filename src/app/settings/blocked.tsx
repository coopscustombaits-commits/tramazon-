import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useBlocked } from '@/lib/db/blocked-context';

/** The list of people you've blocked, and the way back. */
export default function BlockedScreen() {
  const { blocked, unblock } = useBlocked();
  const styles = useStyles();

  function confirmUnblock(uid: string, username: string) {
    Alert.alert(`Unblock ${username}?`, 'Their catches and comments will show up again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => void unblock(uid) },
    ]);
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={blocked}
        keyExtractor={(entry) => entry.uid}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar name={item.username} size={40} />
            <Text style={styles.username}>{item.username}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${item.username}`}
              hitSlop={8}
              onPress={() => confirmUnblock(item.uid, item.username)}>
              <Text style={styles.action}>Unblock</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nobody blocked"
            message="Block someone from their profile and they'll show up here."
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, flexGrow: 1 },
  separator: { height: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  username: { ...Typography.bodyStrong, color: Colors.text, flex: 1 },
  action: { ...Typography.body, color: Colors.link, fontWeight: '600' },
}));
