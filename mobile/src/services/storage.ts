import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateSavedRecord } from '@/domain/core';
import { persistPageUris } from '@/domain/paths';
import type { SavedAnalysis } from '@/types';

const PREFIX = 'rentguard:v1:analysis:';
const URL_KEY = 'rentguard:v1:api-url';

export async function loadRecords(): Promise<{ records: SavedAnalysis[]; corrupted: number }> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
  const rows = keys.length ? await AsyncStorage.multiGet(keys) : [];
  const records: SavedAnalysis[] = [];
  let corrupted = 0;
  for (const [key, raw] of rows) {
    try {
      const value: unknown = JSON.parse(raw ?? 'null');
      if (!validateSavedRecord(value) || key !== PREFIX + value.id) throw new Error('Invalid record');
      records.push({ ...value, isSaved: true });
    } catch { corrupted += 1; }
  }
  return { records: records.sort((a, b) => b.report.createdAt.localeCompare(a.report.createdAt)), corrupted };
}

export const writeRecord = (record: SavedAnalysis) => AsyncStorage.setItem(PREFIX + record.id, JSON.stringify(persistPageUris({ ...record, isSaved: true })));
export const removeRecord = (id: string) => AsyncStorage.removeItem(PREFIX + id);
export const readApiUrl = () => AsyncStorage.getItem(URL_KEY);
export const writeApiUrl = (value: string) => AsyncStorage.setItem(URL_KEY, value);
