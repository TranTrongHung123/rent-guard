import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useRentGuard } from '@/state/rentguard';
import type { SavedAnalysis } from '@/types';
import { Badge, Button, Card, colors, EmptyState, Heading, IconButton, Notice, Screen, SourceBadge, textStyles } from '@/ui';

export default function HistoryScreen() {
  const { records, deleteRecord, clearError } = useRentGuard();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'openai' | 'demo'>('all');
  const [deleting, setDeleting] = useState<SavedAnalysis | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const saved = records.filter(record => record.isSaved);
  const filtered = saved.filter(record => (filter === 'all' || record.report.source === filter) && record.report.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError(null); clearError();
    try { await deleteRecord(deleting.id); setDeleting(null); }
    catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Chưa xóa được báo cáo. Hãy thử lại.'); clearError(); }
    finally { setDeleteBusy(false); }
  }

  const header = <View style={styles.header}>
    <Heading title="Lịch sử hợp đồng" subtitle="Báo cáo và cuộc trò chuyện đã lưu trên thiết bị." />
    <View style={styles.search}><Feather name="search" size={20} color={colors.muted} />
      <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Tìm tên hợp đồng" placeholderTextColor={colors.muted} accessibilityLabel="Tìm hợp đồng đã lưu" returnKeyType="search" autoCorrect={false} />
      {query ? <IconButton icon="x" label="Xóa từ khóa tìm kiếm" onPress={() => setQuery('')} /> : null}
    </View>
    <View style={styles.filterRow}>
      {([{ value: 'all', label: `Tất cả · ${saved.length}` }, { value: 'openai', label: 'OpenAI' }, { value: 'demo', label: 'Dữ liệu mẫu' }] as const).map(item => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)} style={[styles.filter, filter === item.value && styles.activeFilter]}><Text style={[styles.filterText, filter === item.value && styles.activeFilterText]}>{item.label}</Text></Pressable>)}
    </View>
    {filtered.length > 0 ? <Text style={textStyles.caption}>{filtered.length} hợp đồng{query.trim() ? ' phù hợp' : ' đã lưu'}</Text> : null}
  </View>;

  return <>
    <Screen scroll={false} style={styles.screen}>
      <FlatList data={filtered} keyExtractor={record => record.id} style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="folder" title={saved.length ? 'Chưa tìm thấy hợp đồng' : 'Hợp đồng đã lưu sẽ ở đây'} body={saved.length ? 'Thử từ khóa khác hoặc đổi bộ lọc để tìm lại báo cáo.' : 'Phân tích hợp đồng rồi nhấn Lưu báo cáo để xem lại ảnh, kết quả và hội thoại.'} action={saved.length ? <Button title="Xóa bộ lọc" variant="ghost" onPress={() => { setFilter('all'); setQuery(''); }} /> : <Button title="Thêm hợp đồng" icon="plus" onPress={() => router.push('/capture')} />} />}
        renderItem={({ item: record }) => {
          const highCount = record.report.findings.filter(finding => finding.severity === 'high').length;
          const date = new Date(record.report.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          return <Card style={styles.record}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mở báo cáo ${record.report.title}, ${date}`} onPress={() => router.push({ pathname: '/report/[id]', params: { id: record.id } })} style={({ pressed }) => [styles.recordMain, pressed && styles.pressed]}>
              <View style={styles.recordIcon}><Feather name="file-text" size={24} color={colors.primary} /></View>
              <View style={styles.recordBody}><Text style={styles.recordTitle}>{record.report.title}</Text><Text style={textStyles.caption}>{date}</Text><Text style={textStyles.caption}>{record.report.pages.length} trang · {Math.floor(record.messages.length / 2)} lượt trao đổi</Text></View>
              <Feather name="chevron-right" size={19} color={colors.primary} />
            </Pressable>
            <View style={styles.recordFooter}><View style={styles.recordBadges}><SourceBadge source={record.report.source} /><Badge tone={highCount ? 'high' : 'neutral'}>{highCount ? `${highCount} ưu tiên cao` : `${record.report.findings.length} điểm cần lưu ý`}</Badge></View><IconButton icon="trash-2" color={colors.muted} label={`Xóa báo cáo ${record.report.title}`} onPress={() => { setDeleting(record); setDeleteError(null); }} /></View>
          </Card>;
        }} />
    </Screen>
    <Modal visible={!!deleting} animationType="fade" transparent onRequestClose={() => { if (!deleteBusy) setDeleting(null); }}>
      <View style={styles.backdrop}><ScrollView contentContainerStyle={styles.dialogContainer}><Card style={styles.dialog}>
        <View style={styles.deleteIcon}><Feather name="trash-2" size={25} color={colors.high} /></View>
        <Text style={textStyles.section}>Xóa hợp đồng này?</Text>
        <Text style={textStyles.muted}>Báo cáo “{deleting?.report.title}”, ảnh và hội thoại kèm theo sẽ bị xóa khỏi thiết bị.</Text>
        {deleteError ? <Notice tone="error"><Text style={textStyles.body}>{deleteError}</Text></Notice> : null}
        <Button title="Giữ lại hợp đồng" variant="ghost" disabled={deleteBusy} onPress={() => setDeleting(null)} />
        <Button title="Xóa hợp đồng" variant="danger" loading={deleteBusy} onPress={() => void confirmDelete()} />
      </Card></ScrollView></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  screen: { padding: 0, paddingBottom: 0, gap: 0 }, list: { flex: 1, width: '100%' }, listContent: { padding: 20, paddingBottom: 28, gap: 14 }, header: { gap: 16, paddingBottom: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingLeft: 15, paddingRight: 6, minHeight: 54 }, searchInput: { flex: 1, minWidth: 0, minHeight: 52, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, filter: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface }, activeFilter: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { fontSize: 13, lineHeight: 20, color: colors.muted, fontWeight: '600' }, activeFilterText: { color: colors.onPrimary },
  record: { gap: 13, padding: 16 }, recordMain: { flexDirection: 'row', gap: 12, alignItems: 'center' }, recordIcon: { width: 47, height: 58, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, recordBody: { flex: 1, minWidth: 0, gap: 4 }, recordTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.ink },
  recordFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: colors.line, paddingTop: 10 }, recordBadges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, pressed: { opacity: 0.72 },
  backdrop: { flex: 1, backgroundColor: colors.overlay }, dialogContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, dialog: { width: '100%', maxWidth: 440, gap: 16 }, deleteIcon: { width: 54, height: 54, backgroundColor: colors.highSoft, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
