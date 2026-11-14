import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { paramValue, ReportUnavailable } from '@/features/report/shared';
import { useRentGuard } from '@/state/rentguard';
import type { Evidence } from '@/types';
import { BackHeader, Badge, Button, Card, colors, IconButton, Notice, Screen, SourceBadge, textStyles } from '@/ui';

function highlightedText(text: string, evidence: Evidence | undefined) {
  if (!evidence || evidence.startOffset < 0 || evidence.endOffset <= evidence.startOffset || evidence.endOffset > text.length) return text;
  return <>{text.slice(0, evidence.startOffset)}<Text style={styles.textHighlight}>{text.slice(evidence.startOffset, evidence.endOffset)}</Text>{text.slice(evidence.endOffset)}</>;
}

function EvidenceViewer({ id, requestedPage, evidenceId }: { id: string; requestedPage: string; evidenceId: string }) {
  const { getRecord, ready } = useRentGuard();
  const record = getRecord(id);
  const { height } = useWindowDimensions();
  const viewportHeight = Math.min(480, Math.max(270, height * 0.46));
  const [selectedPageId, setSelectedPageId] = useState(requestedPage);
  const [activeEvidenceId, setActiveEvidenceId] = useState(evidenceId);
  const [view, setView] = useState<'image' | 'text'>('image');
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(320);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
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
  const selectedEvidence = allEvidence.find(item => item.id === activeEvidenceId && item.pageId === page.id);
  const pageEvidence = allEvidence.filter((item, index, all) => item.pageId === page.id && all.findIndex(other => other.pageId === item.pageId && other.startOffset === item.startOffset && other.endOffset === item.endOffset) === index);
  const aspectRatio = localPage && localPage.width > 0 && localPage.height > 0 ? localPage.height / localPage.width : 1.414;
  const imageWidth = Math.max(1, viewportWidth) * zoom;
  const imageHeight = imageWidth * aspectRatio;
  const box = selectedEvidence?.boundingBox;

  function selectPage(index: number) {
    setSelectedPageId(report.pages[index]?.id ?? ''); setActiveEvidenceId(''); setQuoteExpanded(false);
    setZoom(1); setImageError(false); setImageLoading(true); setRetryKey(0);
  }

  return <Screen key={`${page.id}:${view}:${activeEvidenceId}`} footer={<View style={styles.navigation}>
    <IconButton icon="chevron-left" label="Trang trước" disabled={pageIndex === 0} onPress={() => selectPage(pageIndex - 1)} />
    <View style={{ alignItems: 'center', gap: 3 }}><Text style={textStyles.label}>Trang {page.pageNumber} / {report.pages.length}</Text><Text style={textStyles.caption}>{view === 'image' ? 'Ảnh hợp đồng' : 'Văn bản AI đọc được'}</Text></View>
    <IconButton icon="chevron-right" label="Trang tiếp theo" disabled={pageIndex === report.pages.length - 1} onPress={() => selectPage(pageIndex + 1)} />
  </View>}>
    <BackHeader title="Đối chiếu hợp đồng" subtitle="Kiểm tra lại nội dung trên từng trang" />
    <View style={styles.titleRow}><SourceBadge source={report.source} /><Badge tone={page.status === 'readable' ? 'primary' : 'medium'}>{page.status === 'readable' ? 'Đã đọc nội dung' : page.status === 'partial' ? 'Đọc được một phần' : 'Chưa đọc được'}</Badge></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pagePills}>
      {report.pages.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Xem trang ${item.pageNumber}`} accessibilityState={{ selected: index === pageIndex }} onPress={() => selectPage(index)} style={[styles.pagePill, index === pageIndex && styles.selectedPill]}>
        <Feather name="file-text" size={14} color={index === pageIndex ? colors.onPrimary : colors.primary} /><Text style={[styles.pagePillText, index === pageIndex && { color: colors.onPrimary }]}>Trang {item.pageNumber}</Text>
      </Pressable>)}
    </ScrollView>

    {selectedEvidence ? <View style={styles.quoteCard}>
      <View style={styles.titleRow}><Feather name="bookmark" size={16} color={colors.primary} /><Text style={styles.quoteLabel}>TRÍCH DẪN ĐANG XEM</Text></View>
      <Text selectable style={styles.selectedQuote} numberOfLines={quoteExpanded || selectedEvidence.quote.length <= 160 ? undefined : 3}>“{selectedEvidence.quote}”</Text>
      {selectedEvidence.quote.length > 160 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: quoteExpanded }} onPress={() => setQuoteExpanded(value => !value)} style={styles.expandQuote}><Text style={styles.linkText}>{quoteExpanded ? 'Thu gọn' : 'Đọc đầy đủ trích dẫn'}</Text><Feather name={quoteExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} /></Pressable> : null}
      <Text style={textStyles.caption}>{box ? 'Vị trí có khung đánh dấu trên ảnh.' : 'Chưa có vị trí chính xác trên ảnh. Bạn có thể xem đoạn được tô màu trong mục Văn bản.'}</Text>
    </View> : null}

    <View accessibilityRole="tablist" style={styles.viewTabs}>
      {([{ value: 'image', title: 'Ảnh gốc', icon: 'image' }, { value: 'text', title: 'Văn bản', icon: 'align-left' }] as const).map(tab => <Pressable key={tab.value} accessibilityRole="tab" accessibilityState={{ selected: view === tab.value }} onPress={() => setView(tab.value)} style={[styles.viewTab, view === tab.value && styles.viewTabActive]}><Feather name={tab.icon} size={16} color={view === tab.value ? colors.primary : colors.muted} /><Text style={[styles.viewTabText, view === tab.value && styles.viewTabTextActive]}>{tab.title}</Text></Pressable>)}
    </View>

    {view === 'image' ? <View style={styles.imageCard}>
      <View style={styles.imageHeader}><Text style={textStyles.label}>{report.source === 'demo' ? 'Ảnh hợp đồng mẫu' : 'Ảnh hợp đồng đã gửi'}</Text><View style={styles.zoomActions}>
        <IconButton icon="minus" label="Thu nhỏ ảnh" disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.5))} />
        <Pressable accessibilityRole="button" accessibilityLabel="Đặt lại mức phóng to 100 phần trăm" onPress={() => setZoom(1)} style={styles.zoomLabel}><Text style={textStyles.caption}>{Math.round(zoom * 100)}%</Text></Pressable>
        <IconButton icon="plus" label="Phóng to ảnh" disabled={zoom >= 4} onPress={() => setZoom(value => Math.min(4, value + 0.5))} />
      </View></View>
      {!localPage || imageError ? <View style={styles.imageFallback}>
        <Feather name="image" size={34} color={colors.muted} /><Text style={textStyles.label}>Chưa mở được ảnh trang này</Text><Text style={[textStyles.muted, { textAlign: 'center' }]}>Ảnh có thể không còn trên thiết bị. Văn bản đã đọc vẫn được giữ trong báo cáo.</Text>
        <Button title="Xem văn bản" icon="align-left" variant="secondary" onPress={() => setView('text')} />
        {localPage ? <Button title="Tải lại ảnh" variant="ghost" icon="refresh-cw" onPress={() => { setImageError(false); setImageLoading(true); setRetryKey(value => value + 1); }} /> : null}
      </View> : <View style={[styles.imageViewport, { height: viewportHeight }]} onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={zoom > 1} contentContainerStyle={{ minWidth: viewportWidth }}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ width: imageWidth, height: viewportHeight }}>
            <View style={{ width: imageWidth, height: imageHeight, position: 'relative' }}>
              <Image key={`${localPage.id}-${retryKey}`} source={{ uri: localPage.uri }} style={{ width: imageWidth, height: imageHeight }} contentFit="contain" accessibilityLabel={`Ảnh trang ${page.pageNumber} của hợp đồng`} onLoad={() => setImageLoading(false)} onError={() => { setImageError(true); setImageLoading(false); }} />
              {box ? <View pointerEvents="none" style={[styles.imageHighlight, { left: box.x * imageWidth, top: box.y * imageHeight, width: box.width * imageWidth, height: box.height * imageHeight }]} /> : null}
            </View>
          </ScrollView>
        </ScrollView>
        {imageLoading ? <View pointerEvents="none" style={styles.loadingOverlay}><ActivityIndicator color={colors.primary} /><Text style={textStyles.caption}>Đang mở ảnh…</Text></View> : null}
      </View>}
      <View style={styles.imageHint}><Feather name="move" size={13} color={colors.muted} /><Text style={[textStyles.caption, { flex: 1 }]}>Dùng + / − để phóng to, kéo ảnh để xem các vùng khác.</Text></View>
    </View> : <View style={styles.textSection}>
      <Notice tone="info">Đây là chữ AI đọc từ ảnh, có thể sai. Hãy mở Ảnh gốc để đối chiếu những chỗ chưa rõ.</Notice>
      <Card><Text selectable style={styles.extractedText}>{page.text ? highlightedText(page.text, selectedEvidence) : 'Chưa đọc được nội dung trang này. Hãy cung cấp ảnh rõ chữ và đủ sáng trong lần phân tích mới.'}</Text></Card>
    </View>}

    {page.warning ? <Notice tone="warning" title="Cần kiểm tra lại trang này">{page.warning}</Notice> : null}
    {pageEvidence.length > 0 ? <View style={styles.pageEvidenceSection}><Text accessibilityRole="header" style={textStyles.section}>Trích dẫn trên trang này</Text>
      {pageEvidence.map((evidence, index) => <Pressable key={evidence.id} accessibilityRole="button" accessibilityLabel={`Đối chiếu trích dẫn ${index + 1} của trang ${page.pageNumber}`} accessibilityState={{ selected: selectedEvidence?.id === evidence.id }} onPress={() => { setActiveEvidenceId(evidence.id); setQuoteExpanded(false); setView('text'); }} style={[styles.evidenceItem, selectedEvidence?.id === evidence.id && styles.evidenceSelected]}><View style={styles.evidenceNumber}><Text style={styles.evidenceNumberText}>{index + 1}</Text></View><Text numberOfLines={2} style={styles.evidenceText}>“{evidence.quote}”</Text><Feather name="chevron-right" size={17} color={colors.primary} /></Pressable>)}
    </View> : null}
  </Screen>;
}

export default function EvidenceScreen() {
  const params = useLocalSearchParams<{ id: string; pageId?: string; evidenceId?: string }>();
  const id = paramValue(params.id);
  const requestedPage = paramValue(params.pageId);
  const evidenceId = paramValue(params.evidenceId);
  return <EvidenceViewer key={`${id}:${requestedPage}:${evidenceId}`} id={id} requestedPage={requestedPage} evidenceId={evidenceId} />;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' }, pagePills: { gap: 8 }, pagePill: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 7 }, selectedPill: { backgroundColor: colors.primary, borderColor: colors.primary }, pagePillText: { fontSize: 12, fontWeight: '600', color: colors.primaryDeep }, quoteCard: { padding: 17, borderRadius: 17, gap: 11, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder }, quoteLabel: { color: colors.primaryDeep, fontSize: 10, fontWeight: '700', lineHeight: 16, letterSpacing: 0.8 }, selectedQuote: { color: colors.ink, fontSize: 15, lineHeight: 24, fontWeight: '500' }, expandQuote: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }, linkText: { color: colors.primaryDeep, fontSize: 12, fontWeight: '600' },
  viewTabs: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 4, flexDirection: 'row', gap: 5 }, viewTab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 11 }, viewTabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, viewTabText: { color: colors.muted, fontSize: 13, fontWeight: '600' }, viewTabTextActive: { color: colors.primaryDeep }, imageCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: 'hidden', gap: 12 }, imageHeader: { paddingHorizontal: 14, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, zoomActions: { flexDirection: 'row', gap: 3, alignItems: 'center' }, zoomLabel: { minWidth: 42, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, imageViewport: { backgroundColor: colors.surfaceAlt, position: 'relative', overflow: 'hidden' }, loadingOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#EDF3FCE6', alignItems: 'center', justifyContent: 'center', gap: 10 }, imageFallback: { minHeight: 300, padding: 22, alignItems: 'center', justifyContent: 'center', gap: 15, backgroundColor: colors.surfaceAlt }, imageHighlight: { position: 'absolute', borderWidth: 2, borderColor: colors.primary, backgroundColor: '#2563EB26' }, imageHint: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingBottom: 14, gap: 7 }, navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, textSection: { gap: 14 }, extractedText: { fontSize: 15, lineHeight: 26, color: colors.ink }, textHighlight: { backgroundColor: '#D9E7FF', color: colors.primaryDeep, fontWeight: '700' }, pageEvidenceSection: { gap: 12 }, evidenceItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, minHeight: 68 }, evidenceSelected: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft }, evidenceNumber: { width: 27, height: 27, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, evidenceNumberText: { color: colors.primaryDeep, fontWeight: '700', fontSize: 11 }, evidenceText: { flex: 1, fontSize: 13, lineHeight: 21, color: colors.ink },
});
