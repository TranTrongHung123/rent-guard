import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRentGuard } from '@/state/rentguard';
import { BackHeader, Badge, Button, Card, colors, IconButton, Notice, Screen, textStyles } from '@/ui';

export default function CaptureScreen() {
  const { apiUrl, error, clearError, draftPages, pickImages, removePage, movePage, clearDraft, analyze, analysisState, cancelAnalysis } = useRentGuard();
  const [picking, setPicking] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewWidth, setPreviewWidth] = useState(320);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const analyzing = analysisState !== 'idle';
  const busy = picking || analyzing;
  const previewIndex = draftPages.findIndex(page => page.id === previewId);
  const preview = draftPages[previewIndex];
  const previewFailed = preview ? failedImages.includes(preview.id) : false;
  const hasUnreadableImage = draftPages.some(page => failedImages.includes(page.id));
  const visibleError = actionError ?? error;
  const connectionError = /kết nối|máy chủ|localhost|Wi-Fi|Mạng cục bộ/i.test(visibleError ?? '');
  const imageWidth = Math.max(previewWidth - 32, 1) * previewZoom;
  const imageHeight = preview ? imageWidth * preview.height / preview.width : 0;

  useEffect(() => {
    if (visibleError) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [visibleError]);

  function openPreview(id: string) { setPreviewId(id); setPreviewZoom(1); }

  async function chooseImages(source: 'camera' | 'library') {
    setPicking(true); setActionError(null); clearError();
    try { await pickImages(source); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Chưa mở được ảnh. Hãy thử lại.'); }
    finally { setPicking(false); }
  }

  async function startAnalysis() {
    setActionError(null); clearError();
    try {
      const id = await analyze();
      if (id) router.push({ pathname: '/report/[id]', params: { id } });
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Chưa phân tích được hợp đồng. Hãy thử lại.'); }
  }

  const footer = <View style={styles.submitArea}>
    {analyzing ? <>
      <View style={styles.busyLine}><ActivityIndicator color={colors.primary} /><View style={{ flex: 1, gap: 3 }}>
        <Text accessibilityLiveRegion="polite" style={textStyles.label}>{analysisState === 'preparing' ? 'Đang chuẩn bị ảnh…' : analysisState === 'saving' ? 'Đang lưu báo cáo trên máy…' : 'Đang phân tích hợp đồng…'}</Text>
        <Text style={textStyles.caption}>Hợp đồng nhiều trang có thể mất vài phút.</Text>
      </View></View>
      <Button title="Hủy phân tích" variant="ghost" disabled={analysisState === 'saving'} onPress={cancelAnalysis} />
    </> : <>
      {draftPages.length > 0 ? <View style={styles.privacyLine}><Feather name="lock" size={14} color={colors.muted} /><Text style={styles.privacyText}>Ảnh được gửi đến máy chủ và OpenAI. Báo cáo, ảnh và hội thoại được tự lưu trên điện thoại; bạn có thể xóa trong Lịch sử.</Text></View> : null}
      <Button title={draftPages.length ? `Phân tích ${draftPages.length} trang` : 'Thêm ảnh để bắt đầu'} icon="arrow-right" disabled={!draftPages.length || busy || hasUnreadableImage} onPress={() => void startAnalysis()} />
    </>}
  </View>;

  return <>
    <Screen footer={footer} scrollRef={scrollRef}>
      <BackHeader title="Thêm hợp đồng" subtitle="Chuẩn bị ảnh trước khi phân tích" />
      <View style={styles.heading}>
        <Badge tone="primary">BƯỚC 1 / 3 · THÊM ẢNH</Badge>
        <Text accessibilityRole="header" style={styles.title}>Đọc rõ từng trang.</Text>
        <Text style={textStyles.muted}>Thêm đủ hợp đồng và phụ lục. Kiểm tra ảnh, rồi sắp xếp theo đúng thứ tự.</Text>
      </View>

      <View style={styles.pickerRow}>
        {([{ source: 'camera', icon: 'camera', title: 'Chụp ảnh', body: 'Chụp từng trang' }, { source: 'library', icon: 'image', title: 'Chọn ảnh', body: 'Thêm nhiều trang' }] as const).map(item => <Pressable key={item.source}
          accessibilityRole="button" accessibilityLabel={item.source === 'camera' ? 'Chụp ảnh hợp đồng' : 'Chọn nhiều ảnh hợp đồng'} accessibilityState={{ disabled: busy }} disabled={busy}
          onPress={() => void chooseImages(item.source)} style={({ pressed }) => [styles.picker, busy && styles.disabled, pressed && styles.pressed]}>
          <View style={styles.pickerIcon}><Feather name={item.icon} size={25} color={colors.primary} /></View>
          <Text style={styles.pickerTitle}>{item.title}</Text><Text style={styles.pickerBody}>{item.body}</Text>
        </Pressable>)}
      </View>
      {picking ? <View style={styles.busyLine}><ActivityIndicator color={colors.primary} /><Text style={textStyles.muted}>Đang chuẩn bị ảnh…</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Thay đổi địa chỉ máy chủ" disabled={busy} onPress={() => router.push('/settings')} style={({ pressed }) => [styles.serverRow, pressed && styles.pressed]}>
        <Feather name="server" size={17} color={colors.muted} /><View style={{ flex: 1, gap: 3 }}><Text style={textStyles.caption}>Máy chủ nhận hợp đồng</Text><Text style={styles.serverAddress}>{apiUrl}</Text></View><Feather name="chevron-right" size={18} color={colors.primary} />
      </Pressable>
      {visibleError ? <Notice tone="error" title="Chưa thể tiếp tục" action={connectionError ? <Button title="Kiểm tra kết nối" variant="ghost" icon="wifi" disabled={busy} onPress={() => router.push('/settings')} /> : undefined}>
        <Text style={textStyles.body}>{visibleError}</Text>
      </Notice> : null}
      {hasUnreadableImage ? <Notice tone="warning"><Text style={textStyles.body}>Có ảnh không mở được. Hãy xóa trang đó và chọn lại để tiếp tục.</Text></Notice> : null}

      {draftPages.length > 0 ? <View style={{ gap: 12 }}>
        <View style={styles.sectionRow}><View style={styles.pageCount}><Text style={textStyles.section}>Các trang đã thêm</Text><Badge tone="primary">{draftPages.length}/20</Badge></View>
          <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Xóa tất cả ảnh đã chọn" hitSlop={6} style={styles.textAction} onPress={() => setConfirmClear(true)}><Text style={styles.deleteAll}>Xóa tất cả</Text></Pressable>
        </View>
        <Text style={textStyles.caption}>Chạm ảnh để xem rõ hơn. Dùng mũi tên để đổi thứ tự.</Text>
        {draftPages.map((page, index) => <Card key={page.id} style={styles.pageCard}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Xem trước trang ${index + 1}`} onPress={() => openPreview(page.id)} style={styles.thumbnail}>
            {failedImages.includes(page.id) ? <Feather name="image" size={26} color={colors.high} /> : <Image source={{ uri: page.uri }} style={styles.thumbnailImage} resizeMode="cover" onError={() => setFailedImages(current => current.includes(page.id) ? current : [...current, page.id])} />}
            <View style={styles.pageNumber}><Text style={styles.pageNumberText}>{index + 1}</Text></View>
          </Pressable>
          <View style={styles.pageBody}>
            <Text style={styles.pageTitle}>Trang {index + 1}</Text>
            <Text style={textStyles.caption}>{failedImages.includes(page.id) ? 'Ảnh không mở được' : 'Chạm ảnh để kiểm tra nội dung'}</Text>
            <View style={styles.pageControls}>
              <IconButton icon="arrow-up" label={`Chuyển trang ${index + 1} lên trước`} disabled={busy || index === 0} onPress={() => movePage(page.id, -1)} />
              <IconButton icon="arrow-down" label={`Chuyển trang ${index + 1} xuống sau`} disabled={busy || index === draftPages.length - 1} onPress={() => movePage(page.id, 1)} />
              <View style={{ flex: 1 }} /><IconButton icon="trash-2" label={`Xóa trang ${index + 1}`} disabled={busy} color={colors.high} onPress={() => removePage(page.id)} />
            </View>
          </View>
        </Card>)}
      </View> : <Card style={styles.empty}>
        <View style={styles.emptyIcon}><Feather name="file-plus" size={30} color={colors.primary} /></View>
        <Text style={styles.emptyTitle}>Thêm trang đầu tiên</Text>
        <Text style={styles.emptyBody}>Chụp đủ bốn góc, rõ chữ và tránh ánh sáng chói. Bạn có thể thêm tối đa 20 trang.</Text>
      </Card>}

      <View style={styles.tip}><Feather name="sun" size={18} color={colors.accent} /><Text style={styles.tipText}>Ảnh rõ, đủ sáng và có đầy đủ chữ giúp AI đọc chính xác hơn. Chỉ gửi tài liệu bạn có quyền chia sẻ.</Text></View>
    </Screen>

    <Modal visible={!!preview} animationType="slide" onRequestClose={() => setPreviewId(null)}>
      <SafeAreaView style={styles.previewScreen}>
        <View style={styles.previewHeader}><View style={{ gap: 3, flex: 1 }}><Text style={textStyles.section}>Trang {previewIndex + 1} / {draftPages.length}</Text><Text style={textStyles.caption}>Kiểm tra chữ và độ rõ của ảnh</Text></View><IconButton icon="x" label="Đóng ảnh xem trước" onPress={() => setPreviewId(null)} /></View>
        <View style={styles.zoomControls}><IconButton icon="minus" label="Thu nhỏ ảnh" disabled={previewFailed || previewZoom <= 1} onPress={() => setPreviewZoom(value => Math.max(1, value - 0.5))} /><Text style={textStyles.label}>{Math.round(previewZoom * 100)}%</Text><IconButton icon="plus" label="Phóng to ảnh" disabled={previewFailed || previewZoom >= 4} onPress={() => setPreviewZoom(value => Math.min(4, value + 0.5))} /></View>
        <View style={{ flex: 1 }} onLayout={event => setPreviewWidth(event.nativeEvent.layout.width)}>
          <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ minWidth: previewWidth }}>
            <ScrollView nestedScrollEnabled style={{ width: Math.max(imageWidth + 32, previewWidth) }} contentContainerStyle={styles.previewImageContainer}>
              {previewFailed ? <View style={styles.previewFallback}><Feather name="image" size={35} color={colors.muted} /><Text style={textStyles.section}>Chưa mở được ảnh này</Text><Text style={[textStyles.muted, { textAlign: 'center' }]}>Hãy đóng ảnh xem trước, xóa trang này rồi chọn ảnh khác hoặc chụp lại.</Text><Button title="Đóng ảnh xem trước" variant="ghost" onPress={() => setPreviewId(null)} /></View> : preview ? <Image source={{ uri: preview.uri }} style={{ width: imageWidth, height: imageHeight }} resizeMode="contain" accessibilityLabel={`Ảnh hợp đồng trang ${previewIndex + 1}`} onError={() => { setPreviewZoom(1); setFailedImages(current => current.includes(preview.id) ? current : [...current, preview.id]); }} /> : null}
            </ScrollView>
          </ScrollView>
        </View>
        <View style={styles.previewFooter}><Button title="Trang trước" icon="chevron-left" variant="ghost" disabled={previewIndex <= 0} onPress={() => openPreview(draftPages[previewIndex - 1].id)} style={{ flex: 1 }} /><Button title="Trang sau" icon="chevron-right" variant="ghost" disabled={previewIndex >= draftPages.length - 1} onPress={() => openPreview(draftPages[previewIndex + 1].id)} style={{ flex: 1 }} /></View>
      </SafeAreaView>
    </Modal>

    <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
      <View style={styles.modalBackdrop}><ScrollView contentContainerStyle={styles.confirmContainer}><Card style={styles.confirmCard}><Text style={textStyles.section}>Xóa các ảnh đang chuẩn bị?</Text><Text style={textStyles.muted}>Bạn sẽ cần thêm lại ảnh để phân tích. Các báo cáo đã lưu không bị ảnh hưởng.</Text><Button title="Giữ lại ảnh" variant="ghost" onPress={() => setConfirmClear(false)} /><Button title="Xóa ảnh đã chọn" variant="danger" onPress={() => {
        setConfirmClear(false); void clearDraft().catch(cause => setActionError(cause instanceof Error ? cause.message : 'Chưa xóa được ảnh đã chọn.'));
      }} /></Card></ScrollView></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  heading: { gap: 10 }, title: { fontSize: 29, lineHeight: 37, fontWeight: '700', color: colors.ink, letterSpacing: -0.7 },
  pickerRow: { flexDirection: 'row', gap: 12 }, picker: { flex: 1, minHeight: 146, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.primaryBorder },
  pickerIcon: { width: 48, height: 48, backgroundColor: colors.primarySoft, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 3 }, pickerTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.primaryDeep }, pickerBody: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 }, busyLine: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, pageCount: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, textAction: { minHeight: 44, justifyContent: 'center' }, deleteAll: { color: colors.high, fontSize: 13, fontWeight: '600' },
  pageCard: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center', borderRadius: 18 }, thumbnail: { width: 78, height: 110, borderRadius: 11, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, thumbnailImage: { width: '100%', height: '100%' },
  pageNumber: { position: 'absolute', top: 6, left: 6, minWidth: 24, minHeight: 24, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }, pageNumberText: { fontSize: 12, fontWeight: '700', color: colors.onPrimary },
  pageBody: { flex: 1, minWidth: 0, gap: 5 }, pageTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.ink }, pageControls: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 5 },
  empty: { paddingVertical: 27, alignItems: 'center', gap: 12, backgroundColor: colors.surface }, emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: colors.ink, textAlign: 'center' }, emptyBody: { fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, tipText: { flex: 1, fontSize: 13, lineHeight: 21, color: colors.muted }, serverRow: { padding: 14, borderRadius: 15, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.surface }, serverAddress: { color: colors.ink, fontWeight: '600', fontSize: 13, lineHeight: 20 },
  submitArea: { gap: 10 }, privacyLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, privacyText: { color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1 },
  previewScreen: { flex: 1, backgroundColor: colors.background }, previewHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }, zoomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 12 }, previewImageContainer: { flexGrow: 1, padding: 16, alignItems: 'center' }, previewFallback: { gap: 16, alignItems: 'center', paddingVertical: 36, width: '100%' }, previewFooter: { flexDirection: 'row', gap: 10, padding: 16 },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay }, confirmContainer: { flexGrow: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }, confirmCard: { width: '100%', maxWidth: 440 },
});
