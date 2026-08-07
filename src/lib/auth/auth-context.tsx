import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateAuthProfile,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { signInWithApple as appleSignIn } from '@/lib/auth/apple';
import { signInWithGoogle as googleSignIn, signOutFromGoogle } from '@/lib/auth/google';
import {
  createUserProfile,
  deleteOwnUserData,
  isAdmin as checkIsAdmin,
  subscribeToUserProfile,
  suggestUsername,
} from '@/lib/db/users';
import { auth } from '@/lib/firebase';
import { unregisterPushToken } from '@/lib/notifications';
import type { UserProfile } from '@/types/models';

/**
 * One place that answers "who is signed in, and what do we know about them".
 *
 * There are three states the navigation cares about:
 *   loading        — still restoring the session, show a splash
 *   signed-out     — show the auth stack
 *   needs-profile  — Firebase account exists but no users/{uid} document yet
 *                    (happens after Google/Apple sign-up), show username setup
 *   signed-in      — full access
 */
export type AuthStatus = 'loading' | 'signed-out' | 'needs-profile' | 'signed-in';

/**
 * Firebase requires a recent sign-in before deleting an account. Its actual
 * window is around five minutes; stay inside it.
 */
const RECENT_LOGIN_WINDOW_MS = 4 * 60 * 1000;

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  /**
   * Name Apple/Google handed us at sign-up, used to prefill the username
   * field. Apple only ever provides this once, so we hold onto it.
   */
  suggestedUsername: string | null;

  signUpWithEmail: (input: {
    email: string;
    password: string;
    username: string;
    favoriteSpecies?: string;
  }) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  completeProfile: (input: {
    username: string;
    favoriteSpecies?: string;
    bio?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Profile state is stamped with the uid it belongs to. That way a stale
 * snapshot from a previous account can never be shown against a new one, and
 * the provider never has to reset state synchronously when the user changes.
 */
type ProfileState = {
  uid: string;
  profile: UserProfile | null;
  loaded: boolean;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: User | null; ready: boolean }>({
    user: null,
    ready: false,
  });
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [adminState, setAdminState] = useState<{ uid: string; isAdmin: boolean } | null>(
    null,
  );
  const [suggestedUsername, setSuggestedUsername] = useState<string | null>(null);

  const user = session.user;

  // Watch the Firebase session.
  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setSession({ user: nextUser, ready: true });
    });
  }, []);

  // Watch this user's profile document (and admin flag).
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const unsubscribe = subscribeToUserProfile(
      uid,
      (nextProfile) => setProfileState({ uid, profile: nextProfile, loaded: true }),
      (error) => {
        console.warn('[auth] profile subscription failed', error);
        setProfileState({ uid, profile: null, loaded: true });
      },
    );

    let cancelled = false;
    void checkIsAdmin(uid).then((result) => {
      if (!cancelled) setAdminState({ uid, isAdmin: result });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  // Only trust profile/admin state that belongs to the current user — during
  // an account switch the old values are still in state for one render.
  const currentProfileState = user && profileState?.uid === user.uid ? profileState : null;
  const profile = currentProfileState?.profile ?? null;
  const isAdmin = user && adminState?.uid === user.uid ? adminState.isAdmin : false;

  const status: AuthStatus = useMemo(() => {
    if (!session.ready) return 'loading';
    if (!user) return 'signed-out';
    if (!currentProfileState?.loaded) return 'loading';
    return profile ? 'signed-in' : 'needs-profile';
  }, [session.ready, user, currentProfileState, profile]);

  const signUpWithEmail = useCallback<AuthContextValue['signUpWithEmail']>(
    async ({ email, password, username, favoriteSpecies }) => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      // If profile creation fails (e.g. username taken between the check and
      // the write), the account still exists — `needs-profile` will catch it
      // and the user finishes setup on the next screen instead of being stuck.
      await updateAuthProfile(credential.user, { displayName: username });
      await createUserProfile(credential.user, {
        username,
        favoriteSpecies: favoriteSpecies ?? null,
      });
    },
    [],
  );

  const signInWithEmail = useCallback<AuthContextValue['signInWithEmail']>(
    async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const credential = await googleSignIn();
    setSuggestedUsername(
      suggestUsername(credential.user.displayName ?? credential.user.email),
    );
  }, []);

  const signInWithApple = useCallback(async () => {
    const { credential, fullName } = await appleSignIn();
    setSuggestedUsername(
      suggestUsername(fullName ?? credential.user.displayName ?? credential.user.email),
    );
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const completeProfile = useCallback<AuthContextValue['completeProfile']>(
    async ({ username, favoriteSpecies, bio }) => {
      const current = auth.currentUser;
      if (!current) throw new Error('You are not signed in.');
      await createUserProfile(current, {
        username,
        favoriteSpecies: favoriteSpecies ?? null,
        bio,
      });
      if (!current.displayName) {
        await updateAuthProfile(current, { displayName: username });
      }
      setSuggestedUsername(null);
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Drop this device's push token first — while we still have permission to
    // write it — so the next person to use the phone doesn't get their
    // notifications.
    const current = auth.currentUser;
    if (current) await unregisterPushToken(current.uid);
    await signOutFromGoogle();
    await firebaseSignOut(auth);
    setSuggestedUsername(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) throw new Error('You are not signed in.');

    // Firebase refuses to delete an account on a stale session. Check that
    // first: the Firestore cleanup below is irreversible, and we don't want to
    // wipe someone's profile and then fail to delete the account itself.
    const lastSignIn = current.metadata.lastSignInTime;
    const signedInRecently =
      lastSignIn !== undefined &&
      Date.now() - new Date(lastSignIn).getTime() < RECENT_LOGIN_WINDOW_MS;
    if (!signedInRecently) {
      throw new Error(
        'For security, please log out and log back in, then delete your account.',
      );
    }

    await deleteOwnUserData(current.uid);
    await signOutFromGoogle();
    await deleteUser(current);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      isAdmin,
      suggestedUsername,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendPasswordReset,
      completeProfile,
      signOut,
      deleteAccount,
    }),
    [
      status,
      user,
      profile,
      isAdmin,
      suggestedUsername,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendPasswordReset,
      completeProfile,
      signOut,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
