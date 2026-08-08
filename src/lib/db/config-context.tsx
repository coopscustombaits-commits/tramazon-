import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_CONFIG, subscribeToRemoteConfig } from '@/lib/db/admin';
import { useAuth } from '@/lib/auth/auth-context';
import type { RemoteConfig } from '@/types/models';

const ConfigContext = createContext<RemoteConfig>(DEFAULT_CONFIG);

/**
 * Live remote config, available anywhere in the app.
 *
 * Defaults to everything-on and stays there if the read fails. That direction
 * is deliberate: a config read that errors must never be able to take the app
 * down, so the failure mode is "the app works" rather than "the app is in
 * maintenance mode".
 *
 * Only subscribed once signed in, because the rules require auth to read it.
 * That means maintenance mode can't gate the sign-in screen — worth knowing,
 * and the right trade: the alternative is a publicly readable document.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [config, setConfig] = useState<RemoteConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (status !== 'signed-in') return;
    return subscribeToRemoteConfig(setConfig);
  }, [status]);

  const value = useMemo(() => config, [config]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useRemoteConfig(): RemoteConfig {
  return useContext(ConfigContext);
}
