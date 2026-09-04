import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveCachedAuthUser,
  getCachedAuthUser,
  saveCachedUserProfile,
  getCachedUserProfile,
  clearCachedAuth,
  hasCachedAuthSession,
  getEffectiveUserId,
  syncUserProfile,
} from './auth';
import type { User } from './schema';
import { Timestamp } from 'firebase/firestore';

describe('Offline Auth & Silent Login Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('saves and retrieves cached auth user synchronously from localStorage', () => {
    expect(hasCachedAuthSession()).toBe(false);
    expect(getCachedAuthUser()).toBeNull();

    const mockUser = {
      uid: 'test-uid-123',
      email: 'user@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/avatar.png',
    };

    saveCachedAuthUser(mockUser);

    expect(hasCachedAuthSession()).toBe(true);
    const retrieved = getCachedAuthUser();
    expect(retrieved).toEqual(mockUser);
  });

  it('saves and retrieves cached user profile with preferences synchronously', () => {
    const mockProfile: User = {
      uid: 'test-uid-123',
      email: 'user@example.com',
      displayName: 'Test User',
      photoURL: null,
      createdAt: Timestamp.now(),
      schemaVersion: 1,
      prefs: {
        hideCompletedTasks: true,
        hideCompletedSubtasks: false,
        rememberLastFolder: true,
        reduceAnimations: false,
        fastMode: true,
      },
    };

    saveCachedUserProfile(mockProfile);

    const cached = getCachedUserProfile();
    expect(cached).not.toBeNull();
    expect(cached?.uid).toBe('test-uid-123');
    expect(cached?.prefs.fastMode).toBe(true);
    expect(cached?.prefs.hideCompletedTasks).toBe(true);
  });

  it('clears all cached auth credentials upon clearCachedAuth', () => {
    saveCachedAuthUser({
      uid: 'test-uid-123',
      email: 'user@example.com',
      displayName: 'Test User',
      photoURL: null,
    });
    saveCachedUserProfile({
      uid: 'test-uid-123',
      email: 'user@example.com',
      displayName: 'Test User',
      photoURL: null,
      createdAt: Timestamp.now(),
      schemaVersion: 1,
      prefs: {
        hideCompletedTasks: false,
        hideCompletedSubtasks: false,
        rememberLastFolder: false,
      },
    });

    expect(hasCachedAuthSession()).toBe(true);
    clearCachedAuth();
    expect(hasCachedAuthSession()).toBe(false);
    expect(getCachedAuthUser()).toBeNull();
    expect(getCachedUserProfile()).toBeNull();
  });

  it('provides effective user ID from cache when auth.currentUser is not yet loaded', () => {
    // When offline cold start occurs, auth.currentUser is null initially
    expect(getEffectiveUserId()).toBe('');

    saveCachedAuthUser({
      uid: 'persisted-uid-999',
      email: 'offline@talika.app',
      displayName: 'Offline Person',
      photoURL: null,
    });

    expect(getEffectiveUserId()).toBe('persisted-uid-999');
  });

  it('syncUserProfile falls back to local storage profile when offline or Firestore is unreachable', async () => {
    const mockProfile: User = {
      uid: 'offline-user-1',
      email: 'offline@talika.app',
      displayName: 'Offline Person',
      photoURL: null,
      createdAt: Timestamp.now(),
      schemaVersion: 1,
      prefs: {
        hideCompletedTasks: false,
        hideCompletedSubtasks: false,
        rememberLastFolder: false,
        fastMode: true,
      },
    };
    saveCachedUserProfile(mockProfile);

    // Mock firebaseUser input
    const firebaseUserStub = {
      uid: 'offline-user-1',
      email: 'offline@talika.app',
      displayName: 'Offline Person',
      photoURL: null,
    } as unknown as Parameters<typeof syncUserProfile>[0];

    const profile = await syncUserProfile(firebaseUserStub);
    expect(profile.uid).toBe('offline-user-1');
    expect(profile.prefs.fastMode).toBe(true);
  });
});

describe('Service Worker Strategy Rules', () => {
  it('identifies URLs that should bypass service worker cache', () => {
    const shouldBypass = (url: string, method: string) => {
      if (method !== 'GET') return true;
      if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) return true;
      if (url.includes('googleapis.com') || url.includes('firebaseio.com')) return true;
      return false;
    };

    expect(shouldBypass('https://firestore.googleapis.com/v1/projects/...', 'GET')).toBe(true);
    expect(shouldBypass('https://identitytoolkit.googleapis.com/v1/accounts:...', 'POST')).toBe(true);
    expect(shouldBypass('https://talika.app/api/data', 'POST')).toBe(true);
    expect(shouldBypass('chrome-extension://abc/background.js', 'GET')).toBe(true);
    expect(shouldBypass('https://talika.app/assets/index-123.js', 'GET')).toBe(false);
    expect(shouldBypass('https://talika.app/', 'GET')).toBe(false);
  });
});
