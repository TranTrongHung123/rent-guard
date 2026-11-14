import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps, ComponentRef, ReactNode, Ref } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type ViewStyle,
} from 'react-native';

import { colors } from './palette';
export { colors } from './palette';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Screen({ children, scroll = true, style, footer, contentContainerStyle, scrollRef }: {
  children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>;
  footer?: ReactNode; contentContainerStyle?: StyleProp<ViewStyle>; scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
}) {
  return <View style={styles.screen}>
    {scroll ? <ScrollView ref={scrollRef} style={styles.screen}
      contentContainerStyle={[styles.content, footer ? { paddingBottom: 20 } : undefined, style, contentContainerStyle]}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView> : <View style={[styles.screen, styles.content, style, contentContainerStyle]}>{children}</View>}
    {footer ? <View style={styles.footer}><View style={styles.footerContent}>{footer}</View></View> : null}
  </View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, icon, style, compact = false }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const foreground = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.high : colors.primaryDeep;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [styles.button, compact && styles.buttonCompact, styles[variant], (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}>
    {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Feather name={icon} size={18} color={foreground} /> : null}
    <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
  </Pressable>;
}

export function IconButton({ icon, label, onPress, disabled = false, color = colors.primary }: {
  icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} hitSlop={4}
    style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && styles.pressed]}>
    <Feather name={icon} size={20} color={color} />
  </Pressable>;
}

const badgePalette = {
  high: { backgroundColor: colors.highSoft, color: colors.high },
  medium: { backgroundColor: colors.mediumSoft, color: colors.medium },
  low: { backgroundColor: colors.lowSoft, color: colors.low },
  neutral: { backgroundColor: colors.surfaceAlt, color: colors.muted },
  primary: { backgroundColor: colors.primarySoft, color: colors.primaryDeep },
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof badgePalette }) {
  const palette = badgePalette[tone];
  return <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
    <Text style={[styles.badgeText, { color: palette.color }]}>{children}</Text>
  </View>;
}

export function SourceBadge({ source }: { source: 'openai' | 'demo' }) {
  return <Badge tone={source === 'demo' ? 'medium' : 'primary'}>{source === 'demo' ? 'Dữ liệu mẫu' : 'Phân tích OpenAI'}</Badge>;
}

const noticePalette = {
  info: { background: colors.primarySoft, foreground: colors.primaryDeep, border: colors.primaryBorder, icon: 'info' as const },
  error: { background: colors.highSoft, foreground: colors.high, border: colors.highBorder, icon: 'alert-circle' as const },
  success: { background: colors.lowSoft, foreground: colors.low, border: colors.line, icon: 'check-circle' as const },
  warning: { background: colors.mediumSoft, foreground: colors.medium, border: colors.mediumBorder, icon: 'alert-triangle' as const },
};

export function Notice({ tone = 'info', title, children, action }: {
  tone?: keyof typeof noticePalette; title?: string; children: ReactNode; action?: ReactNode;
}) {
  const palette = noticePalette[tone];
  return <View style={[styles.notice, { backgroundColor: palette.background, borderColor: palette.border }]}
    accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion={tone === 'error' ? 'polite' : undefined}>
    <Feather name={palette.icon} color={palette.foreground} size={19} style={{ marginTop: 2 }} />
    <View style={styles.noticeBody}>
      {title ? <Text style={[styles.noticeTitle, { color: palette.foreground }]}>{title}</Text> : null}
      {typeof children === 'string' || typeof children === 'number'
        ? <Text style={[styles.noticeText, { color: palette.foreground }]}>{children}</Text> : children}
      {action}
    </View>
  </View>;
}

export function Heading({ title, subtitle, kicker }: { title: string; subtitle?: string; kicker?: string }) {
  return <View style={styles.heading}>
    {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

export function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.backHeader}>
    <IconButton icon="arrow-left" label="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}</View>
  </View>;
}

export function EmptyState({ icon = 'file-text', title, body, action }: {
  icon?: IconName; title: string; body: string; action?: ReactNode;
}) {
  return <Card style={styles.empty}>
    <View style={styles.emptyIcon}><Feather name={icon} size={29} color={colors.primary} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {action}
  </Card>;
}

export const textStyles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: colors.ink, letterSpacing: -0.7 },
  section: { fontSize: 19, lineHeight: 27, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 23 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  caption: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: colors.ink },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 32, gap: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  footerContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.line, gap: 12 },
  button: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonCompact: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 10 },
  buttonText: { fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'center', lineHeight: 21 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.highSoft, borderWidth: 1, borderColor: colors.highBorder },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.78 },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.surfaceAlt },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', flexShrink: 1 },
  badgeText: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.15 },
  heading: { gap: 8 }, kicker: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.4, color: colors.primary },
  title: { fontSize: 29, lineHeight: 37, letterSpacing: -0.8, color: colors.ink, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 22, color: colors.muted },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: colors.ink },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 13 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontSize: 19, lineHeight: 26, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center', maxWidth: 350 },
  notice: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noticeBody: { flex: 1, minWidth: 0, gap: 5 }, noticeTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  noticeText: { fontSize: 13, lineHeight: 21 },
});
