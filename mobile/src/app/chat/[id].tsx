import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EvidenceLink, paramValue, ReportUnavailable } from '@/features/report/shared';
import { useRentGuard } from '@/state/rentguard';
import type { ChatMessage } from '@/types';
import { BackHeader, Badge, Button, colors, IconButton, Notice, SourceBadge, textStyles } from '@/ui';

const MAX_QUESTION_LENGTH = 2000;
const starterQuestions = [
  'Tôi nên làm rõ điều gì trước khi ký?',
  'Khi nào tôi được hoàn lại tiền cọc?',
  'Tôi cần trả thêm những khoản phí nào?',
];

function Message({ message, reportId }: { message: ChatMessage; reportId: string }) {
  const assistant = message.role === 'assistant';
  return <View style={[styles.messageRow, !assistant && styles.userRow]}>
    {assistant ? <View style={styles.avatar}><Feather name="shield" size={15} color={colors.primary} /></View> : null}
    <View style={[styles.messageBubble, assistant ? styles.assistantBubble : styles.userBubble]}>
      {assistant ? <View style={styles.messageHeading}><Text style={styles.assistantLabel}>RentGuard</Text>{message.source === 'demo' ? <Badge tone="medium">Mẫu</Badge> : null}</View> : null}
      <Text selectable style={[styles.messageText, !assistant && styles.userText]}>{message.content}</Text>
      {assistant && message.evidence.length > 0 ? <View style={styles.messageCitations}>
        <Text style={styles.citationsLabel}>BẰNG CHỨNG ĐỂ ĐỐI CHIẾU</Text>
        {message.evidence.map(evidence => <EvidenceLink key={evidence.id} compact reportId={reportId} evidence={evidence} />)}
      </View> : null}
    </View>
  </View>;
}

