import { describe, it, expect } from 'vitest';
import { buildFolderShareLink, parseJoinFolderId } from './share-links';

describe('Share Link Helpers', () => {
  it('builds share link correctly from custom base URL', () => {
    const link = buildFolderShareLink('folder-123', 'https://matrixrex.github.io/Talika-To-Do-List/');
    expect(link).toBe('https://matrixrex.github.io/Talika-To-Do-List/#join=folder-123');
  });

  it('handles base URL without trailing slash cleanly', () => {
    const link = buildFolderShareLink('folder-123', 'https://matrixrex.github.io/Talika-To-Do-List');
    expect(link).toBe('https://matrixrex.github.io/Talika-To-Do-List/#join=folder-123');
  });

  it('parses folderId from hash string correctly', () => {
    expect(parseJoinFolderId('#join=folder-abc')).toBe('folder-abc');
    expect(parseJoinFolderId('#join=f7b1897e-1234-4567-89ab-cdef01234567')).toBe('f7b1897e-1234-4567-89ab-cdef01234567');
    expect(parseJoinFolderId('#folder-abc')).toBeNull();
    expect(parseJoinFolderId('#')).toBeNull();
    expect(parseJoinFolderId('')).toBeNull();
  });
});
