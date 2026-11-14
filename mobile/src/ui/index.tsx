import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const colors = {
  background: '#F6F7F2', surface: '#FFFFFF', ink: '#182E28', muted: '#68766F',
  forest: '#173E35', mint: '#D8EFBE', line: '#E2E7DD', high: '#B24732',
  medium: '#A66A19', low: '#3C7863', cream: '#F0F2E9',
};

export type IconName = ComponentProps<typeof Feather>['name'];

export function Screen({ children, scroll = true, style }: {
  children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>;
}) {
  if (!scroll) return <View style={[styles.screen, styles.content, style]}>{children}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, style]}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, icon, style }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>;
}) {
  const foreground = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.high : colors.forest;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}>
      {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Feather name={icon} size={18} color={foreground} /> : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, disabled = false, color = colors.forest }: {
  icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      hitSlop={4} style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && styles.pressed]}>
      <Feather name={icon} size={20} color={color} />
    </Pressable>
  );
}

const badgePalette = {
  high: { backgroundColor: '#FBEAE4', color: colors.high },
  medium: { backgroundColor: '#FFF1D9', color: colors.medium },
  low: { backgroundColor: '#E4F1EB', color: colors.low },
  neutral: { backgroundColor: '#EEF1EB', color: colors.muted },
  mint: { backgroundColor: colors.mint, color: colors.forest },
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof badgePalette }) {
  const palette = badgePalette[tone];
  return <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}><Text style={[styles.badgeText, { color: palette.color }]}>{children}</Text></View>;
}

export function SourceBadge({ source }: { source: 'openai' | 'demo' }) {
  return <Badge tone={source === 'demo' ? 'medium' : 'mint'}>{source === 'demo' ? 'DỮ LIỆU MẪU' : 'PHÂN TÍCH OPENAI'}</Badge>;
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
    <View style={{ flex: 1, gap: 3 }}><Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}</View>
  </View>;
}

export function EmptyState({ icon = 'file-text', title, body, action }: {
  icon?: IconName; title: string; body: string; action?: ReactNode;
}) {
  return <Card style={styles.empty}>
    <View style={styles.emptyIcon}><Feather name={icon} size={30} color={colors.forest} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {action}
  </Card>;
}

export const textStyles = StyleSheet.create({
  title: { fontSize: 27, fontWeight: '700', color: colors.ink, letterSpacing: -0.7 },
  section: { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 23 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  caption: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 32, gap: 22, width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.line, gap: 12 },
  button: { minHeight: 52, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'center', lineHeight: 21 },
  primary: { backgroundColor: colors.forest }, secondary: { backgroundColor: colors.mint },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: '#FBEAE4' },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.cream },
  badge: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.55 },
  heading: { gap: 9 }, kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: colors.low },
  title: { fontSize: 31, lineHeight: 39, letterSpacing: -0.9, color: colors.ink, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: colors.ink }, caption: { fontSize: 12, color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  emptyIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: colors.mint, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
});
