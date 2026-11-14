import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryNames, EvidenceLink, formatReportDate, paramValue, ReportUnavailable, severityNames, severityOrder } from '@/features/report/shared';
import { useRentGuard } from '@/state/rentguard';
import type { Finding, Severity } from '@/types';
import { BackHeader, Badge, Button, Card, colors, Screen, SourceBadge, textStyles } from '@/ui';

function FindingCard({ finding, reportId, index }: { finding: Finding; reportId: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyQuestion() {
    try {
      await Clipboard.setStringAsync(finding.suggestedQuestion, { android: { isSensitive: true } });
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <Card style={styles.finding}>
      <View style={styles.findingMeta}>
        <Badge tone={finding.severity}>MỨC ĐỘ {severityNames[finding.severity].toLocaleUpperCase('vi-VN')}</Badge>
        <Text style={textStyles.caption}>{categoryNames[finding.category]}</Text>
      </View>
      <Text style={styles.findingNumber}>ĐIỂM CẦN LƯU Ý {String(index + 1).padStart(2, '0')}</Text>
      <Text accessibilityRole="header" style={styles.findingTitle}>{finding.title}</Text>
      <View style={styles.explanation}>
        <Text style={textStyles.label}>Vì sao cần lưu ý?</Text>
        <Text selectable style={textStyles.body}>{finding.reason}</Text>
        <Text selectable style={textStyles.muted}>{finding.explanation}</Text>
      </View>
      <Text style={styles.label}>BẰNG CHỨNG TRONG HỢP ĐỒNG</Text>
      {finding.evidence.map(evidence => <EvidenceLink key={evidence.id} reportId={reportId} evidence={evidence} />)}
      <View style={styles.questionBox}>
        <View style={styles.questionTitle}>
          <Feather name="message-square" size={16} color={colors.forest} />
          <Text style={textStyles.label}>Nên hỏi chủ nhà</Text>
        </View>
        <Text selectable style={textStyles.body}>{finding.suggestedQuestion}</Text>
        <View style={styles.questionActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sao chép câu hỏi" onPress={() => void copyQuestion()} style={styles.smallAction}>
            <Feather name={copied ? 'check' : 'copy'} size={15} color={colors.forest} />
            <Text style={styles.actionLabel}>{copied ? 'Đã sao chép' : 'Sao chép'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Hỏi AI về điều khoản này"
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: reportId, question: `Giải thích rõ hơn về vấn đề: ${finding.title}` } })}
            style={styles.smallAction}>
            <Feather name="help-circle" size={15} color={colors.forest} />
            <Text style={styles.actionLabel}>Hỏi AI</Text>
          </Pressable>
        </View>
        {copyError ? <Text accessibilityRole="alert" style={styles.error}>Chưa sao chép được. Bạn có thể nhấn giữ để chọn câu hỏi.</Text> : null}
      </View>
    </Card>
  );
}

