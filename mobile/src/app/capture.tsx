import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRentGuard } from '@/state/rentguard';
import { BackHeader, Badge, Button, Card, colors, IconButton, Screen, textStyles } from '@/ui';

export default function CaptureScreen() {
  const { draftPages, pickImages, removePage, movePage, clearDraft, analyze, analysisState, cancelAnalysis } = useRentGuard();
  const [picking, setPicking] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const analyzing = analysisState !== 'idle';
  const busy = picking || analyzing;
  const previewIndex = draftPages.findIndex((page) => page.id === previewId);
  const preview = draftPages[previewIndex];
  const hasUnreadableImage = draftPages.some((page) => failedImages.includes(page.id));

  const chooseImages = async (source: 'camera' | 'library') => {
    setPicking(true);
    setActionError(null);
    try { await pickImages(source); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Chưa thể mở ảnh. Vui lòng thử lại.'); }
    finally { setPicking(false); }
  };
  const startAnalysis = async () => {
    setActionError(null);
    try {
      const id = await analyze();
      if (id) router.push({ pathname: '/report/[id]', params: { id } });
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Chưa thể phân tích hợp đồng. Vui lòng thử lại.'); }
  };

  return <>
    <Screen>
      <BackHeader title="Thêm hợp đồng" subtitle="Ảnh rõ nét giúp kết quả đáng tin cậy hơn" />
      <View style={styles.progress}><View style={styles.progressActive} /><View style={styles.progressInactive} /><View style={styles.progressInactive} /></View>
      <View style={{ gap: 9 }}><Badge tone="mint">BƯỚC 01 · CHUẨN BỊ ẢNH</Badge>
        <Text accessibilityRole="header" style={styles.title}>Từng trang,{`\n`}đầy đủ và rõ ràng.</Text>
        <Text style={textStyles.muted}>Thêm toàn bộ các trang, gồm phụ lục và chữ ký. Bạn có thể kiểm tra ảnh và đổi thứ tự trước khi gửi.</Text>
      </View>

      <View style={styles.pickerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh hợp đồng" disabled={busy} style={({ pressed }) => [styles.picker, busy && styles.disabled, pressed && { opacity: 0.7 }]} onPress={() => { void chooseImages('camera'); }}>
          <View style={styles.pickerIcon}><Feather name="camera" size={27} color={colors.forest} /></View><Text style={styles.pickerTitle}>Chụp ảnh</Text><Text style={styles.pickerBody}>Từng trang hợp đồng</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Chọn nhiều ảnh từ thư viện" disabled={busy} style={({ pressed }) => [styles.picker, busy && styles.disabled, pressed && { opacity: 0.7 }]} onPress={() => { void chooseImages('library'); }}>
          <View style={styles.pickerIcon}><Feather name="image" size={27} color={colors.forest} /></View><Text style={styles.pickerTitle}>Thư viện ảnh</Text><Text style={styles.pickerBody}>Chọn nhiều trang</Text>
        </Pressable>
      </View>
      {picking ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={colors.forest} /><Text style={textStyles.muted}>Đang chuẩn bị ảnh…</Text></View> : null}
      {actionError ? <Card style={styles.error}><Text style={{ ...textStyles.body, color: colors.high }}>{actionError}</Text></Card> : null}

      {draftPages.length ? <View style={{ gap: 13 }}>
        <View style={styles.sectionRow}><Text style={textStyles.section}>Các trang đã thêm <Text style={styles.count}>({draftPages.length})</Text></Text>
          <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Xóa tất cả ảnh đã chọn" hitSlop={10} onPress={() => setConfirmClear(true)}><Text style={styles.deleteAll}>Xóa tất cả</Text></Pressable></View>
        <Text style={textStyles.caption}>Nhấn ảnh để xem rõ hơn. Dùng mũi tên để sắp xếp đúng thứ tự.</Text>
        {draftPages.map((page, index) => <Card key={page.id} style={styles.pageCard}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Xem trước trang ${index + 1}`} onPress={() => setPreviewId(page.id)} style={styles.thumbnail}>
            {failedImages.includes(page.id) ? <Feather name="image" size={26} color={colors.high} /> : <Image source={{ uri: page.uri }} style={styles.thumbnailImage} resizeMode="cover" onError={() => setFailedImages((current) => current.includes(page.id) ? current : [...current, page.id])} />}
            <View style={styles.pageNumber}><Text style={styles.pageNumberText}>{index + 1}</Text></View>
          </Pressable>
          <View style={styles.pageBody}><Text style={styles.pageTitle}>Trang {index + 1}</Text>
            <Text style={textStyles.caption}>{failedImages.includes(page.id) ? 'Ảnh không mở được · hãy chọn lại' : `${page.width} × ${page.height} · JPEG`}</Text>
            <View style={styles.pageControls}>
              <IconButton icon="arrow-up" label={`Chuyển trang ${index + 1} lên trước`} disabled={busy || index === 0} onPress={() => movePage(page.id, -1)} />
              <IconButton icon="arrow-down" label={`Chuyển trang ${index + 1} xuống sau`} disabled={busy || index === draftPages.length - 1} onPress={() => movePage(page.id, 1)} />
              <View style={{ flex: 1 }} /><IconButton icon="trash-2" label={`Xóa trang ${index + 1}`} disabled={busy} color={colors.high} onPress={() => removePage(page.id)} />
            </View>
          </View>
        </Card>)}
      </View> : <View style={styles.empty}>
        <Feather name="layers" size={35} color="#91A28A" /><Text style={styles.emptyTitle}>Hợp đồng của bạn sẽ ở đây</Text><Text style={styles.emptyBody}>Đặt giấy trên nền phẳng, chụp đủ bốn góc và tránh bóng hoặc ánh sáng chói.</Text>
      </View>}

      {analyzing ? <Card style={styles.analysisCard}>
        <ActivityIndicator size="large" color={colors.forest} />
        <Text style={styles.analysisTitle}>{analysisState === 'preparing' ? 'Đang chuẩn bị hợp đồng' : 'Đang đọc và phân tích hợp đồng'}</Text>
        <Text style={styles.analysisBody}>AI đọc các trang, kiểm tra điều khoản và đối chiếu trích dẫn. Hợp đồng nhiều trang có thể mất vài phút.</Text>
        <Button title="Hủy phân tích" variant="ghost" onPress={cancelAnalysis} />
      </Card> : <View style={{ gap: 13 }}>
        <View style={styles.privacyRow}><Feather name="lock" size={15} color={colors.muted} /><Text style={styles.privacyText}>Khi nhấn phân tích, ảnh sẽ được gửi đến máy chủ của bạn và OpenAI để xử lý. Chỉ gửi hợp đồng bạn có quyền chia sẻ.</Text></View>
        {hasUnreadableImage ? <Text style={{ ...textStyles.caption, color: colors.high }}>Hãy xóa ảnh không mở được và chọn lại trước khi phân tích.</Text> : null}
        <Button title={draftPages.length ? `Phân tích ${draftPages.length} trang` : 'Thêm ảnh để bắt đầu'} icon="arrow-right" disabled={!draftPages.length || picking || hasUnreadableImage} onPress={() => { void startAnalysis(); }} />
        <Text style={styles.limitText}>Tối đa 20 trang mỗi lần. Bạn có thể lưu báo cáo và ảnh trên thiết bị sau khi phân tích.</Text>
      </View>}
    </Screen>

    <Modal visible={!!preview} animationType="slide" onRequestClose={() => setPreviewId(null)}>
      <SafeAreaView style={styles.previewScreen}>
        <View style={styles.previewHeader}><Text style={textStyles.section}>Trang {previewIndex + 1} / {draftPages.length}</Text><IconButton icon="x" label="Đóng ảnh xem trước" onPress={() => setPreviewId(null)} /></View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.previewImageContainer} maximumZoomScale={4} minimumZoomScale={1} centerContent>
          {preview ? <Image source={{ uri: preview.uri }} style={{ width: '100%', aspectRatio: preview.width / preview.height }} resizeMode="contain" accessibilityLabel={`Ảnh hợp đồng trang ${previewIndex + 1}`} /> : null}
        </ScrollView>
        <View style={styles.previewFooter}><Button title="Trang trước" icon="chevron-left" variant="ghost" disabled={previewIndex <= 0} onPress={() => setPreviewId(draftPages[previewIndex - 1].id)} style={{ flex: 1 }} /><Button title="Trang sau" icon="chevron-right" variant="ghost" disabled={previewIndex >= draftPages.length - 1} onPress={() => setPreviewId(draftPages[previewIndex + 1].id)} style={{ flex: 1 }} /></View>
      </SafeAreaView>
    </Modal>

    <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
      <View style={styles.modalBackdrop}><Card style={styles.confirmCard}><Text style={textStyles.section}>Xóa các ảnh đã chọn?</Text><Text style={textStyles.muted}>Các ảnh trong thư viện vẫn được giữ nguyên. Bạn sẽ cần chọn lại ảnh để phân tích.</Text><Button title="Giữ lại" variant="ghost" onPress={() => setConfirmClear(false)} /><Button title="Xóa ảnh đã chọn" variant="danger" onPress={() => { setConfirmClear(false); void clearDraft().catch((error) => setActionError(error instanceof Error ? error.message : 'Chưa thể xóa ảnh đã chọn.')); }} /></Card></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 }, progressActive: { backgroundColor: colors.forest, height: 4, borderRadius: 3, flex: 1 }, progressInactive: { backgroundColor: '#DDE4D6', height: 4, borderRadius: 3, flex: 1 },
  title: { fontSize: 31, lineHeight: 39, fontWeight: '700', color: colors.ink, letterSpacing: -0.8 },
  pickerRow: { flexDirection: 'row', gap: 12 }, picker: { flex: 1, alignItems: 'center', gap: 9, padding: 17, paddingVertical: 23, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B8C8AE' },
  pickerIcon: { width: 57, height: 57, backgroundColor: '#EDF4E5', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }, pickerTitle: { fontSize: 14, fontWeight: '700', color: colors.forest }, pickerBody: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  disabled: { opacity: 0.4 }, loadingRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' }, error: { borderColor: '#E4BCAE', backgroundColor: '#FFF2ED' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, count: { color: colors.muted, fontWeight: '400' }, deleteAll: { color: colors.high, fontSize: 12, fontWeight: '600' },
  pageCard: { flexDirection: 'row', padding: 12, gap: 14, alignItems: 'center', borderRadius: 18 }, thumbnail: { width: 82, height: 111, borderRadius: 10, backgroundColor: '#EDF0E8', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, thumbnailImage: { width: '100%', height: '100%' },
  pageNumber: { position: 'absolute', top: 6, left: 6, width: 23, height: 23, borderRadius: 7, backgroundColor: colors.forest, justifyContent: 'center', alignItems: 'center' }, pageNumberText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  pageBody: { flex: 1, gap: 6 }, pageTitle: { fontSize: 16, fontWeight: '600', color: colors.ink }, pageControls: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 },
  empty: { padding: 25, paddingVertical: 30, borderRadius: 20, backgroundColor: '#EEF1E7', alignItems: 'center', gap: 12 }, emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.forest, textAlign: 'center' }, emptyBody: { fontSize: 13, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  privacyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, privacyText: { flex: 1, fontSize: 12, lineHeight: 19, color: colors.muted }, limitText: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 18 },
  analysisCard: { alignItems: 'center', paddingVertical: 27, backgroundColor: '#EDF4E5' }, analysisTitle: { fontSize: 18, color: colors.forest, fontWeight: '700', textAlign: 'center' }, analysisBody: { color: colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 22 },
  previewScreen: { flex: 1, backgroundColor: colors.background }, previewHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, previewImageContainer: { flexGrow: 1, justifyContent: 'center', padding: 12 }, previewFooter: { flexDirection: 'row', gap: 10, padding: 20 },
  modalBackdrop: { flex: 1, padding: 26, backgroundColor: '#10231BB3', justifyContent: 'center', alignItems: 'center' }, confirmCard: { width: '100%', maxWidth: 440 },
});
