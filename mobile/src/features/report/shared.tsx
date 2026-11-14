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
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Xem bằng chứng trang ${evidence.pageNumber}: ${evidence.quote}`}
      onPress={() => openEvidence(reportId, evidence)}
      style={({ pressed }) => [styles.evidence, compact && styles.compact, pressed && { opacity: 0.7 }]}>
      <View style={styles.evidenceTitle}>
        <Feather name="file-text" size={14} color={colors.low} />
        <Text style={styles.evidenceLabel}>TRANG {evidence.pageNumber}</Text>
        <Feather name="arrow-up-right" size={15} color={colors.low} />
      </View>
      <Text style={[textStyles.body, styles.quote]} numberOfLines={compact ? 3 : undefined}>“{evidence.quote}”</Text>
      {!compact ? <Text style={textStyles.caption}>Nhấn để đối chiếu ảnh hợp đồng</Text> : null}
    </Pressable>
  );
}

export function ReportUnavailable({ loading = false }: { loading?: boolean }) {
  return (
    <Screen>
      <BackHeader title="Hợp đồng" />
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.forest} /><Text style={textStyles.muted}>Đang mở hợp đồng…</Text></View>
        : <EmptyState icon="file-minus" title="Không tìm thấy báo cáo" body="Báo cáo này chưa được lưu hoặc đã bị xóa. Bạn có thể mở lại một hợp đồng trong lịch sử."
          action={<Button title="Mở lịch sử" icon="clock" onPress={() => router.replace('/history')} />} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  evidence: { backgroundColor: '#F3F6EF', borderRadius: 13, borderLeftWidth: 3, borderLeftColor: '#A8C294', padding: 14, gap: 9 },
  compact: { padding: 12 },
  evidenceTitle: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  evidenceLabel: { fontSize: 10, fontWeight: '700', color: colors.low, letterSpacing: 0.8 },
  quote: { fontSize: 14, lineHeight: 22 },
  loading: { alignItems: 'center', padding: 40, gap: 14 },
});
