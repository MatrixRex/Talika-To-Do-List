/**
 * Constructs a full shareable folder join link using the current window location or provided base URL.
 */
export function buildFolderShareLink(folderId: string, customBaseUrl?: string): string {
  if (customBaseUrl) {
    const base = customBaseUrl.endsWith('/') ? customBaseUrl : `${customBaseUrl}/`;
    return `${base}#join=${folderId}`;
  }
  if (typeof window === 'undefined') return `#join=${folderId}`;
  const origin = window.location.origin;
  const pathname = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return `${origin}${pathname}#join=${folderId}`;
}

/**
 * Extracts the folder ID from a hash string like `#join=<folderId>`.
 */
export function parseJoinFolderId(hash: string): string | null {
  if (!hash) return null;
  const match = hash.match(/^#join=([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : null;
}
