import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.brandMark}>
          <Text style={styles.brandInitials}>DL</Text>
        </View>
        <Text style={styles.eyebrow}>DILI LABAD MEMBERS</Text>
        <Text style={styles.title}>Sinking Fund</Text>
        <Text style={styles.description}>
          The DLMSF mobile app is being prepared. Member and administrator
          features will be introduced here while continuing to use the
          existing DLMSF services.
        </Text>
        <View style={styles.status}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Mobile foundation is ready</Text>
        </View>
      </View>
      <Text style={styles.footer}>DLMSF · Mobile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#173D32",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  brandInitials: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 1,
  },
  eyebrow: {
    color: "#648075",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: "#172D26",
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  description: {
    color: "#64736D",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 360,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F0EA",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 30,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#36815D",
    marginRight: 9,
  },
  statusText: {
    color: "#315D49",
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    color: "#91A099",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
