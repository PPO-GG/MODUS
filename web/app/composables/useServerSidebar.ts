export interface ServerSidebarTab {
  id: string;
  label: string;
  icon: string;
  to?: string;
  badge?: string;
  disabled?: boolean;
  action?: () => void;
  separator?: boolean;
  groupLabel?: string;
}

export interface ServerSidebarState {
  guild: any;
  tabs: ServerSidebarTab[];
  activeTab: string;
}

export function useServerSidebar() {
  const state = useState<ServerSidebarState | null>(
    "server-sidebar",
    () => null,
  );

  function register(data: ServerSidebarState) {
    state.value = data;
  }

  /**
   * Clear the sidebar — but only if it still belongs to `ownerId`. When
   * switching servers, the incoming page can register (from cached
   * settings) before the outgoing page unmounts; an unconditional clear
   * here would wipe the new server's sidebar.
   */
  function unregister(ownerId?: string) {
    if (ownerId && state.value?.guild?.id !== ownerId) return;
    state.value = null;
  }

  return { state, register, unregister };
}
