import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  closeButton: {
    marginLeft: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowTransition: {
    backgroundColor: "#eff6ff",
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  icon: {
    fontSize: 15,
  },
  rowContent: {
    flex: 1,
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  stepText: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 20,
  },
  stepMeta: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
});
