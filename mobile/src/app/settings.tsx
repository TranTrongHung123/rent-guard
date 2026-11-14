import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizeApiUrl } from '@/domain/core';
import { REQUIRE_HTTPS, SAMPLE_ENABLED } from '@/domain/features';
import { health as getServerHealth } from '@/services/api';
import { useRentGuard } from '@/state/rentguard';
import { Badge, Button, Card, colors, Heading, Notice, Screen, textStyles } from '@/ui';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { apiUrl, setApiUrl, clearError, draftPages } = useRentGuard();
  const [draftUrl, setUrl] = useState<string | null>(null);
  const url = draftUrl ?? apiUrl;
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<{ configured: boolean; model: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const changed = url.trim().replace(/\/+$/, '') !== apiUrl;

  async function connect() {
    if (busy) return;
    setBusy(true); setFeedback(null); setHealth(null); clearError(); Keyboard.dismiss();
    try {
      const normalized = normalizeApiUrl(url, REQUIRE_HTTPS);
      if (normalized !== apiUrl) await setApiUrl(normalized);
      setUrl(null);
      // Use this checked address directly; provider state may not have rerendered
      // immediately after saving a changed URL.
      const result = await getServerHealth(normalized);
      if (result.status !== 'ok' || typeof result.aiConfigured !== 'boolean' || typeof result.model !== 'string') throw new Error('Địa chỉ này chưa trả về máy chủ RentGuard tương thích.');
      setHealth({ configured: result.aiConfigured, model: result.model });
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Chưa kết nối được máy chủ. Hãy kiểm tra địa chỉ và thử lại.'); clearError(); }
    finally { setBusy(false); }
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}><Screen>
    <Heading title="Kết nối" subtitle="Kết nối máy chủ một lần để bắt đầu phân tích hợp đồng." />
    <Card style={styles.connectionCard}>
      <View style={styles.cardHeader}><View style={styles.icon}><Feather name="wifi" size={24} color={colors.primary} /></View><View style={{ flex: 1, gap: 4 }}><Text style={textStyles.section}>Máy chủ phân tích</Text><Text style={textStyles.caption}>{REQUIRE_HTTPS ? 'Dùng Internet qua Wi-Fi hoặc dữ liệu di động' : 'Máy chủ HTTPS hoặc laptop trong mạng Wi-Fi'}</Text></View></View>
      <View style={{ gap: 8 }}><Text style={textStyles.label}>Địa chỉ máy chủ</Text>
        <TextInput accessibilityLabel="Địa chỉ máy chủ phân tích" value={url} onChangeText={value => { setUrl(value); setFeedback(null); setHealth(null); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={() => void connect()} placeholder={REQUIRE_HTTPS ? 'Địa chỉ HTTPS được cung cấp cùng ứng dụng' : 'http://192.168.1.10:4000'} placeholderTextColor={colors.muted}
          style={[styles.urlInput, focused && styles.focusedInput]} editable={!busy} selectTextOnFocus />
        <Text style={textStyles.caption}>{REQUIRE_HTTPS ? 'Máy chủ đã được thiết lập sẵn. Nhấn kiểm tra kết nối trước khi phân tích.' : 'Nhập địa chỉ HTTPS hoặc IP Wi-Fi của laptop và cổng :4000.'}</Text>
      </View>
      <Button title={changed ? 'Lưu và kiểm tra kết nối' : 'Kiểm tra kết nối'} icon="arrow-right" loading={busy} disabled={busy || !url.trim()} onPress={() => void connect()} />
      {feedback ? <Notice tone="error" title="Chưa kết nối được"><Text style={textStyles.body}>{feedback}</Text></Notice> : null}
      {health ? <View style={styles.health}>
        <View style={styles.healthHeading}><Feather name="check-circle" size={21} color={colors.low} /><Text style={styles.healthTitle}>Đã kết nối máy chủ</Text></View>
        <View style={styles.statusRow}><Text style={textStyles.body}>Phân tích AI</Text><Badge tone={health.configured ? 'primary' : 'medium'}>{health.configured ? 'Đã cấu hình' : 'Chưa sẵn sàng'}</Badge></View>
        <Text style={textStyles.muted}>{health.configured ? 'Bạn có thể gửi hợp đồng để phân tích. Kết quả thành công sẽ xác nhận kết nối OpenAI thực tế.' : `Máy chủ chưa có khóa OpenAI.${SAMPLE_ENABLED ? ' Bạn vẫn có thể khám phá báo cáo mẫu.' : ' Hãy liên hệ người quản lý máy chủ.'}`}</Text>
        {health.configured ? <Text style={textStyles.caption}>Mô hình: {health.model}</Text> : null}
      </View> : null}
      {draftPages.length > 0 ? <Button title={`Tiếp tục với ${draftPages.length} trang đã chọn`} icon="file-text" variant="secondary" onPress={() => router.navigate('/capture')} /> : null}
    </Card>

    <Card style={styles.helpCard}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHelp }} onPress={() => setShowHelp(value => !value)} style={styles.helpToggle}>
        <View style={styles.helpHeading}><Feather name="help-circle" size={20} color={colors.primary} /><Text style={[textStyles.label, { flex: 1 }]}>Cần trợ giúp kết nối?</Text></View><Feather name={showHelp ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
      {showHelp ? <View style={{ gap: 14 }}>
        <View style={styles.instruction}><Text style={styles.stepNumber}>1</Text><Text style={styles.instructionText}>{REQUIRE_HTTPS ? 'Kiểm tra Internet, thử chuyển giữa Wi-Fi và dữ liệu di động.' : 'Giữ máy chủ RentGuard đang chạy và kiểm tra mạng của hai thiết bị.'}</Text></View>
        <View style={styles.instruction}><Text style={styles.stepNumber}>2</Text><Text style={styles.instructionText}>{REQUIRE_HTTPS ? 'Nếu máy chủ vừa khởi động, chờ khoảng một phút rồi kiểm tra lại kết nối.' : 'Dùng địa chỉ HTTPS hoặc IP Wi-Fi của laptop, kèm cổng máy chủ.'}</Text></View>
        <View style={styles.instruction}><Text style={styles.stepNumber}>3</Text><Text style={styles.instructionText}>{REQUIRE_HTTPS ? 'Lịch sử đã lưu vẫn mở được khi mạng gián đoạn. Hãy kiểm tra kết nối trước khi gửi ảnh hoặc hỏi AI.' : 'Trên iPhone khi dùng LAN, kiểm tra quyền Mạng cục bộ của Expo Go hoặc RentGuard.'}</Text></View>
      </View> : null}
    </Card>

    <View style={styles.notes}>
      <View style={styles.note}><View style={styles.noteIcon}><Feather name="lock" size={18} color={colors.primary} /></View><View style={{ flex: 1, gap: 4 }}><Text style={textStyles.label}>Khóa được bảo vệ ở máy chủ</Text><Text style={textStyles.muted}>Bạn không cần nhập hoặc lưu API Key trong ứng dụng.</Text></View></View>
      <View style={styles.note}><View style={styles.noteIcon}><Feather name="smartphone" size={18} color={colors.primary} /></View><View style={{ flex: 1, gap: 4 }}><Text style={textStyles.label}>Lịch sử riêng trên thiết bị</Text><Text style={textStyles.muted}>Báo cáo, ảnh và hội thoại đã lưu nằm trên điện thoại này. Gỡ ứng dụng có thể làm mất lịch sử.</Text></View></View>
    </View>
    <Text style={styles.footer}>RentGuard · Hiểu rõ trước khi ký</Text>
  </Screen></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  connectionCard: { gap: 18 }, cardHeader: { flexDirection: 'row', gap: 13, alignItems: 'center' }, icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  urlInput: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, minHeight: 54, fontSize: 15, color: colors.ink }, focusedInput: { borderColor: colors.primary, backgroundColor: colors.surface },
  health: { padding: 16, backgroundColor: colors.surfaceAlt, borderRadius: 16, gap: 12 }, healthHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 }, healthTitle: { flex: 1, fontSize: 16, lineHeight: 23, color: colors.ink, fontWeight: '700' }, statusRow: { flexDirection: 'row', gap: 9, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' },
  helpCard: { paddingVertical: 8 }, helpToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8 }, helpHeading: { flex: 1, flexDirection: 'row', gap: 9, alignItems: 'center' }, instruction: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, stepNumber: { color: colors.primary, fontWeight: '700', fontSize: 14, lineHeight: 23, minWidth: 18 }, instructionText: { flex: 1, fontSize: 14, lineHeight: 23, color: colors.muted },
  notes: { gap: 20 }, note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, noteIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, footer: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.muted, paddingTop: 2 },
});
