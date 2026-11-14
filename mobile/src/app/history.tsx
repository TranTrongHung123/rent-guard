import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useRentGuard } from '@/state/rentguard';
import type { SavedAnalysis } from '@/types';
import { Badge, Button, Card, colors, EmptyState, Heading, IconButton, Screen, SourceBadge, textStyles } from '@/ui';

export default function HistoryScreen() {
  const { records, deleteRecord } = useRentGuard();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'openai' | 'demo'>('all');
  const [deleting, setDeleting] = useState<SavedAnalysis | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const saved = records.filter((record) => record.isSaved);
  const filtered = saved.filter((record) => (filter === 'all' || record.report.source === filter) && record.report.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try { await deleteRecord(deleting.id); setDeleting(null); }
    catch (error) { setDeleteError(error instanceof Error ? error.message : 'Chưa thể xóa báo cáo. Vui lòng thử lại.'); }
    finally { setDeleteBusy(false); }
  };

  return <>
    <Screen scroll={false} style={{ paddingBottom: 0 }}>
      <Heading kicker="TỦ HỢP ĐỒNG CỦA BẠN" title="Lịch sử đã lưu" subtitle="Báo cáo, ảnh gốc và cuộc trò chuyện được lưu trên thiết bị này để bạn xem lại." />
      <View style={styles.search}><Feather name="search" size={19} color={colors.muted} /><TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Tìm tên hợp đồng…" placeholderTextColor="#8D978E" accessibilityLabel="Tìm hợp đồng đã lưu" returnKeyType="search" /></View>
      <View style={styles.filterRow}>
        {([{ value: 'all', label: `Tất cả (${saved.length})` }, { value: 'openai', label: 'OpenAI' }, { value: 'demo', label: 'Dữ liệu mẫu' }] as const).map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)} style={[styles.filter, filter === item.value && styles.activeFilter]}><Text style={[styles.filterText, filter === item.value && styles.activeFilterText]}>{item.label}</Text></Pressable>)}
      </View>
      <FlatList data={filtered} keyExtractor={(record) => record.id} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28, gap: 13, flexGrow: filtered.length ? 0 : 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="archive" title={saved.length ? 'Chưa tìm thấy hợp đồng' : 'Chưa có hợp đồng đã lưu'} body={saved.length ? 'Thử từ khóa khác hoặc chọn bộ lọc Tất cả.' : 'Sau khi phân tích, nhấn “Lưu báo cáo” để giữ kết quả, ảnh và hội thoại tại đây.'} action={!saved.length ? <Button title="Phân tích hợp đồng đầu tiên" icon="plus" onPress={() => router.push('/capture')} /> : undefined} />}
        renderItem={({ item: record }) => {
          const highCount = record.report.findings.filter((finding) => finding.severity === 'high').length;
          return <Card style={styles.record}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mở báo cáo ${record.report.title}`} onPress={() => router.push({ pathname: '/report/[id]', params: { id: record.id } })} style={styles.recordMain}>
              <View style={styles.recordIcon}><Feather name="file-text" size={25} color={colors.forest} /></View>
              <View style={styles.recordBody}><SourceBadge source={record.report.source} /><Text numberOfLines={2} style={styles.recordTitle}>{record.report.title}</Text><Text style={textStyles.caption}>{new Date(record.report.createdAt).toLocaleDateString('vi-VN')} · {record.report.pages.length} trang</Text></View>
              <Feather name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
            <View style={styles.recordFooter}><Badge tone={highCount ? 'high' : 'neutral'}>{highCount ? `${highCount} MỨC ĐỘ CAO` : `${record.report.findings.length} ĐIỂM CẦN LƯU Ý`}</Badge><IconButton icon="trash-2" color={colors.muted} label={`Xóa báo cáo ${record.report.title}`} onPress={() => { setDeleting(record); setDeleteError(null); }} /></View>
          </Card>;
        }} />
    </Screen>
    <Modal visible={!!deleting} animationType="fade" transparent onRequestClose={() => { if (!deleteBusy) setDeleting(null); }}>
      <View style={styles.backdrop}><Card style={styles.dialog}>
        <View style={styles.deleteIcon}><Feather name="trash-2" size={25} color={colors.high} /></View>
        <Text style={textStyles.section}>Xóa báo cáo đã lưu?</Text>
        <Text style={textStyles.muted}>Báo cáo “{deleting?.report.title}”, ảnh đã lưu cùng báo cáo và cuộc trò chuyện sẽ bị xóa khỏi thiết bị này.</Text>
        {deleteError ? <Text style={{ ...textStyles.caption, color: colors.high }}>{deleteError}</Text> : null}
        <Button title="Giữ lại báo cáo" variant="ghost" disabled={deleteBusy} onPress={() => setDeleting(null)} />
        <Button title="Xóa báo cáo" variant="danger" loading={deleteBusy} onPress={() => { void confirmDelete(); }} />
      </Card></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 15, minHeight: 53 }, searchInput: { flex: 1, minHeight: 51, fontSize: 14, color: colors.ink, paddingVertical: 12 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, filter: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }, activeFilter: { backgroundColor: colors.forest, borderColor: colors.forest }, filterText: { fontSize: 12, color: colors.muted, fontWeight: '600' }, activeFilterText: { color: '#FFFFFF' },
  record: { gap: 11, padding: 17 }, recordMain: { flexDirection: 'row', gap: 14, alignItems: 'center' }, recordIcon: { width: 50, height: 63, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, recordBody: { flex: 1, gap: 7 }, recordTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.ink },
  recordFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.line, paddingTop: 10 },
  backdrop: { flex: 1, backgroundColor: '#10231BB3', justifyContent: 'center', alignItems: 'center', padding: 26 }, dialog: { width: '100%', maxWidth: 440, gap: 16 }, deleteIcon: { width: 55, height: 55, backgroundColor: '#FBEAE4', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
