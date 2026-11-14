import Feather from '@expo/vector-icons/Feather';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RentGuardProvider, useRentGuard } from '@/state/rentguard';
import { Button, Card, colors, IconButton, textStyles } from '@/ui';

function Shell() {
  const { ready, error, clearError } = useRentGuard();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const [errorDetails, setErrorDetails] = useState(false);
  const showTabs = ['/', '/history', '/settings'].includes(path);
  const hasLocalError = path === '/capture' || path === '/settings' || path.startsWith('/chat/') || path.startsWith('/report/');
  const connectionError = !!error && /kết nối|máy chủ|Wi-Fi|Mạng cục bộ|localhost|fetch/i.test(error);
  const dismissError = () => { setErrorDetails(false); clearError(); };
  if (!ready) return <View style={styles.loading}>
    <StatusBar style="dark" /><View style={styles.loadingLogo}><Feather name="shield" size={38} color={colors.primary} /></View>
    <Text style={styles.brandName}>RentGuard</Text><ActivityIndicator color={colors.primary} />
    <Text style={textStyles.muted}>Đang mở hợp đồng của bạn…</Text>
  </View>;
  const tabs = [
    { route: '/' as const, title: 'Trang chủ', icon: 'home' as const },
    { route: '/history' as const, title: 'Lịch sử', icon: 'clock' as const },
    { route: '/settings' as const, title: 'Kết nối', icon: 'sliders' as const },
  ];
  return <View style={[styles.app, { paddingTop: insets.top, paddingBottom: showTabs ? 0 : insets.bottom }]}>
    <StatusBar style="dark" />
    {error && !hasLocalError ? <View style={styles.noticeContainer}>
      <View style={styles.errorNotice} accessibilityLiveRegion="polite">
        <Pressable accessibilityRole="button" accessibilityLabel="Xem chi tiết thông báo lỗi" onPress={() => setErrorDetails(true)} style={styles.errorAction}>
          <Feather name="alert-circle" size={20} color={colors.high} />
          <View style={styles.errorPreview}><Text style={styles.errorTitle}>{connectionError ? 'Chưa kết nối được máy chủ' : 'Có thao tác cần kiểm tra lại'}</Text>
            <Text numberOfLines={2} style={styles.errorText}>{error}</Text><Text style={styles.errorLink}>Xem chi tiết</Text></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo" onPress={dismissError} style={styles.closeNotice}><Feather name="x" size={19} color={colors.high} /></Pressable>
      </View>
    </View> : null}
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    {showTabs ? <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.tabInner}>{tabs.map(tab => <Pressable key={tab.route} accessibilityRole="tab"
        accessibilityState={{ selected: path === tab.route }} accessibilityLabel={tab.title}
        onPress={() => { if (path !== tab.route) router.navigate(tab.route); }}
        style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}>
        <View style={[styles.tabIcon, path === tab.route && styles.tabActive]}><Feather name={tab.icon} size={21} color={path === tab.route ? colors.primary : colors.muted} /></View>
        <Text style={[styles.tabText, path === tab.route && styles.tabTextActive]}>{tab.title}</Text>
      </Pressable>)}</View>
    </View> : null}
    <Modal visible={errorDetails && !!error} transparent animationType="fade" onRequestClose={() => setErrorDetails(false)}>
      <View style={styles.modalBackdrop}><Card style={styles.errorDialog}>
        <View style={styles.dialogHeader}><View style={styles.dialogIcon}><Feather name="alert-circle" size={25} color={colors.high} /></View>
          <IconButton icon="x" label="Đóng chi tiết" onPress={() => setErrorDetails(false)} /></View>
        <Text accessibilityRole="header" style={textStyles.section}>{connectionError ? 'Kiểm tra kết nối' : 'Thông báo từ RentGuard'}</Text>
        <ScrollView style={{ flexShrink: 1 }}><Text selectable style={textStyles.body}>{error}</Text></ScrollView>
        {connectionError ? <Button title="Mở cài đặt kết nối" icon="wifi" onPress={() => { dismissError(); router.navigate('/settings'); }} /> : null}
        <Button title="Đã hiểu" variant={connectionError ? 'ghost' : 'primary'} onPress={dismissError} />
      </Card></View>
    </Modal>
  </View>;
}

export default function RootLayout() {
  return <SafeAreaProvider><RentGuardProvider><Shell /></RentGuardProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.background },
  loadingLogo: { width: 82, height: 82, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 28, color: colors.primaryDeep, fontWeight: '800', letterSpacing: -0.8 },
  tabBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  tabInner: { flexDirection: 'row', width: '100%', maxWidth: 760, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4, minHeight: 58 },
  tabIcon: { width: 58, height: 31, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primarySoft },
  tabText: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  tabTextActive: { color: colors.primaryDeep, fontWeight: '700' },
  noticeContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, maxWidth: 760, width: '100%', alignSelf: 'center' },
  errorNotice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.highSoft, borderWidth: 1, borderColor: colors.highBorder, borderRadius: 16 },
  errorAction: { flex: 1, minWidth: 0, padding: 13, flexDirection: 'row', gap: 10 },
  errorPreview: { flex: 1, gap: 4, minWidth: 0 }, errorTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: colors.high },
  errorText: { color: colors.high, lineHeight: 18, fontSize: 12 }, errorLink: { color: colors.high, fontSize: 12, lineHeight: 18, textDecorationLine: 'underline' },
  closeNotice: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { flex: 1, padding: 22, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  errorDialog: { width: '100%', maxWidth: 460, maxHeight: '85%', gap: 16, padding: 22 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.highSoft, alignItems: 'center', justifyContent: 'center' },
});
