import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import { fingerprintInput, previousAnalysis } from '@/domain/analysis';
import { MAX_PAGES, MAX_QUESTION_LENGTH, messageOf, moveItem, normalizeApiUrl, validateSavedRecord } from '@/domain/core';
import { createDemoAnswer, createDemoRecord } from '@/domain/demo';
import { managedFileName } from '@/domain/paths';
import { analyzePages, askContract, health } from '@/services/api';
import { cleanOrphanImages, deletePageFiles, localId, pageDataUrl, restoreManagedPages, selectImages } from '@/services/images';
import { loadRecords, readApiUrl, removeRecord, writeApiUrl, writeRecord } from '@/services/storage';
import type { ChatMessage, LocalPage, SavedAnalysis } from '@/types';

interface RentGuardState {
  ready: boolean;
  error: string | null;
  clearError(): void;
  apiUrl: string;
  setApiUrl(url: string): Promise<void>;
  checkBackend(): Promise<{ status: string; configured: boolean; model: string }>;
  draftPages: LocalPage[];
  pickImages(source: 'camera' | 'library'): Promise<void>;
  removePage(id: string): void;
  movePage(id: string, direction: -1 | 1): void;
  clearDraft(): Promise<void>;
  analyze(): Promise<string | null>;
  reanalyzeRecord(id: string): Promise<string | null>;
  analysisState: 'idle' | 'preparing' | 'analyzing';
  cancelAnalysis(): void;
  openDemo(): Promise<string>;
  records: SavedAnalysis[];
  getRecord(id: string): SavedAnalysis | undefined;
  saveRecord(id: string): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  sendMessage(id: string, question: string): Promise<void>;
  chatBusy: boolean;
}

const Context = createContext<RentGuardState | null>(null);
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

async function loadDemoPages(): Promise<LocalPage[]> {
  const assets = await Asset.loadAsync([require('../../assets/demo/page-1.jpg'), require('../../assets/demo/page-2.jpg')]);
  return assets.map((asset, index) => ({ id: `demo-page-${index + 1}`, uri: asset.localUri ?? asset.uri, width: 1240, height: 1754, mimeType: 'image/jpeg' }));
}

