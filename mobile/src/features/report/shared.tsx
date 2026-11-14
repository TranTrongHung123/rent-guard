import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Evidence, FindingCategory, Severity } from '@/types';
import { BackHeader, Button, colors, EmptyState, Screen, textStyles } from '@/ui';

export const severityNames: Record<Severity, string> = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
export const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
export const categoryNames: Record<FindingCategory, string> = {
  deposit: 'Tiền đặt cọc', rent: 'Giá thuê', fees: 'Phí phát sinh',
  termination: 'Chấm dứt hợp đồng', repairs: 'Sửa chữa', other: 'Điều khoản khác',
};

export function paramValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function formatReportDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function openEvidence(reportId: string, evidence: Evidence) {
  router.push({ pathname: '/evidence/[id]', params: { id: reportId, pageId: evidence.pageId, evidenceId: evidence.id } });
}

export function EvidenceLink({ reportId, evidence, compact = false }: {
  reportId: string; evidence: Evidence; compact?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Xem trích dẫn và ảnh gốc trang ${evidence.pageNumber}`}
    onPress={() => openEvidence(reportId, evidence)}
    style={({ pressed }) => [styles.evidence, compact && styles.compact, pressed && { opacity: 0.75 }]}>
    <View style={styles.evidenceTitle}>
      <View style={styles.pageTag}><Feather name="file-text" size={13} color={colors.primary} /><Text style={styles.evidenceLabel}>Trang {evidence.pageNumber}</Text></View>
      <View style={styles.openLabel}><Text style={styles.openText}>Ảnh gốc</Text><Feather name="arrow-up-right" size={15} color={colors.primary} /></View>
    </View>
    <Text style={[textStyles.body, styles.quote]} numberOfLines={compact ? 2 : 4}>“{evidence.quote}”</Text>
    {!compact ? <Text style={styles.hint}>Chạm để đọc đầy đủ và đối chiếu</Text> : null}
  </Pressable>;
}

export function ReportUnavailable({ loading = false }: { loading?: boolean }) {
  return <Screen><BackHeader title="Hợp đồng" />
    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={textStyles.muted}>Đang mở hợp đồng…</Text></View>
      : <EmptyState icon="file-minus" title="Không tìm thấy báo cáo" body="Báo cáo này chưa được lưu hoặc đã bị xóa. Hãy mở một hợp đồng trong lịch sử."
        action={<Button title="Mở lịch sử" icon="clock" onPress={() => router.replace('/history')} />} />}
  </Screen>;
}

const styles = StyleSheet.create({
  evidence: { backgroundColor: colors.primarySoft, borderRadius: 14, borderWidth: 1, borderColor: colors.primaryBorder, padding: 14, gap: 10 },
  compact: { padding: 12, gap: 8 }, evidenceTitle: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  pageTag: { flexDirection: 'row', alignItems: 'center', gap: 5 }, evidenceLabel: { fontSize: 12, fontWeight: '700', color: colors.primaryDeep },
  openLabel: { flexDirection: 'row', alignItems: 'center', gap: 3 }, openText: { fontSize: 11, color: colors.primaryDeep, fontWeight: '600' },
  quote: { fontSize: 14, lineHeight: 22, color: colors.ink }, hint: { fontSize: 11, lineHeight: 17, color: colors.muted },
  loading: { alignItems: 'center', padding: 40, gap: 14 },
});
