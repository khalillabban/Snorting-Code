import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

export default function App() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Snorting Code</Text>
        <Text style={styles.subtitle}>
          React Native + Expo + TypeScript + Python Backend
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Project Setup Complete</Text>
          <Text style={styles.cardText}>
            Your React Native app is ready with:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>React Native with Expo</Text>
            <Text style={styles.listItem}>Cross-platform mobile support</Text>
            <Text style={styles.listItem}>Python FastAPI backend</Text>
            <Text style={styles.listItem}>Comprehensive CI/CD pipeline</Text>
            <Text style={styles.listItem}>Jest + React Native Testing Library</Text>
            <Text style={styles.listItem}>ESLint for code quality</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={[styles.gridItem, styles.gridItemLeft]}>
            <Text style={styles.gridTitle}>Development</Text>
            <Text style={styles.code}>npm start</Text>
            <Text style={styles.gridText}>Start Expo dev server</Text>
          </View>

          <View style={[styles.gridItem, styles.gridItemRight]}>
            <Text style={styles.gridTitle}>Testing</Text>
            <Text style={styles.code}>npm test</Text>
            <Text style={styles.gridText}>Run tests with coverage</Text>
          </View>

          <View style={[styles.gridItem, styles.gridItemLeft]}>
            <Text style={styles.gridTitle}>iOS</Text>
            <Text style={styles.code}>npm run ios</Text>
            <Text style={styles.gridText}>Run on iOS simulator</Text>
          </View>

          <View style={[styles.gridItem, styles.gridItemRight]}>
            <Text style={styles.gridTitle}>Android</Text>
            <Text style={styles.code}>npm run android</Text>
            <Text style={styles.gridText}>Run on Android emulator</Text>
          </View>
        </View>
      </View>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 16,
  },
  list: {
    marginLeft: 8,
  },
  listItem: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  gridItemLeft: {
    marginRight: '2%',
  },
  gridItemRight: {
    marginLeft: '2%',
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 8,
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: '#f7fafc',
    padding: 8,
    borderRadius: 6,
    fontSize: 12,
    color: '#2d3748',
    marginBottom: 8,
  },
  gridText: {
    fontSize: 12,
    color: '#4a5568',
  },
});
