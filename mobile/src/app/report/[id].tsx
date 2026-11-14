import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { analysisProvenance } from '@/domain/analysis';
import { categoryNames, EvidenceLink, formatReportDate, paramValue, ReportUnavailable, severityNames, severityOrder } from '@/features/report/shared';
import { useRentGuard } from '@/state/rentguard';
import type { Finding, Severity } from '@/types';
import { BackHeader, Badge, Button, Card, colors, Notice, Screen, SourceBadge, textStyles } from '@/ui';

function FindingCard({ finding, reportId, index }: { finding: Finding; reportId: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyQuestion() {
    try {
      await Clipboard.setStringAsync(finding.suggestedQuestion, { android: { isSensitive: true } });
      setCopied(true); setCopyError(false);
    } catch { setCopyError(true); }
  }
  return <Card style={styles.finding}>
    <View style={styles.findingMeta}><View style={styles.number}><Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text></View>
      <Text style={[textStyles.caption, { flex: 1 }]}>{categoryNames[finding.category]}</Text>
      <Badge tone={finding.severity}>{severityNames[finding.severity]}</Badge>
    </View>
    <Text accessibilityRole="header" style={styles.findingTitle}>{finding.title}</Text>
    <View style={styles.explanation}><Text style={textStyles.label}>Vì sao cần lưu ý?</Text><Text selectable style={textStyles.body}>{finding.reason}</Text><Text selectable style={textStyles.muted}>{finding.explanation}</Text></View>
    <View style={styles.evidenceSection}><Text style={styles.eyebrow}>TRÍCH TỪ HỢP ĐỒNG</Text>
      {finding.evidence.map(evidence => <EvidenceLink key={evidence.id} reportId={reportId} evidence={evidence} />)}
    </View>
    <View style={styles.questionBox}>
      <View style={styles.inline}><Feather name="message-square" size={16} color={colors.primary} /><Text style={textStyles.label}>Trao đổi với chủ nhà</Text></View>
      <Text selectable style={textStyles.body}>{finding.suggestedQuestion}</Text>
      <View style={styles.questionActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Sao chép câu hỏi" onPress={() => void copyQuestion()} style={styles.smallAction}>
          <Feather name={copied ? 'check' : 'copy'} size={16} color={colors.primary} /><Text style={styles.actionLabel}>{copied ? 'Đã sao chép' : 'Sao chép'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Hỏi AI về điều khoản này" style={styles.smallAction}
          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: reportId, question: `Giải thích rõ hơn về vấn đề: ${finding.title}` } })}>
          <Feather name="help-circle" size={16} color={colors.primary} /><Text style={styles.actionLabel}>Giải thích thêm</Text>
        </Pressable>
      </View>
      {copyError ? <Text accessibilityRole="alert" style={styles.error}>Chưa sao chép được. Bạn có thể nhấn giữ để chọn câu hỏi.</Text> : null}
    </View>
  </Card>;
}

