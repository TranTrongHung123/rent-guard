import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useRentGuard } from '@/state/rentguard';
import { Badge, Button, Card, colors, Screen, SourceBadge, textStyles } from '@/ui';

function serverInfo(value: string) {
  try {
    const url = new URL(value);
    return { host: url.host, loopback: url.hostname === 'localhost' || /^127\./.test(url.hostname) || url.hostname === '[::1]' };
  } catch { return { host: 'Chưa có địa chỉ hợp lệ', loopback: true }; }
}

export default function HomeScreen() {
  const { records, openDemo, draftPages, apiUrl, clearError } = useRentGuard();
  const [demoLoading, setDemoLoading] = useState(false);
  const recent = records.slice(0, 2);
  const server = serverInfo(apiUrl);

  async function viewDemo() {
    setDemoLoading(true);
    clearError();
    try { const id = await openDemo(); router.push({ pathname: '/report/[id]', params: { id } }); }
    catch { /* The shared notice keeps the full error available. */ }
    finally { setDemoLoading(false); }
  }

  return <Screen>
    <View style={styles.topBar}>
      <View style={styles.brand}><View style={styles.brandIcon}><Feather name="shield" size={24} color={colors.primary} /></View>
        <View style={{ gap: 2 }}><Text style={styles.brandText}>RentGuard</Text><Text style={styles.brandCaption}>Trợ lý hợp đồng thuê nhà</Text></View></View>
      <View style={styles.homeLabel}><Feather name="home" size={18} color={colors.primary} /></View>
    </View>

    <View style={styles.hero}>
      <View style={styles.heroBadge}><Feather name="file-text" size={14} color={colors.onPrimaryMuted} /><Text style={styles.heroBadgeText}>Hiểu rõ trước khi ký</Text></View>
      <Text accessibilityRole="header" style={styles.heroTitle}>Rõ điều khoản.{`\n`}An tâm hơn khi thuê.</Text>
      <Text style={styles.heroDescription}>Thêm ảnh hợp đồng để xem những điểm cần lưu ý, bằng chứng và câu hỏi nên trao đổi.</Text>
      <Button title={draftPages.length ? `Tiếp tục với ${draftPages.length} trang đã thêm` : 'Thêm hợp đồng'} icon={draftPages.length ? 'arrow-right' : 'plus'}
        variant="secondary" onPress={() => router.push('/capture')} style={styles.heroButton} />
      {draftPages.length ? <Text style={styles.heroFoot}>Ảnh đã chọn vẫn được giữ trong phiên này.</Text>
        : <Text style={styles.heroFoot}>Chụp ảnh hoặc chọn nhiều trang từ thư viện</Text>}
      <View pointerEvents="none" style={styles.heroDecoration} />
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel={`Mở kết nối máy chủ ${server.host}`} onPress={() => router.navigate('/settings')}
      style={({ pressed }) => [styles.connectionCard, pressed && { opacity: 0.75 }]}>
      <View style={styles.connectionIcon}><Feather name="wifi" size={21} color={colors.primary} /></View>
      <View style={styles.connectionBody}><Text style={textStyles.label}>Kết nối máy chủ</Text><Text numberOfLines={1} style={styles.serverHost}>{server.host}</Text>
        <Text style={textStyles.caption}>{server.loopback ? 'Dùng IP laptop khi thử trên điện thoại.' : 'Kiểm tra kết nối trước khi phân tích.'}</Text></View>
      <Feather name="chevron-right" size={20} color={colors.muted} />
    </Pressable>

    <View style={styles.howItWorks}>
      <Text style={textStyles.section}>Từ hợp đồng đến điều cần hỏi</Text>
      <View style={styles.steps}>
        {([{ icon: 'camera', title: 'Thêm ảnh', body: 'Đủ các trang' }, { icon: 'search', title: 'Xem báo cáo', body: 'Có bằng chứng' }, { icon: 'message-circle', title: 'Hỏi & làm rõ', body: 'Trước khi ký' }] as const).map((step, index) => <View key={step.title} style={styles.step}>
          <View style={styles.stepIcon}><Feather name={step.icon} size={21} color={colors.primary} /><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View></View>
          <Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepBody}>{step.body}</Text>
        </View>)}
      </View>
    </View>

    {recent.length ? <View style={{ gap: 12 }}>
      <View style={styles.sectionRow}><Text style={textStyles.section}>Hợp đồng gần đây</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Xem tất cả lịch sử" onPress={() => router.navigate('/history')} style={styles.sectionLink}><Text style={styles.linkText}>Xem tất cả</Text><Feather name="arrow-right" size={15} color={colors.primary} /></Pressable></View>
      {recent.map(record => <Pressable key={record.id} accessibilityRole="button" accessibilityLabel={`Mở ${record.report.title}`}
        onPress={() => router.push({ pathname: '/report/[id]', params: { id: record.id } })}>
        <Card style={styles.recentCard}><View style={styles.recentIcon}><Feather name="file-text" size={24} color={colors.primary} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text numberOfLines={2} style={styles.recentTitle}>{record.report.title}</Text>
            <Text style={textStyles.caption}>{new Date(record.report.createdAt).toLocaleDateString('vi-VN')} · {new Date(record.report.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {record.report.pages.length} trang</Text>
            <View style={styles.recentMeta}><SourceBadge source={record.report.source} /><Text style={textStyles.caption}>{record.report.findings.length} điểm lưu ý</Text></View></View>
          <Feather name="chevron-right" size={18} color={colors.muted} />
        </Card>
      </Pressable>)}
    </View> : null}

    <Card style={styles.demoCard}>
      <View style={styles.demoTop}><View style={styles.demoTitle}><Feather name="play-circle" size={21} color={colors.primary} /><Text style={[textStyles.section, { flexShrink: 1 }]}>Thử trước với bản mẫu</Text></View><Badge tone="medium">Mẫu</Badge></View>
      <Text style={textStyles.muted}>Xem cách đọc báo cáo và hỏi đáp với dữ liệu soạn sẵn. Không gửi ảnh hay gọi OpenAI.</Text>
      <Button title="Xem báo cáo mẫu" icon="arrow-right" variant="ghost" loading={demoLoading} onPress={() => { void viewDemo(); }} />
    </Card>
    <View style={styles.disclaimer}><Feather name="info" size={15} color={colors.muted} /><Text style={styles.disclaimerText}>RentGuard hỗ trợ đọc hiểu hợp đồng. Hãy đối chiếu ảnh gốc và tìm tư vấn chuyên môn khi cần.</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }, brandIcon: { width: 46, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.primaryDeep, letterSpacing: -0.9 }, brandCaption: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  homeLabel: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.primaryDeep, borderRadius: 25, padding: 23, gap: 16, overflow: 'hidden' },
  heroBadge: { flexDirection: 'row', gap: 7, alignItems: 'center', zIndex: 1 }, heroBadgeText: { color: colors.onPrimaryMuted, fontSize: 12, fontWeight: '500', lineHeight: 18 },
  heroTitle: { color: colors.onPrimary, fontSize: 30, lineHeight: 39, fontWeight: '700', letterSpacing: -0.7, zIndex: 1 },
  heroDescription: { color: colors.onPrimaryMuted, fontSize: 14, lineHeight: 23, maxWidth: 450, zIndex: 1 },
  heroButton: { zIndex: 1, backgroundColor: colors.surface, borderColor: colors.surface }, heroFoot: { fontSize: 11, color: colors.onPrimaryMuted, lineHeight: 18, textAlign: 'center', zIndex: 1 },
  heroDecoration: { position: 'absolute', right: -70, top: -50, width: 220, height: 220, borderWidth: 35, borderRadius: 110, borderColor: '#FFFFFF08' },
  connectionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 18 },
  connectionIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' }, connectionBody: { flex: 1, minWidth: 0, gap: 3 }, serverHost: { fontSize: 13, lineHeight: 20, color: colors.primaryDeep, fontWeight: '500' },
  howItWorks: { gap: 18, paddingVertical: 2 }, steps: { flexDirection: 'row', gap: 10 }, step: { flex: 1, alignItems: 'center', gap: 6 },
  stepIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  stepNumber: { position: 'absolute', top: -4, right: -5, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, stepNumberText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  stepTitle: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' }, stepBody: { fontSize: 11, lineHeight: 17, color: colors.muted, textAlign: 'center' },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, sectionLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 }, linkText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  recentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 }, recentIcon: { width: 42, height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  recentTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.ink }, recentMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  demoCard: { borderStyle: 'dashed', borderColor: colors.primaryBorder, backgroundColor: colors.surface }, demoTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }, demoTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, disclaimerText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 19 },
});
