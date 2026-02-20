import { Dimensions, StyleSheet } from "react-native";
import { colors } from "../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
export const FULL_HEIGHT = SCREEN_HEIGHT * 0.9;
export const PEEK_HEIGHT = 120;

export const styles = StyleSheet.create({
  keyboardContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  sheet: {
    height: FULL_HEIGHT,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  gestureArea: {
    width: "100%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  header: {
    width: "100%",
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#D1D1D6",
    borderRadius: 3,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  content: {
    padding: 20,
    flex: 1,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 55,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#000",
  },
  searchButton: {
    backgroundColor: colors.primary,
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  searchButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 999,
  },
  suggestionList: {
    marginTop: 5,
    maxHeight: 250,
    backgroundColor: "#fff",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  suggestionSubtext: {
    fontSize: 12,
    color: "#999",
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginVertical: 15,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeModeButton: {
    backgroundColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
});
