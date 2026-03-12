// src/shared/__tests__/ui-store.test.ts — UI Store Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import type { StoreApi } from 'zustand/vanilla';
import { createUIStore } from '../stores/ui-store.js';
import type { UIStore } from '../stores/ui-store.js';

describe('uiStore', () => {
  let store: StoreApi<UIStore>;

  beforeEach(() => {
    store = createUIStore();
  });

  it('has correct initial state', () => {
    const state = store.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.drawerOpen).toBe(false);
    expect(state.commandPaletteOpen).toBe(false);
    expect(state.activeView).toBe('chat');
  });

  describe('toggleSidebar', () => {
    it('toggles sidebar open/closed', () => {
      store.getState().toggleSidebar();
      expect(store.getState().sidebarOpen).toBe(false);

      store.getState().toggleSidebar();
      expect(store.getState().sidebarOpen).toBe(true);
    });
  });

  describe('openSidebar / closeSidebar', () => {
    it('opens and closes sidebar explicitly', () => {
      store.getState().closeSidebar();
      expect(store.getState().sidebarOpen).toBe(false);

      store.getState().openSidebar();
      expect(store.getState().sidebarOpen).toBe(true);
    });
  });

  describe('toggleDrawer', () => {
    it('toggles drawer open/closed', () => {
      store.getState().toggleDrawer();
      expect(store.getState().drawerOpen).toBe(true);

      store.getState().toggleDrawer();
      expect(store.getState().drawerOpen).toBe(false);
    });
  });

  describe('openDrawer / closeDrawer', () => {
    it('opens and closes drawer explicitly', () => {
      store.getState().openDrawer();
      expect(store.getState().drawerOpen).toBe(true);

      store.getState().closeDrawer();
      expect(store.getState().drawerOpen).toBe(false);
    });
  });

  describe('toggleCommandPalette', () => {
    it('toggles command palette open/closed', () => {
      store.getState().toggleCommandPalette();
      expect(store.getState().commandPaletteOpen).toBe(true);

      store.getState().toggleCommandPalette();
      expect(store.getState().commandPaletteOpen).toBe(false);
    });
  });

  describe('openCommandPalette / closeCommandPalette', () => {
    it('opens and closes command palette explicitly', () => {
      store.getState().openCommandPalette();
      expect(store.getState().commandPaletteOpen).toBe(true);

      store.getState().closeCommandPalette();
      expect(store.getState().commandPaletteOpen).toBe(false);
    });
  });

  describe('setActiveView', () => {
    it('sets the active view', () => {
      store.getState().setActiveView('sessions');
      expect(store.getState().activeView).toBe('sessions');

      store.getState().setActiveView('settings');
      expect(store.getState().activeView).toBe('settings');

      store.getState().setActiveView('chat');
      expect(store.getState().activeView).toBe('chat');
    });
  });
});