export function RentGuardProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setUrl] = useState(DEFAULT_URL);
  const [items, setItems] = useState<SavedAnalysis[]>([]);
  const itemsRef = useRef<SavedAnalysis[]>([]);
  const [draftPages, setPages] = useState<LocalPage[]>([]);
  const pagesRef = useRef<LocalPage[]>([]);
  const [analysisState, setAnalysisState] = useState<RentGuardState['analysisState']>('idle');
  const analysisRef = useRef<AbortController | null>(null);
  const analyzingRecordRef = useRef<string | null>(null);
  const pickerBusy = useRef(false);
  const [chatBusy, setChatBusy] = useState(false);
  const chatRef = useRef<string | null>(null);
  const storageQueue = useRef<Promise<unknown>>(Promise.resolve());

  function updateItems(update: (current: SavedAnalysis[]) => SavedAnalysis[]) {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }
  function updatePages(pages: LocalPage[]) { pagesRef.current = pages; setPages(pages); }
  function enqueue<T,>(operation: () => Promise<T>): Promise<T> {
    const result = storageQueue.current.then(operation);
    storageQueue.current = result.catch(() => undefined);
    return result;
  }
  function fail(cause: unknown): never { const message = messageOf(cause); setError(message); throw new Error(message); }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [loaded, url] = await Promise.all([loadRecords(), readApiUrl()]);
        if (!live) return;
        let restored = loaded.records.map((record) => ({ ...record, localPages: restoreManagedPages(record.localPages) }));
        if (restored.some((record) => record.report.source === 'demo')) {
          try {
            const demoPages = await loadDemoPages();
            restored = restored.map((record) => record.report.source === 'demo' ? { ...record, localPages: demoPages } : record);
          } catch { setError('Chưa mở lại được ảnh minh họa. Báo cáo mẫu vẫn được giữ; hãy mở lại khi có kết nối với máy phát triển.'); }
        }
        if (!live) return;
        updateItems(() => restored);
        if (url) setUrl(normalizeApiUrl(url));
        if (loaded.corrupted) {
          setError(`${loaded.corrupted} mục lịch sử không đọc được. Dữ liệu đã được giữ lại; các mục còn lại vẫn sử dụng được.`);
        } else if (restored.filter((record) => record.report.source === 'openai').every((record) => record.localPages.every((page) => managedFileName(page.uri)))) {
          await cleanOrphanImages(restored.flatMap((item) => item.localPages)).catch(() => undefined);
        }
      } catch {
        if (live) setError('Chưa đọc được lịch sử trên máy. Dữ liệu cũ được giữ lại; hãy đóng và mở lại ứng dụng.');
      } finally { if (live) setReady(true); }
    })();
    return () => { live = false; analysisRef.current?.abort(); };
  }, []);

  const getRecord = (id: string) => itemsRef.current.find((item) => item.id === id);

  async function setApiUrl(url: string) {
    try { const normalized = normalizeApiUrl(url); await writeApiUrl(normalized); setUrl(normalized); setError(null); }
    catch (cause) { fail(cause); }
  }

  async function checkBackend() {
    setError(null);
    try {
      const value = await health(apiUrl);
      if (value.status !== 'ok' || typeof value.aiConfigured !== 'boolean') throw new Error('Máy chủ này không phải backend RentGuard tương thích.');
      return { status: value.status, configured: value.aiConfigured, model: value.model };
    } catch (cause) { return fail(cause); }
  }

  async function pickImages(source: 'camera' | 'library') {
    if (pickerBusy.current || analysisRef.current) return;
    pickerBusy.current = true;
    setError(null);
    try { const pages = await selectImages(source, MAX_PAGES - pagesRef.current.length); updatePages([...pagesRef.current, ...pages]); }
    catch (cause) { fail(cause); }
    finally { pickerBusy.current = false; }
  }

  function removePage(id: string) {
    if (analysisRef.current || pickerBusy.current) return;
    const removed = pagesRef.current.filter((page) => page.id === id);
    updatePages(pagesRef.current.filter((page) => page.id !== id));
    void deletePageFiles(removed).catch((cause) => setError(messageOf(cause)));
  }
  function movePage(id: string, direction: -1 | 1) {
    if (!analysisRef.current && !pickerBusy.current) updatePages(moveItem(pagesRef.current, id, direction));
  }
  async function clearDraft() {
    if (analysisRef.current || pickerBusy.current) return;
    const old = pagesRef.current;
    updatePages([]);
    await deletePageFiles(old);
  }

  async function runAnalysis(pages: LocalPage[], forceRefresh = false, consumeDraft = true): Promise<string | null> {
    if (analysisRef.current || pickerBusy.current) return null;
    if (!pages.length) { setError('Hãy chụp hoặc chọn ít nhất một trang hợp đồng.'); return null; }
    const controller = new AbortController();
    analysisRef.current = controller;
    setError(null);
    setAnalysisState('preparing');
    try {
      const payload: { id: string; dataUrl: string }[] = [];
      let totalBytes = 0;
      for (const page of pages) {
        if (controller.signal.aborted) return null;
        const dataUrl = await pageDataUrl(page);
        totalBytes += (dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75;
        if (totalBytes > 20 * 1024 * 1024) throw new Error('Tổng ảnh vượt 20 MiB. Hãy giảm số trang hoặc chọn ảnh nhẹ hơn rồi phân tích lại.');
        payload.push({ id: page.id, dataUrl });
      }
      if (controller.signal.aborted) return null;
      // Expo Crypto is bundled in Expo Go. A browser without secure-context
      // crypto can still analyze; the backend also computes the fingerprint.
      const fingerprint = forceRefresh ? null : await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fingerprintInput(payload)).catch(() => null);
      const previous = forceRefresh ? undefined : previousAnalysis(itemsRef.current, fingerprint, pages.length);
      if (controller.signal.aborted) return null;
      setAnalysisState('analyzing');
      const response = await analyzePages(apiUrl, payload, controller.signal, { ...(forceRefresh ? { forceRefresh: true } : {}), ...(previous ? { previousAnalysis: previous } : {}) });
      if (controller.signal.aborted) return null;
      const item: SavedAnalysis = { id: response.report?.id, report: response.report, localPages: pages, analysisToken: response.analysisToken, messages: [], isSaved: false };
      if (!validateSavedRecord(item) || item.report.source !== 'openai' || !item.analysisToken ||
        item.report.pages.length !== pages.length || item.report.pages.some((page, index) => page.id !== pages[index].id)) {
        throw new Error('Báo cáo máy chủ không hợp lệ hoặc thiếu trang. Ảnh của bạn được giữ lại để thử lại.');
      }
      updateItems((current) => [item, ...current]);
      if (consumeDraft) updatePages([]);
      return item.id;
    } catch (cause) { if (!controller.signal.aborted) setError(messageOf(cause)); return null; }
    finally { analysisRef.current = null; setAnalysisState('idle'); }
  }

  async function analyze() { return runAnalysis([...pagesRef.current]); }

  async function reanalyzeRecord(id: string): Promise<string | null> {
    if (analysisRef.current || pickerBusy.current) return null;
    const record = getRecord(id);
    if (!record || record.report.source !== 'openai') { setError('Chỉ đọc lại được báo cáo AI có ảnh gốc trên máy.'); return null; }
    analyzingRecordRef.current = id;
    try { return await runAnalysis([...record.localPages], true, false); }
    finally { analyzingRecordRef.current = null; }
  }

  async function openDemo(): Promise<string> {
    try {
      const localPages = await loadDemoPages();
      const item = createDemoRecord(localPages, localId('demo'));
      updateItems((current) => [item, ...current]);
      return item.id;
    } catch (cause) { return fail(cause); }
  }

  async function saveRecord(id: string) {
    return enqueue(async () => {
      try {
        const item = getRecord(id);
        if (!item) throw new Error('Không tìm thấy báo cáo.');
        await writeRecord(item);
        updateItems((current) => current.map((record) => record.id === id ? { ...record, isSaved: true } : record));
      } catch { fail(new Error('Chưa lưu được báo cáo. Kiểm tra dung lượng điện thoại rồi thử lại; báo cáo vẫn đang mở trong phiên này.')); }
    });
  }

  async function deleteRecord(id: string) {
    return enqueue(async () => {
      try {
        if (chatRef.current === id) throw new Error('Hãy đợi câu trả lời hoàn tất trước khi xóa hợp đồng.');
        if (analyzingRecordRef.current === id) throw new Error('Hãy đợi đọc lại ảnh hoàn tất trước khi xóa hợp đồng.');
        const item = getRecord(id);
        await removeRecord(id);
        updateItems((current) => current.filter((record) => record.id !== id));
        if (item) {
          const keep = new Set([...pagesRef.current, ...itemsRef.current.flatMap((record) => record.localPages)].map((page) => page.uri));
          await deletePageFiles(item.localPages.filter((page) => !keep.has(page.uri)));
        }
      } catch (cause) { fail(cause); }
    });
  }

  async function sendMessage(id: string, question: string) {
    const text = question.trim();
    if (chatRef.current) throw new Error('AI đang trả lời. Hãy đợi một chút.');
    if (!text || text.length > MAX_QUESTION_LENGTH) return fail(new Error(`Nhập câu hỏi từ 1 đến ${MAX_QUESTION_LENGTH} ký tự.`));
    const item = getRecord(id);
    if (!item) return fail(new Error('Không tìm thấy hợp đồng để hỏi đáp.'));
    chatRef.current = id;
    setChatBusy(true);
    setError(null);
    try {
      const response = item.report.source === 'demo'
        ? { message: createDemoAnswer(text, item.report) }
        : await askContract(apiUrl, { report: item.report, analysisToken: item.analysisToken, messages: item.messages.slice(-20).map(({ role, content }) => ({ role, content })), question: text });
      const answer = response.message;
      if (!answer || answer.role !== 'assistant' || typeof answer.content !== 'string' || !Array.isArray(answer.evidence) || answer.source !== item.report.source) throw new Error('Câu trả lời máy chủ không hợp lệ. Vui lòng thử lại.');
      const user: ChatMessage = { id: localId('user'), role: 'user', content: text, evidence: [], createdAt: new Date().toISOString(), source: item.report.source };
      await enqueue(async () => {
        const latest = getRecord(id);
        if (!latest) throw new Error('Báo cáo đã bị xóa.');
        let next = { ...latest, messages: [...latest.messages, user, answer] };
        if (!validateSavedRecord(next)) throw new Error('Bằng chứng trong câu trả lời không hợp lệ. Nội dung chưa được thêm vào hội thoại; hãy thử lại.');
        if (next.isSaved) {
          try { await writeRecord(next); }
          catch { next = { ...next, isSaved: false }; setError('Đã nhận câu trả lời nhưng chưa lưu được hội thoại. Hãy nhấn Lưu báo cáo để thử lại.'); }
        }
        updateItems((current) => current.map((record) => record.id === id ? next : record));
      });
    } catch (cause) { fail(cause); }
    finally { chatRef.current = null; setChatBusy(false); }
  }

  return <Context.Provider value={{ ready, error, clearError: () => setError(null), apiUrl, setApiUrl, checkBackend, draftPages, pickImages, removePage, movePage, clearDraft, analyze, reanalyzeRecord, analysisState, cancelAnalysis: () => analysisRef.current?.abort(), openDemo, records: items.filter((item) => item.isSaved), getRecord, saveRecord, deleteRecord, sendMessage, chatBusy }}>{children}</Context.Provider>;
}

export function useRentGuard() {
  const context = useContext(Context);
  if (!context) throw new Error('RentGuardProvider is missing.');
  return context;
}
