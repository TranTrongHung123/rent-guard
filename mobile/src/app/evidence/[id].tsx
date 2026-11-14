import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { paramValue, ReportUnavailable } from '@/features/report/shared';
import { useRentGuard } from '@/state/rentguard';
import type { Evidence } from '@/types';
import { BackHeader, Badge, Button, Card, colors, IconButton, Screen, SourceBadge, textStyles } from '@/ui';

function highlightedText(text: string, evidence: Evidence | undefined) {
  if (!evidence || evidence.startOffset < 0 || evidence.endOffset <= evidence.startOffset || evidence.endOffset > text.length) return text;
  return <>{text.slice(0, evidence.startOffset)}<Text style={styles.textHighlight}>{text.slice(evidence.startOffset, evidence.endOffset)}</Text>{text.slice(evidence.endOffset)}</>;
}

function EvidenceViewer({ id, requestedPage, evidenceId }: { id: string; requestedPage: string; evidenceId: string }) {
  const { getRecord, ready } = useRentGuard();
  const record = getRecord(id);
  const [selectedPageId, setSelectedPageId] = useState(requestedPage);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(320);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [showText, setShowText] = useState(Boolean(evidenceId));
  const allEvidence = useMemo(() => [
    ...(record?.report.findings.flatMap(finding => finding.evidence) ?? []),
    ...(record?.messages.flatMap(message => message.evidence) ?? []),
  ], [record?.report.findings, record?.messages]);

  if (!ready || !record) return <ReportUnavailable loading={!ready} />;
  const { report, localPages } = record;
  const requestedIndex = report.pages.findIndex(item => item.id === selectedPageId);
  const pageIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const page = report.pages[pageIndex];
  if (!page) return <Screen><BackHeader title="Trang hợp đồng" /><Card><Text style={textStyles.body}>Báo cáo chưa có trang hợp đồng để hiển thị.</Text></Card></Screen>;
  const localPage = localPages.find(item => item.id === page.id);
  const selectedEvidence = allEvidence.find(item => item.id === evidenceId && item.pageId === page.id);
  const pageEvidence = allEvidence.filter((item, index, all) => item.pageId === page.id && all.findIndex(other => other.id === item.id) === index);
  const aspectRatio = localPage && localPage.width > 0 && localPage.height > 0 ? localPage.height / localPage.width : 1.414;
  const imageWidth = Math.max(1, viewportWidth) * zoom;
  const imageHeight = imageWidth * aspectRatio;
  const box = selectedEvidence?.boundingBox;

  function selectPage(index: number) {
    setSelectedPageId(report.pages[index]?.id ?? '');
    setZoom(1);
    setImageError(false);
    setImageLoading(true);
    setRetryKey(0);
  }

  return (
    <Screen>
      <BackHeader title="Đối chiếu bằng chứng" subtitle={`Trang ${page.pageNumber} trong ${report.pages.length} trang`} />
      <View style={styles.titleRow}>
        <SourceBadge source={report.source} />
        <Badge tone={page.status === 'readable' ? 'mint' : 'medium'}>{page.status === 'readable' ? 'ĐÃ ĐỌC NỘI DUNG' : page.status === 'partial' ? 'ĐỌC ĐƯỢC MỘT PHẦN' : 'CHƯA ĐỌC ĐƯỢC'}</Badge>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pagePills}>
        {report.pages.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Xem trang ${item.pageNumber}`}
          accessibilityState={{ selected: index === pageIndex }} onPress={() => selectPage(index)}
          style={[styles.pagePill, index === pageIndex && styles.selectedPill]}>
          <Feather name="file-text" size={14} color={index === pageIndex ? '#FFFFFF' : colors.forest} />
          <Text style={[styles.pagePillText, index === pageIndex && { color: '#FFFFFF' }]}>Trang {item.pageNumber}</Text>
        </Pressable>)}
      </ScrollView>

      <View style={styles.imageCard}>
        <View style={styles.imageHeader}>
          <Text style={textStyles.label}>{report.source === 'demo' ? 'Trang hợp đồng mẫu' : 'Ảnh hợp đồng gốc'}</Text>
          <View style={styles.zoomActions}>
            <IconButton icon="minus" label="Thu nhỏ ảnh" disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.5))} />
            <Pressable accessibilityRole="button" accessibilityLabel="Đặt lại kích thước ảnh" onPress={() => setZoom(1)} style={styles.zoomLabel}><Text style={textStyles.caption}>{Math.round(zoom * 100)}%</Text></Pressable>
            <IconButton icon="plus" label="Phóng to ảnh" disabled={zoom >= 4} onPress={() => setZoom(value => Math.min(4, value + 0.5))} />
          </View>
        </View>
        {!localPage || imageError ? <View style={styles.imageFallback}>
          <Feather name="image" size={36} color={colors.muted} />
          <Text style={textStyles.label}>Chưa mở được ảnh trang này</Text>
          <Text style={[textStyles.muted, { textAlign: 'center' }]}>Ảnh có thể đã bị xóa khỏi bộ nhớ. Bạn vẫn có thể xem phần nội dung đã trích xuất bên dưới.</Text>
          {localPage ? <Button title="Tải lại ảnh" variant="ghost" icon="refresh-cw" onPress={() => { setImageError(false); setImageLoading(true); setRetryKey(value => value + 1); }} /> : null}
        </View> : <View style={styles.imageViewport} onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={zoom > 1} contentContainerStyle={{ minWidth: viewportWidth }}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ width: imageWidth, height: 430 }}>
              <View style={{ width: imageWidth, height: imageHeight, position: 'relative' }}>
                <Image key={`${localPage.id}-${retryKey}`} source={{ uri: localPage.uri }} style={{ width: imageWidth, height: imageHeight }}
                  contentFit="contain" accessibilityLabel={`Ảnh trang ${page.pageNumber} của hợp đồng`}
                  onLoad={() => setImageLoading(false)} onError={() => { setImageError(true); setImageLoading(false); }} />
                {box ? <View pointerEvents="none" style={[styles.imageHighlight, {
                  left: box.x * imageWidth, top: box.y * imageHeight, width: box.width * imageWidth, height: box.height * imageHeight,
                }]} /> : null}
              </View>
            </ScrollView>
          </ScrollView>
          {imageLoading ? <View pointerEvents="none" style={styles.loadingOverlay}><ActivityIndicator color={colors.forest} /><Text style={textStyles.caption}>Đang mở ảnh…</Text></View> : null}
        </View>}
        <Text style={styles.imageHint}>Dùng + / − để phóng to, kéo ảnh để đọc các vùng khác.</Text>
        <View style={styles.navigation}>
          <IconButton icon="chevron-left" label="Trang trước" disabled={pageIndex === 0} onPress={() => selectPage(pageIndex - 1)} />
          <Text style={textStyles.caption}>Trang {page.pageNumber} / {report.pages.length}</Text>
          <IconButton icon="chevron-right" label="Trang tiếp theo" disabled={pageIndex === report.pages.length - 1} onPress={() => selectPage(pageIndex + 1)} />
        </View>
      </View>

      {page.warning ? <Card style={styles.warning}><Text style={textStyles.body}>{page.warning}</Text></Card> : null}
      {selectedEvidence ? <Card style={styles.quoteCard}>
        <View style={styles.titleRow}><Feather name="check-square" size={18} color={colors.low} /><Text style={textStyles.label}>Trích đoạn đang đối chiếu</Text></View>
        <Text selectable style={styles.selectedQuote}>“{selectedEvidence.quote}”</Text>
        <Text style={textStyles.caption}>{box ? 'Khung màu đánh dấu vị trí đoạn trích trên ảnh.' : 'Chưa xác định được vị trí chính xác trên ảnh. Đoạn tương ứng được tô màu trong nội dung trích xuất bên dưới.'}</Text>
      </Card> : pageEvidence.length > 0 ? <Card>
        <Text style={textStyles.label}>{pageEvidence.length} trích dẫn từ trang này</Text>
        <Text style={textStyles.muted}>Mở một bằng chứng trong báo cáo hoặc câu trả lời để xem trích đoạn tương ứng.</Text>
      </Card> : null}

      <View style={styles.textSection}>
        <Pressable accessibilityRole="button" accessibilityLabel={showText ? 'Ẩn nội dung trích xuất' : 'Xem nội dung trích xuất'}
          accessibilityState={{ expanded: showText }} onPress={() => setShowText(value => !value)} style={styles.textToggle}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text accessibilityRole="header" style={textStyles.section}>Nội dung đã trích xuất</Text>
            <Text style={textStyles.caption}>Đối chiếu với ảnh gốc khi có chữ khó đọc.</Text>
          </View>
          <Feather name={showText ? 'chevron-up' : 'chevron-down'} size={21} color={colors.forest} />
        </Pressable>
        {showText ? <Card><Text selectable style={styles.extractedText}>{page.text ? highlightedText(page.text, selectedEvidence) : 'AI chưa đọc được nội dung trang này. Hãy chụp rõ, đủ sáng và cung cấp lại trang trong một lần phân tích mới.'}</Text></Card> : null}
      </View>
    </Screen>
  );
}

export default function EvidenceScreen() {
  const params = useLocalSearchParams<{ id: string; pageId?: string; evidenceId?: string }>();
  const id = paramValue(params.id);
  const requestedPage = paramValue(params.pageId);
  const evidenceId = paramValue(params.evidenceId);
  return <EvidenceViewer key={`${id}:${requestedPage}:${evidenceId}`} id={id} requestedPage={requestedPage} evidenceId={evidenceId} />;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' }, pagePills: { gap: 8 }, pagePill: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 7 }, selectedPill: { backgroundColor: colors.forest, borderColor: colors.forest }, pagePillText: { fontSize: 12, fontWeight: '600', color: colors.forest },
  imageCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 22, overflow: 'hidden', gap: 12 }, imageHeader: { paddingHorizontal: 14, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, zoomActions: { flexDirection: 'row', gap: 3, alignItems: 'center' }, zoomLabel: { minWidth: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  imageViewport: { height: 430, backgroundColor: '#E8ECE4', position: 'relative', overflow: 'hidden' }, loadingOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#F3F5EFCC', alignItems: 'center', justifyContent: 'center', gap: 10 }, imageFallback: { minHeight: 300, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#F1F3EC' }, imageHighlight: { position: 'absolute', borderWidth: 2, borderColor: '#D9871B', backgroundColor: '#F6CB4D33' }, imageHint: { color: colors.muted, fontSize: 11, lineHeight: 18, paddingHorizontal: 15, textAlign: 'center' }, navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 },
  warning: { backgroundColor: '#FFF6DF', borderColor: '#ECDDAB' }, quoteCard: { backgroundColor: '#F0F5E9', borderColor: '#C8D9B7' }, selectedQuote: { color: colors.forest, fontSize: 17, lineHeight: 27, fontWeight: '500' }, textSection: { gap: 14 }, textToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 }, extractedText: { fontSize: 14, lineHeight: 25, color: colors.ink }, textHighlight: { backgroundColor: '#F6DF80', color: '#483B0C', fontWeight: '700' },
});