function ReportDetails({ id }: { id: string }) {
  const { getRecord, ready, saveRecord, reanalyzeRecord, analysisState, cancelAnalysis, error, clearError } = useRentGuard();
  const record = getRecord(id);
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const findings = useMemo(() => [...(record?.report.findings ?? [])].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]), [record?.report.findings]);
  if (!ready || !record) return <ReportUnavailable loading={!ready} />;
  const { report } = record;
  const counts = { high: 0, medium: 0, low: 0 };
  findings.forEach(finding => counts[finding.severity]++);
  const filtered = findings.filter(finding => filter === 'all' || finding.severity === filter);
  const incompletePages = report.pages.filter(page => page.status !== 'readable').length;
  const provenance = analysisProvenance(report);

  async function save() {
    if (saving) return;
    setSaving(true); setSaveError(null);
    try { await saveRecord(id); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Chưa lưu được báo cáo. Hãy thử lại.'); }
    finally { setSaving(false); }
  }

  async function refresh() {
    if (refreshBusy || analysisState !== 'idle') return;
    setRefreshBusy(true);
    try {
      const newId = await reanalyzeRecord(id);
      if (newId) { setConfirmRefresh(false); router.push({ pathname: '/report/[id]', params: { id: newId } }); }
    } finally { setRefreshBusy(false); }
  }

  return <Screen footer={<View style={styles.footer}>
    {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
    <View style={styles.footerButtons}>
      <Button title={record.isSaved ? 'Đã lưu' : 'Lưu báo cáo'} icon={record.isSaved ? 'check' : 'bookmark'} variant="secondary" compact loading={saving} disabled={record.isSaved} onPress={() => void save()} style={{ flex: 1.25 }} />
      <Button title="Hỏi AI" icon="message-circle" compact onPress={() => router.push({ pathname: '/chat/[id]', params: { id } })} style={{ flex: 1 }} />
    </View>
  </View>}>
    <BackHeader title="Báo cáo hợp đồng" subtitle={`${report.pages.length} trang · ${formatReportDate(report.createdAt)}`} />
    <View style={styles.titleSection}><SourceBadge source={report.source} /><Text accessibilityRole="header" style={textStyles.title}>{report.title}</Text></View>
    {report.source === 'openai' && !record.isSaved ? <Notice tone="warning" title="Báo cáo chưa được lưu trên máy">Kết quả vẫn đang mở trong phiên này. Hãy nhấn Lưu báo cáo và kiểm tra dung lượng điện thoại trước khi đóng ứng dụng.</Notice> : null}
    {report.source === 'openai' && report.analysis && report.analysis.reuse !== 'none' ? <Notice title={provenance.title}>{provenance.description}</Notice> : null}
    {report.source === 'demo' ? <Notice tone="warning" title="Bạn đang xem dữ liệu mẫu">Hợp đồng và kết quả được chuẩn bị sẵn, không phải phân tích từ OpenAI.</Notice> : null}

    <View style={styles.summary}>
      <View style={styles.summaryTop}><View style={styles.summaryIcon}><Feather name="file-text" color={colors.onPrimary} size={24} /></View><View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.summaryKicker}>CẦN XEM TRƯỚC KHI KÝ</Text><Text style={styles.summaryTitle}>{findings.length} điểm cần lưu ý</Text>
      </View></View>
      <Text selectable style={styles.summaryText}>{report.summary}</Text>
      <View style={styles.summaryBottom}><Feather name="layers" color={colors.onPrimaryMuted} size={14} /><Text style={styles.summaryFootnote}>{report.pages.length} trang đã rà soát{incompletePages ? ` · ${incompletePages} trang cần kiểm tra lại` : ''}</Text></View>
    </View>

    <View style={styles.stats}>
      {(['high', 'medium', 'low'] as const).map(severity => <Pressable key={severity} accessibilityRole="button" accessibilityLabel={`Lọc ${counts[severity]} điểm mức độ ${severityNames[severity]}`} accessibilityState={{ selected: filter === severity }}
        onPress={() => setFilter(filter === severity ? 'all' : severity)} style={[styles.stat, filter === severity && { borderColor: colors[severity], borderWidth: 2 }]}>
        <View style={[styles.statDot, { backgroundColor: colors[severity] }]} /><Text style={[styles.statNumber, { color: colors[severity] }]}>{counts[severity]}</Text><Text style={styles.statLabel}>{severityNames[severity]}</Text>
      </Pressable>)}
    </View>

    {report.warnings.length > 0 ? <View style={styles.qualitySection}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showWarnings }} accessibilityLabel="Lưu ý về độ đầy đủ của báo cáo" onPress={() => setShowWarnings(value => !value)} style={styles.qualityToggle}>
        <Feather name={incompletePages ? 'alert-triangle' : 'info'} size={18} color={incompletePages ? colors.medium : colors.primary} />
        <View style={{ flex: 1, gap: 3 }}><Text style={textStyles.label}>{incompletePages ? `${incompletePages} trang chưa đọc đầy đủ` : 'Luôn đối chiếu bằng chứng trước khi ký'}</Text><Text style={textStyles.caption}>Xem lưu ý về chất lượng phân tích</Text></View>
        <Feather name={showWarnings ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {showWarnings ? <View style={styles.qualityContent}>{report.warnings.map((warning, index) => <Text key={`${index}-${warning}`} style={textStyles.muted}>• {warning}</Text>)}</View> : null}
    </View> : null}

    <View style={styles.sectionHeading}><View style={{ flex: 1, gap: 5 }}><Text accessibilityRole="header" style={textStyles.section}>Chi tiết cần trao đổi</Text><Text style={textStyles.caption}>Ưu tiên cao được hiển thị trước.</Text></View>
      {filter !== 'all' ? <Pressable accessibilityRole="button" onPress={() => setFilter('all')} style={styles.smallAction}><Text style={styles.actionLabel}>Tất cả</Text><Feather name="x" size={14} color={colors.primary} /></Pressable> : null}
    </View>
    <Text style={styles.resultCount}>Đang xem {filtered.length}/{findings.length} điểm{filter !== 'all' ? ` · Mức ${severityNames[filter].toLocaleLowerCase('vi-VN')}` : ''}</Text>
    {filtered.map(finding => <FindingCard key={finding.id} finding={finding} reportId={id} index={findings.indexOf(finding)} />)}
    {filtered.length === 0 ? <Card><Feather name="file-text" color={colors.primary} size={25} /><Text style={textStyles.label}>{filter === 'all' ? 'Chưa có điểm đủ bằng chứng để hiển thị' : `Không có điểm mức ${severityNames[filter].toLocaleLowerCase('vi-VN')}`}</Text><Text style={textStyles.muted}>Đây không phải xác nhận hợp đồng an toàn. Bạn vẫn nên đối chiếu toàn bộ các trang trước khi ký.</Text></Card> : null}

    {report.missingInformation.length > 0 ? <Card><View style={styles.inline}><Feather name="help-circle" color={colors.accent} size={19} /><Text accessibilityRole="header" style={textStyles.section}>Câu hỏi để kiểm tra thêm</Text></View><Text style={textStyles.muted}>Đối chiếu các mục này trong hợp đồng và xác nhận với chủ nhà.</Text>
      {report.missingInformation.map((item, index) => <View key={`${index}-${item}`} style={styles.missingItem}><View style={styles.dot} /><Text style={[textStyles.body, { flex: 1 }]}>{item}</Text></View>)}
    </Card> : null}
    <Button title="Xem các trang hợp đồng" icon="layers" variant="ghost" onPress={() => router.push({ pathname: '/evidence/[id]', params: { id } })} />
    {report.source === 'openai' ? <Card>
      <View style={styles.inline}><Feather name="check-circle" color={colors.primary} size={18} /><Text style={textStyles.label}>{provenance.title}</Text></View>
      <Text style={textStyles.muted}>{provenance.description}</Text>
      <Text style={textStyles.caption}>Phân tích gốc: {formatReportDate(report.analysis?.analyzedAt ?? report.createdAt)}{report.analysis ? ` · Bộ quy tắc ${report.analysis.version.replace('rentguard-', '')}` : ''}</Text>
      <Button title="Đọc lại từ ảnh" icon="refresh-cw" variant="ghost" disabled={analysisState !== 'idle'} onPress={() => { clearError(); setConfirmRefresh(true); }} />
    </Card> : null}
    <Text style={styles.disclaimer}>Kết quả hỗ trợ bạn hiểu hợp đồng, không thay thế tư vấn pháp lý.{report.source === 'openai' && report.model ? ` Phân tích bằng ${report.model}.` : ''}</Text>
    <Modal visible={confirmRefresh} transparent animationType="fade" onRequestClose={() => refreshBusy ? cancelAnalysis() : setConfirmRefresh(false)}>
      <View style={styles.modalBackdrop}><ScrollView contentContainerStyle={styles.modalContent}><Card style={styles.modalCard}>
        <Text accessibilityRole="header" style={textStyles.section}>{refreshBusy ? 'Đang đọc lại hợp đồng' : 'Tạo một lần phân tích mới?'}</Text>
        <Text style={textStyles.muted}>Ảnh gốc sẽ được gửi lại đến máy chủ và OpenAI, có thể phát sinh chi phí API. Kết quả mới có thể khác do AI đọc và đánh giá lại. Báo cáo hiện tại được giữ nguyên.</Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button title={refreshBusy ? (analysisState === 'preparing' ? 'Đang chuẩn bị ảnh…' : analysisState === 'saving' ? 'Đang lưu báo cáo…' : 'Đang đọc và kiểm chứng…') : 'Đọc lại bằng OpenAI'} icon="refresh-cw" loading={refreshBusy} onPress={() => void refresh()} />
        <Button title={refreshBusy ? 'Hủy đọc lại' : 'Giữ kết quả hiện tại'} variant="ghost" disabled={analysisState === 'saving'} onPress={() => { if (refreshBusy) cancelAnalysis(); else setConfirmRefresh(false); }} />
      </Card></ScrollView></View>
    </Modal>
  </Screen>;
}

