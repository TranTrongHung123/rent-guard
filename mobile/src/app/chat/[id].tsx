import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { EvidenceLink, paramValue, ReportUnavailable } from '@/features/report/shared';
import { useRentGuard } from '@/state/rentguard';
import type { ChatMessage } from '@/types';
import { BackHeader, Badge, Button, colors, SourceBadge, textStyles } from '@/ui';

const MAX_QUESTION_LENGTH = 2000;
const starterQuestions = [
  'Tôi cần làm rõ những điều gì trước khi ký?',
  'Hợp đồng quy định hoàn tiền cọc thế nào?',
  'Tôi có phải chịu thêm những khoản phí nào?',
];

function Message({ message, reportId }: { message: ChatMessage; reportId: string }) {
  const assistant = message.role === 'assistant';
  return (
    <View style={[styles.messageRow, !assistant && styles.userRow]}>
      {assistant ? <View style={styles.avatar}><Feather name="shield" size={17} color={colors.forest} /></View> : null}
      <View style={[styles.messageBubble, assistant ? styles.assistantBubble : styles.userBubble]}>
        {assistant ? <View style={styles.messageHeading}><Text style={styles.assistantLabel}>RentGuard</Text>
          {message.source === 'demo' ? <Badge tone="medium">MẪU</Badge> : null}
        </View> : null}
        <Text selectable style={[styles.messageText, !assistant && styles.userText]}>{message.content}</Text>
        {assistant && message.evidence.length > 0 ? <View style={styles.messageCitations}>
          <Text style={styles.citationsLabel}>ĐỐI CHIẾU TRONG HỢP ĐỒNG</Text>
          {message.evidence.map(evidence => <EvidenceLink key={evidence.id} compact reportId={reportId} evidence={evidence} />)}
        </View> : null}
      </View>
    </View>
  );
}

