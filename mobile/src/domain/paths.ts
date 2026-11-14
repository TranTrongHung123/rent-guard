import type { LocalPage, SavedAnalysis } from '../types';

const MANAGED_DIRECTORY = 'rentguard-pages';
const SAFE_FILENAME = '[A-Za-z0-9_-]+\\.jpg';
const RELATIVE_IMAGE = new RegExp(`^${MANAGED_DIRECTORY}/(${SAFE_FILENAME})$`);
const ABSOLUTE_IMAGE = new RegExp(`/(${MANAGED_DIRECTORY})/(${SAFE_FILENAME})$`);

function safeFileUri(uri: string): URL | null {
  if (!uri.startsWith('file:///') || /[?#\\]/u.test(uri)) return null;
  // Check the original segments before URL parsing can normalize away traversal.
  try {
    if (uri.split('/').some(segment => {
      const decoded = decodeURIComponent(segment);
      return decoded === '.' || decoded === '..' || /[/\\]/u.test(decoded);
    })) return null;
    const parsed = new URL(uri);
    return parsed.protocol === 'file:' && !parsed.host && !parsed.search && !parsed.hash ? parsed : null;
  } catch { return null; }
}

/** Return only a safe leaf filename from an app-managed page path. */
export function managedFileName(uri: string): string | null {
  const relative = RELATIVE_IMAGE.exec(uri);
  if (relative) return relative[1];
  if (!safeFileUri(uri)) return null;
  return ABSOLUTE_IMAGE.exec(uri)?.[2] ?? null;
}

/**
 * iOS may change the absolute app container path during an update. Persist the
 * managed path relative to Documents and reconstruct it using today's location.
 * Apple TN2285: https://developer.apple.com/library/archive/technotes/tn2285/
 */
export function persistPageUris(record: SavedAnalysis): SavedAnalysis {
  return {
    ...record,
    localPages: record.localPages.map(page => {
      const name = managedFileName(page.uri);
      return name ? { ...page, uri: `${MANAGED_DIRECTORY}/${name}` } : page;
    }),
  };
}

/** currentDirectoryUri is the current Documents directory, not rentguard-pages. */
export function restorePageUris(pages: LocalPage[], currentDirectoryUri: string): LocalPage[] {
  const directory = safeFileUri(currentDirectoryUri);
  if (!directory) throw new Error('Thư mục dữ liệu trên thiết bị không hợp lệ.');
  const currentRoot = directory.href.replace(/\/+$/u, '');
  return pages.map(page => {
    const name = managedFileName(page.uri);
    return name ? { ...page, uri: `${currentRoot}/${MANAGED_DIRECTORY}/${name}` } : page;
  });
}
