// src/web/app.tsx — App Shell with Responsive Layout
import { useEffect } from 'react';
import { WsProvider, useWs } from './providers/ws-provider.js';
import { useWsDispatcher } from '../shared/ws-client/use-ws-dispatcher.js';
import { BottomNav } from './components/bottom-nav.js';
import { SessionDrawer } from './components/session-drawer.js';
import { SessionPanel } from './components/session-panel.js';
import { ChatPanel } from './components/chat-panel.js';
import { StatusBar } from './components/status-bar.js';
import { uiStore, chatStore, runStore, useUIStore } from './stores.js';
import { PanelLeft } from 'lucide-react';

/** Bridges WsProvider events to shared Zustand stores */
function WsDispatcherBridge() {
  const { lastMessage } = useWs();
  const stores = {
    chatStore: chatStore.getState(),
    runStore: runStore.getState(),
  };

  useWsDispatcher(lastMessage, stores);

  return null;
}

function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border-subtle bg-background-deep transition-all duration-normal overflow-hidden ${
        sidebarOpen
          ? 'md:w-[200px] lg:w-[280px] xl:w-[320px]'
          : 'md:w-0'
      }`}
    >
      <div className="flex items-center justify-end px-2 h-10 border-b border-border-subtle shrink-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="text-foreground-muted hover:text-foreground transition-colors p-1"
        >
          <PanelLeft size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <SessionPanel />
      </div>
    </aside>
  );
}

function MainContent() {
  const activeView = useUIStore((s) => s.activeView);

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full">
      {activeView === 'chat' && <ChatPanel />}
      {activeView === 'sessions' && (
        <div className="flex-1 min-h-0">
          <SessionPanel />
        </div>
      )}
      {activeView === 'settings' && (
        <div className="flex-1 flex items-center justify-center text-foreground-muted font-sans text-sm">
          Settings view
        </div>
      )}
    </main>
  );
}

function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  // Close drawer when switching away from mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches && drawerOpen) closeDrawer();
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [drawerOpen, closeDrawer]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center h-12 px-4 border-b border-border-subtle bg-background-deep shrink-0">
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth < 768) {
              if (drawerOpen) closeDrawer();
              else uiStore.getState().openDrawer();
            } else {
              toggleSidebar();
            }
          }}
          className={`mr-3 text-foreground-muted hover:text-foreground transition-colors p-1 ${
            sidebarOpen ? 'md:hidden' : ''
          }`}
        >
          <PanelLeft size={18} />
        </button>

        <h1 className="text-sm font-mono font-semibold text-primary">
          Workbench
        </h1>
      </header>

      {/* Body: Sidebar + Main */}
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <MainContent />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Mobile Bottom Nav */}
      <BottomNav activeView={activeView} onViewChange={setActiveView} />

      {/* Mobile Session Drawer */}
      <SessionDrawer open={drawerOpen} onClose={closeDrawer}>
        <SessionPanel />
      </SessionDrawer>

      {/* Bottom nav spacer for mobile */}
      <div
        className="md:hidden shrink-0"
        style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      />
    </div>
  );
}

export function App() {
  return (
    <WsProvider>
      <WsDispatcherBridge />
      <AppShell />
    </WsProvider>
  );
}
