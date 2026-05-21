import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function TodayScreen() {
  
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.empty}>오늘의 첫 스냅을 남겨보세요</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '500' },
  empty: { marginTop: 20, color: '#888' },
});