function ChatSession({ id, initialQuestion }: { id: string; initialQuestion: string }) {
  const { getRecord, ready, sendMessage, chatBusy, clearError } = useRentGuard();
  const record = getRecord(id);
  const [question, setQuestion] = useState(initialQuestion.slice(0, MAX_QUESTION_LENGTH));
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const followConversation = useRef(true);
  const sendGuard = useRef(false);

  if (!ready || !record) return <ReportUnavailable loading={!ready} />;
  const { report, messages } = record;
  const busy = sending || chatBusy;
  const suggestions = report.findings.length > 0
    ? [`Giải thích rõ hơn về vấn đề: ${report.findings[0].title}`, ...starterQuestions.slice(1)]
    : starterQuestions;

  async function send() {
    const text = question.trim();
    if (!text || busy || sendGuard.current) return;
    sendGuard.current = true;
    setSending(true);
    setSendError(null);
    clearError();
    setPendingQuestion(text);
    followConversation.current = true;
    try {
      await sendMessage(id, text);
      setQuestion('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Chưa gửi được câu hỏi. Hãy kiểm tra kết nối rồi thử lại.');
    } finally {
      setPendingQuestion(null);
      setSending(false);
      sendGuard.current = false;
    }
  }

  function selectQuestion(text: string) {
    setQuestion(text.slice(0, MAX_QUESTION_LENGTH));
    setSendError(null);
    inputRef.current?.focus();
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <BackHeader title="Hỏi về hợp đồng" subtitle={report.title} />
        <View style={styles.headerBadges}><SourceBadge source={report.source} /><Text style={textStyles.caption}>{report.pages.length} trang hợp đồng</Text></View>
      </View>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} style={styles.conversation} contentContainerStyle={styles.conversationContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          onScroll={event => {
            const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
            followConversation.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 140;
          }} scrollEventThrottle={100}
          onContentSizeChange={() => { if (followConversation.current) scrollRef.current?.scrollToEnd({ animated: true }); }}>
          {report.source === 'demo' ? <View style={styles.demoNotice}>
            <Feather name="info" size={17} color={colors.medium} />
            <Text style={styles.demoText}>Bạn đang hỏi đáp với dữ liệu mẫu. Câu trả lời minh họa được tạo sẵn và không gọi OpenAI.</Text>
          </View> : null}
          {messages.length === 0 ? <View style={styles.welcome}>
            <View style={styles.welcomeIcon}><Feather name="message-circle" size={30} color={colors.forest} /></View>
            <Text accessibilityRole="header" style={styles.welcomeTitle}>Hiểu rõ hơn,
              {'\n'}an tâm trước khi ký.</Text>
            <Text style={styles.welcomeBody}>Hỏi về điều khoản, tiền cọc hoặc chi phí. RentGuard dựa vào những trang đã phân tích và dẫn chứng khi có thông tin.</Text>
            <View style={styles.suggestions}>
              {suggestions.map(text => <Pressable key={text} accessibilityRole="button" disabled={busy}
                onPress={() => selectQuestion(text)} style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.65 }]}>
                <Text style={styles.suggestionText}>{text}</Text><Feather name="arrow-up-right" size={16} color={colors.low} />
              </Pressable>)}
            </View>
          </View> : null}
          {messages.map(message => <Message key={message.id} message={message} reportId={id} />)}
          {pendingQuestion ? <>
            <View style={[styles.messageRow, styles.userRow]}><View style={[styles.messageBubble, styles.userBubble]}><Text style={[styles.messageText, styles.userText]}>{pendingQuestion}</Text></View></View>
            <View style={styles.pending}><ActivityIndicator color={colors.forest} size="small" /><Text style={textStyles.muted}>{report.source === 'demo' ? 'Đang mở câu trả lời mẫu…' : 'Đang đối chiếu nội dung hợp đồng…'}</Text></View>
          </> : null}
          {sendError ? <View style={styles.errorCard}>
            <View style={styles.errorHeading}><Feather name="alert-circle" size={17} color={colors.high} /><Text accessibilityRole="alert" style={styles.errorText}>{sendError}</Text></View>
            <Button title="Thử gửi lại" icon="refresh-cw" variant="ghost" disabled={busy} onPress={() => void send()} />
          </View> : null}
        </ScrollView>
        <View style={styles.composerArea}>
          {messages.length > 0 && !busy ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.followUps}>
            {['Hãy giải thích đơn giản hơn', 'Tôi nên hỏi chủ nhà thế nào?', 'Có bằng chứng ở trang nào?'].map(text => <Pressable key={text} accessibilityRole="button" onPress={() => selectQuestion(text)} style={styles.followUp}><Text style={styles.followUpText}>{text}</Text></Pressable>)}
          </ScrollView> : null}
          <View style={styles.composer}>
            <TextInput ref={inputRef} accessibilityLabel="Câu hỏi về hợp đồng" value={question} onChangeText={text => { setQuestion(text); if (sendError) setSendError(null); }}
              placeholder="Đặt câu hỏi về hợp đồng…" placeholderTextColor="#849187" editable={!busy} multiline maxLength={MAX_QUESTION_LENGTH}
              style={styles.input} textAlignVertical="top" returnKeyType="default" underlineColorAndroid="transparent" />
            <Pressable accessibilityRole="button" accessibilityLabel="Gửi câu hỏi" accessibilityState={{ disabled: busy || !question.trim(), busy }}
              disabled={busy || !question.trim()} onPress={() => void send()}
              style={({ pressed }) => [styles.sendButton, (busy || !question.trim()) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
              {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Feather name="arrow-up" size={21} color="#FFFFFF" />}
            </Pressable>
          </View>
          <View style={styles.composerFootnote}>
            <Text style={styles.footnote}>AI có thể sai. Hãy đối chiếu các bằng chứng.</Text>
            {question.length > MAX_QUESTION_LENGTH * 0.8 ? <Text style={styles.counter}>{question.length}/{MAX_QUESTION_LENGTH}</Text> : null}
          </View>
          <Text style={styles.contextNote}>AI nhận toàn bộ nội dung hợp đồng và tối đa 10 lượt hỏi đáp gần nhất.</Text>
          {!record.isSaved && messages.length > 0 ? <Text style={styles.unsavedNote}>Lưu báo cáo để giữ lại cuộc trò chuyện trên điện thoại.</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string; question?: string }>();
  const id = paramValue(params.id);
  const initialQuestion = paramValue(params.question);
  return <ChatSession key={`${id}:${initialQuestion}`} id={id} initialQuestion={initialQuestion} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, maxWidth: 760, width: '100%', alignSelf: 'center' }, header: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 15, gap: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, headerBadges: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, keyboard: { flex: 1 }, conversation: { flex: 1 }, conversationContent: { padding: 20, gap: 20, paddingBottom: 24 },
  demoNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#FFF2DA', borderRadius: 14, padding: 14 }, demoText: { fontSize: 12, lineHeight: 19, color: '#7C5A25', flex: 1 }, welcome: { alignItems: 'center', paddingVertical: 20, gap: 17 }, welcomeIcon: { width: 70, height: 70, borderRadius: 24, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }, welcomeTitle: { fontSize: 27, lineHeight: 36, letterSpacing: -0.7, fontWeight: '700', textAlign: 'center', color: colors.ink }, welcomeBody: { color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: 'center', maxWidth: 350 }, suggestions: { gap: 10, width: '100%', marginTop: 4 }, suggestion: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, suggestionText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.forest, fontWeight: '500' },
  messageRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingRight: 12 }, userRow: { alignSelf: 'flex-end', paddingRight: 0, paddingLeft: 28 }, avatar: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.mint, justifyContent: 'center', alignItems: 'center', marginTop: 3 }, messageBubble: { flexShrink: 1, padding: 16, gap: 12, borderRadius: 18 }, assistantBubble: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderTopLeftRadius: 5 }, userBubble: { backgroundColor: colors.forest, borderBottomRightRadius: 5 }, messageHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, assistantLabel: { fontSize: 12, color: colors.low, fontWeight: '700' }, messageText: { fontSize: 15, lineHeight: 24, color: colors.ink }, userText: { color: '#FFFFFF' }, messageCitations: { gap: 9, marginTop: 5 }, citationsLabel: { fontSize: 9, fontWeight: '700', color: colors.muted, letterSpacing: 0.65 }, pending: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingBottom: 4 },
  errorCard: { backgroundColor: '#FBEFE9', padding: 15, borderRadius: 15, gap: 11 }, errorHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, errorText: { flex: 1, color: colors.high, fontSize: 13, lineHeight: 20 }, composerArea: { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, gap: 9 }, followUps: { gap: 7, paddingBottom: 3 }, followUp: { backgroundColor: '#EAF0E2', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12 }, followUpText: { fontSize: 11, color: colors.forest, fontWeight: '500' }, composer: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#D4DDCE', flexDirection: 'row', alignItems: 'flex-end', padding: 7, gap: 7 }, input: { minHeight: 42, maxHeight: 130, flex: 1, fontSize: 14, lineHeight: 22, color: colors.ink, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 }, sendButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' }, composerFootnote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 }, footnote: { flex: 1, fontSize: 10, lineHeight: 15, color: colors.muted }, counter: { fontSize: 10, color: colors.muted }, contextNote: { fontSize: 10, lineHeight: 15, color: colors.muted, textAlign: 'center' }, unsavedNote: { fontSize: 10, lineHeight: 15, color: colors.medium, textAlign: 'center' },
});
