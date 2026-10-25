import React from "react";
import { Pressable, Text, View, StyleSheet, type ViewStyle } from "react-native";

export const C = { navy: "#10202e", deep: "#0a1620", paper: "#f6f4ef", orange: "#e8731a", teal: "#1f8a8a", card: "#16293a", line: "rgba(246,244,239,0.14)", muted: "#9fb0bf", warn: "#f2b84b" };

export function Button({ label, onPress, kind = "primary", disabled }: { label: string; onPress: () => void; kind?: "primary" | "ghost"; disabled?: boolean }) {
  const primary = kind === "primary";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.btn, primary ? s.primary : s.ghost, { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
      <Text style={[s.btnText, { color: primary ? C.deep : C.paper }]}>{label}</Text>
    </Pressable>
  );
}
export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;

const s = StyleSheet.create({
  btn: { minHeight: 56, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  primary: { backgroundColor: C.orange }, ghost: { borderWidth: 1, borderColor: C.line },
  btnText: { fontSize: 17, fontWeight: "700" },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.line },
});
