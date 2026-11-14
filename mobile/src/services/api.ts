import type { AnalyzeResponse, ApiError, ChatRequest, ChatResponse, HealthResponse } from '@/types';
import { normalizeApiUrl } from '@/domain/core';

export async function request<T>(baseUrl: string, path: string, body?: unknown, options: { signal?: AbortSignal; timeout?: number } = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener('abort', cancel);
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout ?? 15000);
  try {
    const response = await fetch(`${normalizeApiUrl(baseUrl)}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = value as ApiError | null;
      throw new Error(detail?.error?.message ?? `Máy chủ trả lỗi ${response.status}. Vui lòng thử lại.`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Phản hồi máy chủ không hợp lệ.');
    return value as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timedOut ? 'Máy chủ phản hồi quá lâu. Kiểm tra kết nối và thử lại; yêu cầu trước có thể vẫn đang được xử lý.' : 'Đã hủy yêu cầu.');
    if (error instanceof TypeError) throw new Error('Không kết nối được máy chủ. Kiểm tra Wi-Fi, địa chỉ máy chủ và backend trên laptop.');
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export const health = (url: string) => request<HealthResponse>(url, '/api/health');
export const analyzePages = (url: string, pages: { id: string; dataUrl: string }[], signal: AbortSignal) =>
  request<AnalyzeResponse>(url, '/api/analyses', { pages }, { signal, timeout: 600000 });
export const askContract = (url: string, body: ChatRequest) => request<ChatResponse>(url, '/api/chat', body, { timeout: 240000 });
