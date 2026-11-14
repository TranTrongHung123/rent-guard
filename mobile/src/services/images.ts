import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat, type ImageResult } from 'expo-image-manipulator';
import { MAX_IMAGE_BYTES, MAX_PAGES } from '@/domain/core';
import { restorePageUris } from '@/domain/paths';
import type { LocalPage } from '@/types';

export function localId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function restoreManagedPages(pages: LocalPage[]): LocalPage[] {
  return Platform.OS === 'web' ? pages : restorePageUris(pages, Paths.document.uri);
}

function pageDirectory() {
  const directory = new Directory(Paths.document, 'rentguard-pages');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

export async function selectImages(source: 'camera' | 'library', remaining: number): Promise<LocalPage[]> {
  if (remaining <= 0) throw new Error(`Mỗi lần phân tích tối đa ${MAX_PAGES} trang. Hãy xóa bớt trang để thêm ảnh.`);
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Chưa có quyền camera. Hãy bật quyền camera cho RentGuard trong Cài đặt điện thoại hoặc chọn ảnh từ thư viện.');
  }
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, orderedSelection: true, selectionLimit: remaining, quality: 1 });
  if (result.canceled) return [];
  const pages: LocalPage[] = [];
  try {
    for (const asset of result.assets.slice(0, remaining)) {
      const context = ImageManipulator.manipulate(asset.uri);
      let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
      let normalized: ImageResult;
      try {
        if (Math.max(asset.width, asset.height) > 2400) {
          context.resize(asset.width >= asset.height ? { width: 2400 } : { height: 2400 });
        }
        rendered = await context.renderAsync();
        normalized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: Platform.OS === 'web' });
      } finally { rendered?.release(); context.release(); }
      const id = localId('page');
      let uri = normalized.uri;
      if (Platform.OS === 'web') {
        if (!normalized.base64) throw new Error('Không đọc được dữ liệu ảnh. Hãy chọn ảnh JPEG/PNG khác.');
        if (normalized.base64.length * 0.75 > MAX_IMAGE_BYTES) throw new Error('Ảnh quá lớn sau khi xử lý. Hãy chọn ảnh rõ nét nhỏ hơn 5 MiB.');
        uri = `data:image/jpeg;base64,${normalized.base64}`;
      } else {
        const original = new File(normalized.uri);
        if (!original.exists || original.size > MAX_IMAGE_BYTES) throw new Error('Không đọc được ảnh hoặc ảnh lớn hơn 5 MiB. Hãy chụp lại rõ nét.');
        const destination = new File(pageDirectory(), `${id}.jpg`);
        await original.copy(destination);
        uri = destination.uri;
      }
      pages.push({ id, uri, width: normalized.width, height: normalized.height, mimeType: 'image/jpeg' });
    }
    return pages;
  } catch (error) {
    await deletePageFiles(pages);
    throw error instanceof Error ? error : new Error('Không xử lý được ảnh. Hãy chọn ảnh khác hoặc chụp lại.');
  }
}

export async function pageDataUrl(page: LocalPage): Promise<string> {
  if (page.uri.startsWith('data:image/jpeg;base64,')) return page.uri;
  try {
    const file = new File(page.uri);
    if (!file.exists) throw new Error('missing');
    const base64 = await file.base64();
    if (base64.length * 0.75 > MAX_IMAGE_BYTES) throw new Error('large');
    return `data:image/jpeg;base64,${base64}`;
  } catch { throw new Error('Không đọc được ảnh đã chọn. Hãy xóa trang này và chụp hoặc chọn lại.'); }
}

export async function deletePageFiles(pages: LocalPage[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const prefix = pageDirectory().uri.replace(/\/+$/, '') + '/';
  for (const page of pages) {
    if (!page.uri.startsWith(prefix)) continue;
    try { const file = new File(page.uri); if (file.exists) file.delete(); } catch { /* A missing cache file must not prevent metadata deletion. */ }
  }
}

export async function cleanOrphanImages(keepPages: LocalPage[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const directory = pageDirectory();
  const keep = new Set(keepPages.map((p) => p.uri));
  for (const file of directory.list()) if (file instanceof File && !keep.has(file.uri)) file.delete();
}
