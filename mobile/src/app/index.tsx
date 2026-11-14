import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useRentGuard } from '@/state/rentguard';
import { Badge, Button, Card, colors, Screen, SourceBadge, textStyles } from '@/ui';

export default function HomeScreen() {
  const { records, openDemo, draftPages } = useRentGuard();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const recent = records.filter((record) => record.isSaved).slice(0, 2);

  const viewDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const id = await openDemo();
      router.push({ pathname: '/report/[id]', params: { id } });
    } catch (error) { setDemoError(error instanceof Error ? error.message : 'Chưa mở được dữ liệu mẫu. Vui lòng thử lại.'); }
    finally { setDemoLoading(false); }
  };

  return <Screen>
    <View style={styles.topBar}>
      <View style={styles.brand}><View style={styles.brandIcon}><Feather name="shield" size={22} color={colors.forest} /></View>
        <Text style={styles.brandText}>RentGuard<Text style={styles.brandDot}>.</Text></Text></View>
      <Badge tone="mint">CHO NGƯỜI THUÊ NHÀ</Badge>
    </View>

    <View style={styles.intro}>
      <Text style={styles.kicker}>HIỂU RÕ TRƯỚC KHI KÝ</Text>
      <Text accessibilityRole="header" style={styles.headline}>Một chữ ký.{`\n`}Nhiều điều cần hiểu.</Text>
      <Text style={styles.description}>Đọc hợp đồng dễ hơn. Nhìn rõ những điều cần hỏi trước khi bắt đầu tổ ấm mới.</Text>
    </View>

    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}><Feather name="file-text" size={30} color={colors.mint} /></View>
        <View style={styles.aiTag}><View style={styles.liveDot} /><Text style={styles.aiTagText}>TRỢ LÝ HỢP ĐỒNG AI</Text></View>
      </View>
      <Text style={styles.heroTitle}>Hợp đồng của bạn,{`\n`}rõ ràng hơn.</Text>
      <Text style={styles.heroDescription}>Chụp hoặc chọn ảnh từng trang. RentGuard giúp bạn tìm những điều khoản cần lưu ý và đối chiếu bằng chứng.</Text>
      <Button title={draftPages.length ? `Tiếp tục với ${draftPages.length} trang` : 'Phân tích hợp đồng mới'} icon="arrow-up-right" variant="secondary" onPress={() => router.push('/capture')} />
      <View style={styles.heroFoot}><Feather name="check-circle" size={13} color={colors.mint} /><Text style={styles.heroFootText}>Có bằng chứng · Giải thích dễ hiểu · Hỏi đáp tiếp</Text></View>
    </View>

    <View style={styles.steps}>
      {([{ icon: 'camera', title: 'Thêm ảnh', body: 'Đủ các trang' }, { icon: 'search', title: 'Hiểu điều khoản', body: 'Rõ từng vấn đề' }, { icon: 'message-circle', title: 'Hỏi trước khi ký', body: 'Tự tin trao đổi' }] as const).map((step, i) => (
        <View key={step.title} style={styles.step}>
          <View style={styles.stepIcon}><Feather name={step.icon} size={20} color={colors.forest} /><Text style={styles.stepNumber}>{i + 1}</Text></View>
          <Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepBody}>{step.body}</Text>
        </View>
      ))}
    </View>

    <Card style={styles.demoCard}>
      <View style={styles.demoTop}><Feather name="play-circle" size={23} color={colors.forest} /><Badge tone="medium">DỮ LIỆU MẪU</Badge></View>
      <Text style={styles.sectionTitle}>Xem một báo cáo mẫu</Text>
      <Text style={textStyles.muted}>Khám phá cách đọc báo cáo với hợp đồng minh họa. Đây là dữ liệu soạn sẵn, không phải kết quả từ OpenAI.</Text>
      <Button title="Khám phá báo cáo mẫu" icon="arrow-right" variant="ghost" loading={demoLoading} onPress={() => { void viewDemo(); }} />
      {demoError ? <Text style={{ ...textStyles.caption, color: colors.high }}>{demoError}</Text> : null}
    </Card>

    {recent.length > 0 ? <View style={{ gap: 13 }}>
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Đã lưu gần đây</Text><Pressable accessibilityRole="button" onPress={() => router.push('/history')} hitSlop={10}><Text style={styles.textLink}>Xem tất cả</Text></Pressable></View>
      {recent.map((record) => <Pressable key={record.id} accessibilityRole="button" accessibilityLabel={`Mở ${record.report.title}`} onPress={() => router.push({ pathname: '/report/[id]', params: { id: record.id } })}>
        <Card style={styles.recentCard}>
          <View style={styles.recentIcon}><Feather name="file-text" size={22} color={colors.forest} /></View>
          <View style={{ flex: 1, gap: 6 }}><Text numberOfLines={1} style={textStyles.label}>{record.report.title}</Text><Text style={textStyles.caption}>{record.report.pages.length} trang · {record.report.findings.length} điểm cần lưu ý</Text><SourceBadge source={record.report.source} /></View>
          <Feather name="chevron-right" size={19} color={colors.muted} />
        </Card>
      </Pressable>)}
    </View> : null}
    <View style={styles.disclaimer}><Feather name="info" size={15} color={colors.muted} /><Text style={styles.disclaimerText}>RentGuard hỗ trợ bạn hiểu hợp đồng. Kết quả AI cần được đối chiếu với bản gốc và không thay thế tư vấn pháp lý.</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 38, height: 42, borderRadius: 12, backgroundColor: colors.mint, justifyContent: 'center', alignItems: 'center' },
  brandText: { fontSize: 24, fontWeight: '800', color: colors.forest, letterSpacing: -1 }, brandDot: { color: '#75A34C' },
  intro: { gap: 12, paddingTop: 13 }, kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: colors.low },
  headline: { fontSize: 34, lineHeight: 43, fontWeight: '700', letterSpacing: -1.2, color: colors.ink },
  description: { fontSize: 15, color: colors.muted, lineHeight: 24, maxWidth: 430 },
  hero: { backgroundColor: colors.forest, borderRadius: 27, padding: 24, gap: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroIcon: { height: 51, width: 48, borderWidth: 1, borderColor: '#507267', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  aiTag: { flexDirection: 'row', gap: 6, alignItems: 'center' }, liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.mint },
  aiTagText: { color: colors.mint, fontSize: 9, letterSpacing: 1, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 27, lineHeight: 35, fontWeight: '600', letterSpacing: -0.6 },
  heroDescription: { color: '#C8D8CE', fontSize: 14, lineHeight: 23 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }, heroFootText: { fontSize: 10, color: '#C8D8CE', lineHeight: 16, flexShrink: 1 },
  steps: { flexDirection: 'row', gap: 9, paddingVertical: 4 }, step: { flex: 1, gap: 7, alignItems: 'center' },
  stepIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E9EDE1', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepNumber: { position: 'absolute', right: -4, top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.background, color: colors.muted, textAlign: 'center', fontSize: 10, fontWeight: '700' },
  stepTitle: { fontSize: 11, fontWeight: '700', color: colors.ink, textAlign: 'center' }, stepBody: { fontSize: 10, color: colors.muted, textAlign: 'center' },
  demoCard: { backgroundColor: '#EEF1E7' }, demoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textLink: { fontSize: 12, color: colors.low, fontWeight: '600' }, recentCard: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  recentIcon: { width: 43, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, disclaimerText: { fontSize: 11, lineHeight: 18, color: colors.muted, flex: 1 },
});