export default function ReportScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramValue(params.id);
  const { getRecord, ready, saveRecord } = useRentGuard();
  const record = getRecord(id);
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const findings = useMemo(() => [...(record?.report.findings ?? [])].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]), [record?.report.findings]);
  if (!ready || !record) return <ReportUnavailable loading={!ready} />;
  const { report } = record;
  const counts = { high: 0, medium: 0, low: 0 };
  findings.forEach(finding => counts[finding.severity]++);
  const filtered = findings.filter(finding => filter === 'all' || finding.severity === filter);
  const readableCount = report.pages.filter(page => page.status !== 'unreadable').length;

  async function save() {
    setSaving(true);
    setSaveError(null);
    try { await saveRecord(id); } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Chưa lưu được báo cáo. Hãy thử lại.');
    } finally { setSaving(false); }
  }

  return (
    <Screen>
      <BackHeader title="Báo cáo hợp đồng" subtitle={`${report.pages.length} trang · ${formatReportDate(report.createdAt)}`} />
      <View style={styles.titleSection}>
        <SourceBadge source={report.source} />
        <Text accessibilityRole="header" style={textStyles.title}>{report.title}</Text>
        {report.source === 'demo' ? <Text style={textStyles.muted}>Đây là hợp đồng và kết quả minh họa được chuẩn bị sẵn, chưa được phân tích bằng OpenAI.</Text>
          : <Text style={textStyles.caption}>Phân tích từ ảnh hợp đồng của bạn{report.model ? ` · ${report.model}` : ''}</Text>}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryIcon}><Feather name="shield" color={colors.forest} size={25} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.summaryKicker}>TỔNG QUAN HỢP ĐỒNG</Text>
            <Text style={styles.summaryTitle}>{findings.length} điểm cần lưu ý</Text>
          </View>
        </View>
        <Text selectable style={styles.summaryText}>{report.summary}</Text>
        <View style={styles.summaryBottom}>
          <Feather name="file-text" color="#C7D7CE" size={14} />
          <Text style={styles.summaryFootnote}>Đã đọc được nội dung ở {readableCount}/{report.pages.length} trang</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button title={record.isSaved ? 'Đã lưu trong lịch sử' : 'Lưu báo cáo'} icon={record.isSaved ? 'check' : 'bookmark'}
          variant="secondary" loading={saving} disabled={record.isSaved} onPress={() => void save()} />
        <Button title="Hỏi AI về hợp đồng" icon="message-circle" onPress={() => router.push({ pathname: '/chat/[id]', params: { id } })} />
        {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
      </View>

      {report.warnings.length > 0 ? <Card style={styles.warningCard}>
        <View style={styles.questionTitle}><Feather name="alert-triangle" size={18} color={colors.medium} /><Text style={textStyles.label}>Lưu ý về chất lượng phân tích</Text></View>
        {report.warnings.map((warning, index) => <Text key={`${index}-${warning}`} style={textStyles.body}>• {warning}</Text>)}
      </Card> : null}

      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={textStyles.section}>Chi tiết cần xem trước khi ký</Text>
        <Text style={textStyles.muted}>Sắp xếp theo mức độ ưu tiên. Nhấn trích dẫn để kiểm tra trên ảnh gốc.</Text>
      </View>
      <View style={styles.stats}>
        {(['high', 'medium', 'low'] as const).map(severity => <Pressable key={severity}
          accessibilityRole="button" accessibilityLabel={`Lọc ${counts[severity]} điểm mức độ ${severityNames[severity]}`}
          accessibilityState={{ selected: filter === severity }}
          onPress={() => setFilter(filter === severity ? 'all' : severity)}
          style={[styles.stat, { borderColor: filter === severity ? colors[severity] : colors.line }]}>
          <Text style={[styles.statNumber, { color: colors[severity] }]}>{counts[severity]}</Text>
          <Text style={styles.statLabel}>{severityNames[severity]}</Text>
        </Pressable>)}
      </View>
      <View style={styles.filterRow}>
        <Text style={textStyles.caption}>Đang xem {filtered.length}/{findings.length} điểm</Text>
        {filter !== 'all' ? <Pressable accessibilityRole="button" onPress={() => setFilter('all')} style={styles.smallAction}>
          <Text style={styles.actionLabel}>Xem tất cả</Text><Feather name="x" size={14} color={colors.forest} />
        </Pressable> : <Text style={textStyles.caption}>Tất cả mức độ</Text>}
      </View>
      {filtered.map(finding => <FindingCard key={finding.id} finding={finding} reportId={id} index={findings.indexOf(finding)} />)}
      {filtered.length === 0 ? <Card>
        <Feather name="check-circle" color={colors.low} size={26} />
        <Text style={textStyles.label}>{filter === 'all' ? 'Chưa phát hiện điểm cần lưu ý' : `Không có điểm mức độ ${severityNames[filter].toLocaleLowerCase('vi-VN')}`}</Text>
        <Text style={textStyles.muted}>Kết quả phụ thuộc vào những trang bạn đã cung cấp và nội dung AI đọc được. Bạn vẫn nên đối chiếu toàn bộ hợp đồng trước khi ký.</Text>
      </Card> : null}

      {report.missingInformation.length > 0 ? <Card>
        <View style={styles.questionTitle}><Feather name="help-circle" color={colors.medium} size={19} /><Text accessibilityRole="header" style={textStyles.section}>Thông tin cần làm rõ</Text></View>
        <Text style={textStyles.muted}>Chưa đủ nội dung để xác định các mục sau. Hãy hỏi chủ nhà hoặc bổ sung trang hợp đồng.</Text>
        {report.missingInformation.map((item, index) => <View key={`${index}-${item}`} style={styles.missingItem}>
          <View style={styles.dot} /><Text style={[textStyles.body, { flex: 1 }]}>{item}</Text>
        </View>)}
      </Card> : null}

      <Button title="Xem tất cả trang hợp đồng" icon="layers" variant="ghost" onPress={() => router.push({ pathname: '/evidence/[id]', params: { id } })} />
      <Text style={styles.disclaimer}>RentGuard giúp bạn hiểu và đặt câu hỏi về hợp đồng. Kết quả AI có thể sai; hãy kiểm tra trích dẫn và tìm tư vấn chuyên môn khi cần.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleSection: { gap: 11 }, summary: { backgroundColor: colors.forest, padding: 23, borderRadius: 25, gap: 18 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 14 }, summaryIcon: { width: 52, height: 52, backgroundColor: colors.mint, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  summaryKicker: { color: '#BCD0C2', fontSize: 10, letterSpacing: 1.4, fontWeight: '700' }, summaryTitle: { fontSize: 23, lineHeight: 30, color: '#FFFFFF', fontWeight: '700', letterSpacing: -0.5 },
  summaryText: { color: '#E9EFE7', fontSize: 15, lineHeight: 24 }, summaryBottom: { flexDirection: 'row', gap: 7, borderTopWidth: 1, borderTopColor: '#416157', paddingTop: 15, alignItems: 'center' }, summaryFootnote: { flex: 1, color: '#C7D7CE', fontSize: 12, lineHeight: 18 },
  actions: { gap: 10 }, warningCard: { backgroundColor: '#FFF8E8', borderColor: '#ECDDAB' }, sectionHeader: { gap: 8 }, stats: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, borderWidth: 1.5, borderRadius: 17, backgroundColor: '#FFFFFF', paddingVertical: 15, paddingHorizontal: 8, alignItems: 'center', gap: 5 }, statNumber: { fontSize: 28, lineHeight: 34, fontWeight: '700' }, statLabel: { fontSize: 12, color: colors.muted },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -8 }, finding: { gap: 14 }, findingMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 }, findingNumber: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, marginTop: 4 },
  findingTitle: { fontSize: 22, fontWeight: '700', color: colors.ink, lineHeight: 30, letterSpacing: -0.5 }, explanation: { gap: 8 }, label: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 0.9, marginTop: 6 }, questionBox: { backgroundColor: '#EDF3E5', borderRadius: 15, padding: 15, gap: 11 },
  questionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 }, questionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 17 }, smallAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }, actionLabel: { color: colors.forest, fontSize: 12, fontWeight: '700' },
  error: { color: colors.high, fontSize: 13, lineHeight: 20 }, missingItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, dot: { width: 5, height: 5, backgroundColor: colors.medium, borderRadius: 3, marginTop: 9 }, disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', paddingHorizontal: 9 },
});
