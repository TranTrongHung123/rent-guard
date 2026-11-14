import type { AnalyzeRequest, AnalyzeResponse, ApiError, ChatRequest, ChatResponse, HealthResponse } from '@/types';
import { normalizeApiUrl } from '@/domain/core';
import { REQUIRE_HTTPS } from '@/domain/features';

export async function request<T>(baseUrl: string, path: string, body?: unknown, options: { signal?: AbortSignal; timeout?: number } = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener('abort', cancel);
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout ?? 15000);
  try {
    const serverUrl = normalizeApiUrl(baseUrl, REQUIRE_HTTPS);
    const requestOptions: RequestInit = {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    };
    let response: Response;
    try {
      response = await fetch(`${serverUrl}${path}`, requestOptions);
    } catch (error) {
      // SDK 58's native FetchError extends Error, rather than TypeError. Only
      // transport rejections belong here; HTTP/JSON/input errors stay separate.
      if (controller.signal.aborted) throw error;
      const hostname = new URL(serverUrl).hostname;
      const loopback = hostname === 'localhost' || hostname === '[::1]' || /^127\./.test(hostname);
      if (new URL(serverUrl).protocol === 'https:') throw new Error(`Không kết nối được máy chủ ${serverUrl}. Kiểm tra Internet và thử lại. Nếu máy chủ đang khởi động, hãy chờ khoảng một phút rồi kiểm tra lại trong Kết nối. Báo cáo đã lưu vẫn mở được trong Lịch sử.`);
      throw new Error(`Không kết nối được máy chủ ${serverUrl}. ${loopback
        ? 'Trên điện thoại thật, vào Kết nối và nhập IP Wi-Fi của laptop thay cho localhost.'
        : 'Kiểm tra địa chỉ trong Kết nối, Wi-Fi và backend trên laptop.'} Nếu dùng iPhone, kiểm tra quyền Mạng cục bộ của Expo Go hoặc RentGuard trong Cài đặt.`);
    }
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = value as ApiError | null;
      throw new Error(detail?.error?.message ?? `Máy chủ trả lỗi ${response.status}. Vui lòng thử lại.`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Phản hồi máy chủ không hợp lệ.');
    return value as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timedOut ? 'Máy chủ phản hồi quá lâu. Kiểm tra kết nối và thử lại; yêu cầu trước có thể vẫn đang được xử lý.' : 'Đã hủy yêu cầu.');
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

export const health = (url: string) => request<HealthResponse>(url, '/api/health');
export const analyzePages = (url: string, pages: { id: string; dataUrl: string }[], signal: AbortSignal, options: Omit<AnalyzeRequest, 'pages'> = {}) =>
  request<AnalyzeResponse>(url, '/api/analyses', { pages, ...options }, { signal, timeout: 600000 });
export const askContract = (url: string, body: ChatRequest) => request<ChatResponse>(url, '/api/chat', body, { timeout: 240000 });
