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

// Which useServerSidebar() caller currently owns the registration. The
// dashboard is client-only (SPA), so module state is per-tab.
let currentOwner: symbol | null = null;

export function useServerSidebar() {
  const state = useState<ServerSidebarState | null>(
    "server-sidebar",
    () => null,
  );
  // One token per caller (i.e. per page instance).
  const owner = Symbol("server-sidebar-owner");

  function register(data: ServerSidebarState) {
    currentOwner = owner;
    state.value = data;
  }

  /**
   * Clear the sidebar — but only if this caller still owns it. When
   * switching servers (or when a page is re-created), the incoming page can
   * register from cached settings before the outgoing page unmounts; an
   * unconditional clear here would wipe the new page's sidebar.
   */
  function unregister() {
    if (currentOwner !== owner) return;
    currentOwner = null;
    state.value = null;
  }

  return { state, register, unregister };
}
