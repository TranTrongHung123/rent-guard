import { Feather } from '@expo/vector-icons';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RentGuardProvider, useRentGuard } from '@/state/rentguard';
import { colors } from '@/ui';

function Shell() {
  const { ready, error, clearError } = useRentGuard();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const showTabs = ['/', '/history', '/settings'].includes(path);
  if (!ready) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.forest} /><Text style={styles.loadingText}>Đang mở RentGuard…</Text></View>;
  const tabs = [
    { route: '/' as const, title: 'Trang chủ', icon: 'home' as const },
    { route: '/history' as const, title: 'Lịch sử', icon: 'clock' as const },
    { route: '/settings' as const, title: 'Kết nối', icon: 'sliders' as const },
  ];
  return <View style={[styles.app, { paddingTop: insets.top, paddingBottom: showTabs ? 0 : insets.bottom }]}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    {showTabs && <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabInner}>{tabs.map((tab) => <Pressable key={tab.route} accessibilityRole="tab" accessibilityState={{ selected: path === tab.route }} accessibilityLabel={tab.title} onPress={() => router.navigate(tab.route)} style={styles.tab}>
        <View style={[styles.tabIcon, path === tab.route && styles.tabActive]}><Feather name={tab.icon} size={21} color={path === tab.route ? colors.forest : colors.muted} /></View>
        <Text style={[styles.tabText, path === tab.route && styles.tabTextActive]}>{tab.title}</Text>
      </Pressable>)}</View>
    </View>}
    {error && <View style={[styles.errorWrap, { top: insets.top + 8 }]} pointerEvents="box-none"><View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Feather name="alert-circle" size={20} color="#9C382B" /><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo" onPress={clearError} hitSlop={12}><Feather name="x" size={20} color="#9C382B" /></Pressable>
    </View></View>}
  </View>;
}

export default function RootLayout() {
  return <SafeAreaProvider><RentGuardProvider><Shell /></RentGuardProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.background },
  loadingText: { color: colors.forest, fontSize: 16 },
  tabBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  tabInner: { flexDirection: 'row', width: '100%', maxWidth: 720, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4, minHeight: 54 },
  tabIcon: { width: 54, height: 30, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.mint },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: colors.forest },
  errorWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 100 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF1E9', borderWidth: 1, borderColor: '#EFC9BB', borderRadius: 16, padding: 16, maxWidth: 680, width: '100%' },
  errorText: { flex: 1, color: '#853E32', lineHeight: 21, fontSize: 14 },
});