export default function ReportScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramValue(params.id);
  return <ReportDetails key={id} id={id} />;
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: '#0B1D4280' }, modalContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, modalCard: { width: '100%', maxWidth: 480, gap: 16 },
  titleSection: { gap: 12 }, summary: { backgroundColor: colors.primaryDeep, padding: 22, borderRadius: 24, gap: 16 }, summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 13 }, summaryIcon: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#FFFFFF33', alignItems: 'center', justifyContent: 'center' }, summaryKicker: { color: colors.onPrimaryMuted, fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 1 }, summaryTitle: { color: colors.onPrimary, fontSize: 25, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 }, summaryText: { color: colors.onPrimaryMuted, fontSize: 14, lineHeight: 23 }, summaryBottom: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#FFFFFF26' }, summaryFootnote: { flex: 1, color: colors.onPrimaryMuted, fontSize: 12, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 17, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', gap: 4 }, statDot: { height: 5, width: 20, borderRadius: 3, marginBottom: 3 }, statNumber: { fontSize: 27, lineHeight: 34, fontWeight: '700' }, statLabel: { color: colors.muted, fontSize: 12, lineHeight: 18 }, qualitySection: { backgroundColor: colors.surfaceAlt, borderRadius: 15, borderWidth: 1, borderColor: colors.line }, qualityToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 68, padding: 14 }, qualityContent: { borderTopWidth: 1, borderTopColor: colors.line, padding: 15, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, resultCount: { marginTop: -10, fontSize: 12, color: colors.muted }, finding: { gap: 16 }, findingMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' }, number: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }, numberText: { color: colors.primaryDeep, fontSize: 11, fontWeight: '700' }, findingTitle: { fontSize: 21, lineHeight: 29, color: colors.ink, fontWeight: '700', letterSpacing: -0.3 }, explanation: { gap: 8 }, evidenceSection: { gap: 10 }, eyebrow: { fontSize: 10, lineHeight: 17, color: colors.muted, fontWeight: '700', letterSpacing: 1 }, questionBox: { borderRadius: 15, backgroundColor: colors.surfaceAlt, padding: 15, gap: 12 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, questionActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 }, smallAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9 }, actionLabel: { color: colors.primary, fontSize: 12, fontWeight: '700' }, error: { color: colors.high, fontSize: 13, lineHeight: 20 }, missingItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 9 }, disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' }, footer: { gap: 10 }, footerButtons: { flexDirection: 'row', gap: 10 },
});