function ChatSession({ id, initialQuestion }: { id: string; initialQuestion: string }) {
  const { getRecord, ready, sendMessage, saveRecord, chatBusy, clearError } = useRentGuard();
  const record = getRecord(id);
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState(initialQuestion.slice(0, MAX_QUESTION_LENGTH));
  const [pending, setPending] = useState<{ text: string; beforeCount: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(insets.top);
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const followConversation = useRef(true);
  const sendGuard = useRef(false);

  if (!ready || !record) return <ReportUnavailable loading={!ready} />;
  const { report, messages } = record;
  const busy = sending || chatBusy;
  const suggestions = report.findings.length > 0 ? [`Giải thích thêm: ${report.findings[0].title}`, ...starterQuestions.slice(1)] : starterQuestions;

  async function send() {
    const text = question.trim();
    if (!text || busy || sendGuard.current) return;
    sendGuard.current = true; setSending(true); setSendError(null); clearError();
    setPending({ text, beforeCount: messages.length }); followConversation.current = true;
    try { await sendMessage(id, text); setQuestion(''); }
    catch (error) { setSendError(error instanceof Error ? error.message : 'Chưa gửi được câu hỏi. Hãy kiểm tra kết nối rồi thử lại.'); }
    finally { setPending(null); setSending(false); sendGuard.current = false; }
  }

  async function save() {
    if (saving) return;
    setSaving(true); setSaveError(null);
    try { await saveRecord(id); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Chưa lưu được cuộc trò chuyện. Hãy thử lại.'); }
    finally { setSaving(false); }
  }

  function selectQuestion(text: string) {
    setQuestion(text.slice(0, MAX_QUESTION_LENGTH)); setSendError(null); inputRef.current?.focus();
  }

  return <View ref={rootRef} style={styles.root} onLayout={() => {
    // Measure the actual screen origin rather than assuming a fixed header size.
    rootRef.current?.measureInWindow((_x, y) => setKeyboardOffset(current => Math.abs(current - y) > 1 ? y : current));
  }}>
    <KeyboardAvoidingView style={styles.keyboard} enabled={Platform.OS !== 'web'} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={keyboardOffset}>
      <View style={styles.header}>
        <View style={styles.headerTop}><View style={{ flex: 1 }}><BackHeader title="Hỏi về hợp đồng" subtitle={`${report.pages.length} trang đang được đối chiếu`} /></View>
          <IconButton icon={record.isSaved ? 'check' : 'bookmark'} label={record.isSaved ? 'Đã lưu trong lịch sử' : 'Lưu báo cáo và cuộc trò chuyện'} disabled={record.isSaved || saving} onPress={() => void save()} />
        </View>
        <View style={styles.headerBadges}><SourceBadge source={report.source} />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showContext }} accessibilityLabel="Thông tin về cuộc trò chuyện" onPress={() => setShowContext(value => !value)} style={styles.infoButton}><Feather name="info" size={14} color={colors.muted} /><Text style={styles.infoLabel}>Thông tin</Text></Pressable>
        </View>
        {showContext ? <Text style={styles.contextNote}>AI dựa trên toàn bộ hợp đồng và tối đa 10 lượt hỏi đáp gần nhất. Hãy đối chiếu trích dẫn; câu trả lời có thể chưa đầy đủ. {record.isSaved ? 'Các lượt trao đổi mới sẽ được lưu trên máy.' : 'Nhấn biểu tượng lưu để giữ báo cáo và hội thoại trên máy.'}</Text> : null}
      </View>
      <ScrollView ref={scrollRef} style={styles.conversation} contentContainerStyle={styles.conversationContent} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}
        onScroll={event => { const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; followConversation.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 140; }} scrollEventThrottle={100}
        onContentSizeChange={() => { if (followConversation.current) scrollRef.current?.scrollToEnd({ animated: true }); }}>
        {report.source === 'demo' ? <Notice tone="warning" title="Trò chuyện mẫu">Câu trả lời được soạn sẵn để minh họa, không gọi OpenAI.</Notice> : null}
        {saveError ? <Notice tone="error" title="Chưa lưu được">{saveError}</Notice> : null}
        {messages.length === 0 ? <View style={styles.welcome}>
          <View style={styles.welcomeIcon}><Feather name="message-circle" size={27} color={colors.primary} /></View>
          <Text accessibilityRole="header" style={styles.welcomeTitle}>Bạn muốn làm rõ điều gì?</Text>
          <Text style={styles.welcomeBody}>Hỏi về điều khoản, tiền cọc hoặc chi phí. Mỗi bằng chứng có thể mở lại trên ảnh hợp đồng.</Text>
          <View style={styles.suggestions}>{suggestions.map(text => <Pressable key={text} accessibilityRole="button" disabled={busy} onPress={() => selectQuestion(text)} style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}><Text style={styles.suggestionText}>{text}</Text><Feather name="arrow-up-right" size={16} color={colors.primary} /></Pressable>)}</View>
        </View> : null}
        {messages.map(message => <Message key={message.id} message={message} reportId={id} />)}
        {pending && messages.length <= pending.beforeCount ? <>
          <View style={[styles.messageRow, styles.userRow]}><View style={[styles.messageBubble, styles.userBubble]}><Text style={[styles.messageText, styles.userText]}>{pending.text}</Text></View></View>
          <View style={styles.pending}><ActivityIndicator color={colors.primary} size="small" /><Text style={[textStyles.muted, { flex: 1 }]}>{report.source === 'demo' ? 'Đang mở câu trả lời mẫu…' : 'Đang đối chiếu hợp đồng…'}</Text></View>
        </> : null}
        {sendError ? <Notice tone="error" title="Chưa gửi được câu hỏi" action={<Button title="Thử gửi lại" icon="refresh-cw" variant="ghost" disabled={busy} onPress={() => void send()} />}>{sendError}</Notice> : null}
      </ScrollView>
      <View style={styles.composerArea}>
        {messages.length > 0 && !busy ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.followUps}>{['Giải thích dễ hiểu hơn', 'Nên hỏi chủ nhà điều gì?', 'Cho tôi xem bằng chứng'].map(text => <Pressable key={text} accessibilityRole="button" onPress={() => selectQuestion(text)} style={styles.followUp}><Text style={styles.followUpText}>{text}</Text></Pressable>)}</ScrollView> : null}
        <View style={styles.composer}>
          <TextInput ref={inputRef} accessibilityLabel="Câu hỏi về hợp đồng" value={question} onChangeText={text => { setQuestion(text); if (sendError) setSendError(null); }} placeholder="Nhập câu hỏi của bạn…" placeholderTextColor={colors.muted} editable={!busy} multiline maxLength={MAX_QUESTION_LENGTH} style={styles.input} textAlignVertical="top" returnKeyType="default" underlineColorAndroid="transparent" />
          <Pressable accessibilityRole="button" accessibilityLabel="Gửi câu hỏi" accessibilityState={{ disabled: busy || !question.trim(), busy }} disabled={busy || !question.trim()} onPress={() => void send()} style={({ pressed }) => [styles.sendButton, (busy || !question.trim()) && { opacity: 0.4 }, pressed && { opacity: 0.75 }]}>{busy ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Feather name="arrow-up" size={22} color={colors.onPrimary} />}</Pressable>
        </View>
        <View style={styles.composerFootnote}><Feather name="shield" size={11} color={colors.muted} /><Text style={styles.footnote}>Đối chiếu bằng chứng trước khi quyết định.</Text>{question.length > MAX_QUESTION_LENGTH * 0.8 ? <Text style={styles.counter}>{question.length}/{MAX_QUESTION_LENGTH}</Text> : null}</View>
      </View>
    </KeyboardAvoidingView>
  </View>;
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string; question?: string }>();
  const id = paramValue(params.id);
  const initialQuestion = paramValue(params.question);
  return <ChatSession key={`${id}:${initialQuestion}`} id={id} initialQuestion={initialQuestion} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, maxWidth: 760, width: '100%', alignSelf: 'center' }, keyboard: { flex: 1 }, header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 11, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface }, headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, headerBadges: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }, infoButton: { minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 4 }, infoLabel: { fontSize: 12, color: colors.muted, fontWeight: '500' }, contextNote: { fontSize: 12, lineHeight: 19, color: colors.muted, backgroundColor: colors.surfaceAlt, padding: 12, borderRadius: 12 }, conversation: { flex: 1 }, conversationContent: { padding: 18, gap: 18, paddingBottom: 24 },
  welcome: { alignItems: 'center', paddingVertical: 18, gap: 15 }, welcomeIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, welcomeTitle: { fontSize: 25, lineHeight: 33, fontWeight: '700', textAlign: 'center', color: colors.ink, letterSpacing: -0.6 }, welcomeBody: { fontSize: 14, lineHeight: 23, color: colors.muted, textAlign: 'center', maxWidth: 360 }, suggestions: { gap: 10, width: '100%', marginTop: 5 }, suggestion: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 }, suggestionText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.primaryDeep, fontWeight: '500' },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, userRow: { alignSelf: 'flex-end', paddingLeft: 32 }, avatar: { height: 29, width: 29, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 3 }, messageBubble: { flexShrink: 1, padding: 15, gap: 12, borderRadius: 19 }, assistantBubble: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderTopLeftRadius: 6 }, userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 6 }, messageHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, assistantLabel: { color: colors.primaryDeep, fontSize: 12, fontWeight: '700' }, messageText: { fontSize: 15, lineHeight: 24, color: colors.ink }, userText: { color: colors.onPrimary }, messageCitations: { gap: 9, paddingTop: 4 }, citationsLabel: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 0.65, color: colors.muted }, pending: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 37, paddingVertical: 3 },
  composerArea: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 10, gap: 9 }, followUps: { gap: 8, paddingBottom: 2 }, followUp: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.primarySoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }, followUpText: { fontSize: 12, color: colors.primaryDeep, fontWeight: '600' }, composer: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 19, flexDirection: 'row', alignItems: 'flex-end', padding: 6, gap: 7 }, input: { minHeight: 44, maxHeight: 120, flex: 1, fontSize: 15, lineHeight: 23, color: colors.ink, paddingHorizontal: 9, paddingTop: 10, paddingBottom: 8 }, sendButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, composerFootnote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 }, footnote: { flex: 1, fontSize: 10, lineHeight: 16, color: colors.muted }, counter: { fontSize: 10, color: colors.muted },
});
