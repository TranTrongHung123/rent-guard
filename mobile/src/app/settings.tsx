import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useRentGuard } from '@/state/rentguard';
import { Badge, Button, Card, colors, Heading, Screen, textStyles } from '@/ui';

export default function SettingsScreen() {
  const { apiUrl, setApiUrl, checkBackend } = useRentGuard();
  const [draftUrl, setUrl] = useState<string | null>(null);
  const url = draftUrl ?? apiUrl;
  const [busy, setBusy] = useState<'saving' | 'checking' | null>(null);
  const [health, setHealth] = useState<{ status: string; configured: boolean; model: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const changed = url.trim().replace(/\/$/, '') !== apiUrl.replace(/\/$/, '');

  const save = async () => {
    setBusy('saving'); setFeedback(null); setHealth(null);
    try { await setApiUrl(url.trim()); setUrl(null); setFeedback('Đã lưu địa chỉ máy chủ. Bạn có thể kiểm tra kết nối ngay bên dưới.'); setIsError(false); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Địa chỉ chưa hợp lệ. Vui lòng kiểm tra lại.'); setIsError(true); }
    finally { setBusy(null); }
  };
  const check = async () => {
    setBusy('checking'); setFeedback(null); setHealth(null);
    try { setHealth(await checkBackend()); setIsError(false); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Không kết nối được máy chủ. Hãy kiểm tra Wi-Fi và địa chỉ.'); setIsError(true); }
    finally { setBusy(null); }
  };

  return <Screen>
    <Heading kicker="SẴN SÀNG ĐỂ BẮT ĐẦU" title="Kết nối & cài đặt" subtitle="Kết nối RentGuard với máy chủ để phân tích hợp đồng và trò chuyện với AI." />
    <Card>
      <View style={styles.cardHeader}><View style={styles.icon}><Feather name="wifi" size={23} color={colors.forest} /></View><View style={{ flex: 1, gap: 4 }}><Text style={textStyles.section}>Máy chủ của bạn</Text><Text style={textStyles.caption}>Backend chạy trên laptop</Text></View></View>
      <Text style={textStyles.label}>Địa chỉ máy chủ</Text>
      <TextInput accessibilityLabel="Địa chỉ máy chủ Backend" value={url} onChangeText={(value) => { setUrl(value); setFeedback(null); setHealth(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.10:4000" placeholderTextColor="#8D978E" style={styles.urlInput} editable={!busy} selectTextOnFocus />
      <Text style={textStyles.caption}>Dùng địa chỉ IP của laptop trong cùng mạng Wi-Fi, kèm cổng Backend. Trên điện thoại, localhost là chính điện thoại đó.</Text>
      <Button title="Lưu địa chỉ" icon="check" loading={busy === 'saving'} disabled={!!busy || !changed || !url.trim()} onPress={() => { void save(); }} />
      <Button title="Kiểm tra kết nối" icon="activity" variant="ghost" loading={busy === 'checking'} disabled={!!busy || changed || !apiUrl} onPress={() => { void check(); }} />
      {changed ? <Text style={textStyles.caption}>Lưu địa chỉ mới trước khi kiểm tra kết nối.</Text> : null}
      {feedback ? <View accessibilityLiveRegion="polite" style={[styles.feedback, isError && styles.feedbackError]}><Feather name={isError ? 'alert-circle' : 'check-circle'} size={17} color={isError ? colors.high : colors.low} /><Text style={[styles.feedbackText, isError && { color: colors.high }]}>{feedback}</Text></View> : null}
      {health ? <View style={styles.health}>
        <Badge tone="mint">ĐÃ KẾT NỐI MÁY CHỦ</Badge>
        <Text style={textStyles.body}>{health.configured ? 'Máy chủ đã có cấu hình OpenAI. Bạn có thể gửi hợp đồng để phân tích.' : 'Máy chủ đang hoạt động nhưng chưa có khóa OpenAI. Hãy cấu hình khóa ở Backend để dùng AI thật.'}</Text>
        {health.configured ? <Text style={textStyles.caption}>Mô hình: {health.model}</Text> : null}
        <Text style={textStyles.caption}>Kiểm tra này xác nhận kết nối với Backend. Một lần phân tích thành công sẽ xác nhận kết nối OpenAI thực tế.</Text>
      </View> : null}
    </Card>

    <Card style={{ backgroundColor: '#EEF1E7' }}>
      <Text style={textStyles.section}>Kết nối từ điện thoại</Text>
      <View style={styles.instruction}><View style={styles.number}><Text style={styles.numberText}>1</Text></View><Text style={styles.instructionText}>Khởi động Backend trên laptop theo hướng dẫn đi kèm dự án.</Text></View>
      <View style={styles.instruction}><View style={styles.number}><Text style={styles.numberText}>2</Text></View><Text style={styles.instructionText}>Kết nối điện thoại và laptop với cùng Wi-Fi. Nhập địa chỉ IP LAN và cổng của Backend.</Text></View>
      <View style={styles.instruction}><View style={styles.number}><Text style={styles.numberText}>3</Text></View><Text style={styles.instructionText}>Lưu địa chỉ và kiểm tra kết nối. Nếu không kết nối được, kiểm tra tường lửa và bảo đảm laptop vẫn đang chạy.</Text></View>
    </Card>

    <View style={{ gap: 18 }}>
      <View style={styles.note}><Feather name="lock" size={19} color={colors.forest} /><View style={{ flex: 1, gap: 5 }}><Text style={textStyles.label}>Khóa API chỉ ở máy chủ</Text><Text style={textStyles.muted}>Khóa OpenAI được cấu hình trong tệp .env của Backend. Ứng dụng không cần nhập hoặc lưu khóa.</Text></View></View>
      <View style={styles.note}><Feather name="smartphone" size={19} color={colors.forest} /><View style={{ flex: 1, gap: 5 }}><Text style={textStyles.label}>Lịch sử trên thiết bị</Text><Text style={textStyles.muted}>Báo cáo đã lưu, ảnh và hội thoại nằm trên thiết bị này. Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng có thể làm mất lịch sử.</Text></View></View>
    </View>
    <Text style={styles.footer}>RentGuard · Hiểu rõ trước khi ký</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 6 }, icon: { width: 49, height: 49, borderRadius: 15, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  urlInput: { borderWidth: 1, borderColor: '#CFD8C7', backgroundColor: colors.background, borderRadius: 12, padding: 14, minHeight: 52, fontSize: 14, color: colors.ink },
  feedback: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#EAF3E2', padding: 13, borderRadius: 12 }, feedbackError: { backgroundColor: '#FBEAE4' }, feedbackText: { flex: 1, color: colors.low, fontSize: 13, lineHeight: 20 },
  health: { padding: 15, backgroundColor: '#F0F6E9', borderRadius: 14, gap: 11 },
  instruction: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, number: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#DEE8D4', alignItems: 'center', justifyContent: 'center' }, numberText: { fontSize: 12, fontWeight: '700', color: colors.forest }, instructionText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.muted },
  note: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' }, footer: { fontSize: 12, textAlign: 'center', color: '#889180', paddingTop: 8 },
});
