import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, BackHandler, ActivityIndicator, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { usePreventScreenCapture } from "expo-screen-capture";
import { sealTip } from "./src/lib/seal";
import { encode } from "./src/lib/geohash";
import * as api from "./src/lib/api";
import { C, Button, Card } from "./src/ui";

type Screen = "home" | "report" | "receipt" | "check" | "claim" | "neutral";
const CATS = [["GBV", "Gender-based violence", "\u{1F49C}"], ["ROBBERY", "Robbery", "\u{1F392}"], ["HIJACKING", "Hijacking", "\u{1F697}"],
  ["DRUGS", "Drugs", "\u{1F48A}"], ["CORRUPTION", "Corruption", "\u{1F3DB}"], ["OTHER", "Something else", "\u{1F4AC}"]] as const;
const STEPS = ["RECEIVED", "ASSIGNED", "VERIFIED"];
const STEP_LABEL: Record<string, string> = { RECEIVED: "Received", ASSIGNED: "Assigned to a case", VERIFIED: "Verified by an officer" };
const rng = (n: number) => Crypto.getRandomBytes(n); // OS-level secure randomness
const SAVED = "receipt";

export default function App() {
  usePreventScreenCapture(); // no screenshots, blank in app switcher
  const [screen, setScreen] = useState<Screen>("home");
  const [receipt, setReceipt] = useState<{ id: string; secret: string } | null>(null);
  const [cat, setCat] = useState<string>("GBV");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [idIn, setIdIn] = useState("");
  const [secIn, setSecIn] = useState("");
  const [status, setStatus] = useState("");
  const [voucher, setVoucher] = useState("");

  const wipe = () => { setReceipt(null); setText(""); setIdIn(""); setSecIn(""); setStatus(""); setVoucher(""); setErr(""); };
  const quickExit = () => { wipe(); if (Platform.OS === "android") BackHandler.exitApp(); setScreen("neutral"); };

  async function submit() {
    setErr("");
    try {
      setBusy("Finding your rough area\u2026");
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error("Location permission is needed to match your report to the right area.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const geohash = encode(pos.coords.latitude, pos.coords.longitude, 5); // coordinates are never stored or sent
      setBusy("Encrypting on your phone\u2026");
      const sealed = sealTip(text.trim(), await api.getKey(), rng);
      setBusy("Sending securely\u2026");
      const hourBucket = new Date(Math.floor(Date.now() / 3.6e6) * 3.6e6).toISOString();
      const { receiptId } = await api.postTip({ category: cat, geohash, hourBucket, ciphertext: sealed.ciphertext, commitment: sealed.commitment });
      setReceipt({ id: receiptId, secret: sealed.claimSecret }); setText(""); setScreen("receipt");
    } catch (e) {
      setErr(e instanceof Error && e.message.startsWith("Location") ? e.message : "We could not send your report. Please try again.");
    } finally { setBusy(""); }
  }
  async function keep() {
    try { await SecureStore.setItemAsync(SAVED, JSON.stringify(receipt), { requireAuthentication: true }); setErr("Saved. Your phone lock protects it."); }
    catch { setErr("Could not save. Is a screen lock set on this phone?"); }
  }
  async function loadSaved() {
    try { const v = await SecureStore.getItemAsync(SAVED, { requireAuthentication: true }); if (v) { const r = JSON.parse(v); setIdIn(r.id); setSecIn(r.secret); } else setErr("Nothing saved on this phone."); }
    catch { setErr("Could not open the saved receipt."); }
  }
  async function check() { setErr(""); try { setStatus((await api.getStatus(idIn.trim())).status); } catch { setErr("Could not check right now."); } }
  async function doClaim() { setErr(""); try { setVoucher((await api.claim(idIn.trim(), secIn.trim())).voucher); } catch { setErr("Claim not available right now."); } }

  if (screen === "neutral") return (
    <View style={[st.fill, { backgroundColor: "#fff", padding: 24, paddingTop: 80 }]}>
      <Pressable delayLongPress={1500} onLongPress={() => setScreen("home")}><Text style={{ fontSize: 28, fontWeight: "700", color: "#222" }}>Notes</Text></Pressable>
      <Text style={{ color: "#888", marginTop: 12 }}>No notes yet.</Text>
    </View>
  );

  const back = () => { setErr(""); setScreen("home"); };
  return (
    <View style={st.fill}>
      <StatusBar barStyle="light-content" />
      <Pressable accessibilityRole="button" accessibilityLabel="Quick exit" onPress={quickExit} style={st.exit}><Text style={st.exitText}>Quick exit</Text></Pressable>
      {screen === "home" && (
        <LinearGradient colors={[C.deep, C.navy, "#12404a"]} style={st.fill}>
          <ScrollView contentContainerStyle={st.pad}>
            <Text style={st.eyebrow}>SA SIGHT</Text>
            <Text style={st.h1}>Report safely.{"\n"}Nothing links the tip to you.</Text>
            <Text style={st.body}>No account. Encrypted on your phone. Rewarded without revealing who you are.</Text>
            <View style={{ gap: 12, marginTop: 28 }}>
              <Button label="Make a report" onPress={() => setScreen("report")} />
              <Button kind="ghost" label="Check a tip" onPress={() => { wipe(); setScreen("check"); }} />
              <Button kind="ghost" label="Claim a reward" onPress={() => { wipe(); setScreen("claim"); }} />
            </View>
            <Card style={{ marginTop: 32, gap: 10 }}>
              {["No account needed", "Encrypted before it leaves your phone", "Only a rough 5 km area is shared"].map((t) => <Text key={t} style={st.trust}>{"\u2713  "}{t}</Text>)}
            </Card>
          </ScrollView>
        </LinearGradient>
      )}
      {screen === "report" && (
        <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled">
          <Text style={st.h2}>What happened?</Text>
          <View style={st.grid}>
            {CATS.map(([k, label, icon]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: cat === k }} onPress={() => setCat(k)} style={[st.cat, cat === k && st.catOn]}>
                <Text style={{ fontSize: 28 }}>{icon}</Text><Text style={st.catText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput accessibilityLabel="Describe what you saw" multiline maxLength={4000} value={text} onChangeText={setText} placeholder="Describe what you saw. Do not include your own name."
            placeholderTextColor={C.muted} style={st.input} />
          <Text style={st.small}>{text.length}/4000. Encrypted on this phone before sending. Only a rough 5 km area is used.</Text>
          {!!err && <Text style={st.err}>{err}</Text>}
          {busy ? <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><ActivityIndicator color={C.orange} /><Text style={st.body}>{busy}</Text></View>
            : <Button label="Encrypt and send" disabled={text.trim().length < 10} onPress={submit} />}
          <Button kind="ghost" label="Back" onPress={back} />
        </ScrollView>
      )}
      {screen === "receipt" && receipt && (
        <ScrollView contentContainerStyle={st.pad}>
          <Card style={{ backgroundColor: "#3a2a0a", borderColor: C.warn }}><Text style={{ color: C.warn, fontWeight: "800", fontSize: 16 }}>Save these now. We cannot recover them and cannot identify you.</Text></Card>
          <Card style={{ gap: 8 }}>
            <Text style={st.label}>RECEIPT ID</Text><Text selectable style={st.mono}>{receipt.id}</Text>
            <Text style={[st.label, { marginTop: 12 }]}>CLAIM SECRET</Text><Text selectable style={st.mono}>{receipt.secret}</Text>
          </Card>
          {!!err && <Text style={st.err}>{err}</Text>}
          <Button label="Keep on this phone (protected by your lock)" onPress={keep} />
          <Button kind="ghost" label="I have saved them. Done" onPress={() => { wipe(); setScreen("home"); }} />
        </ScrollView>
      )}
      {screen === "check" && (
        <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled">
          <Text style={st.h2}>Check a tip</Text>
          <TextInput accessibilityLabel="Receipt ID" autoCapitalize="none" autoCorrect={false} value={idIn} onChangeText={setIdIn} placeholder="Receipt ID" placeholderTextColor={C.muted} style={st.field} />
          <Button label="Use saved receipt" kind="ghost" onPress={loadSaved} />
          <Button label="Check status" disabled={idIn.trim().length !== 32} onPress={check} />
          {!!err && <Text style={st.err}>{err}</Text>}
          {!!status && <Card style={{ gap: 12 }}>{STEPS.map((k) => { const done = STEPS.indexOf(status) >= STEPS.indexOf(k);
            return <Text key={k} style={{ color: done ? C.paper : C.muted, fontSize: 17, fontWeight: done ? "700" : "400" }}>{done ? "\u25CF " : "\u25CB "}{STEP_LABEL[k]}</Text>; })}</Card>}
          <Button kind="ghost" label="Back" onPress={back} />
        </ScrollView>
      )}
      {screen === "claim" && (
        <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled">
          <Text style={st.h2}>Claim a reward</Text>
          <TextInput accessibilityLabel="Receipt ID" autoCapitalize="none" autoCorrect={false} value={idIn} onChangeText={setIdIn} placeholder="Receipt ID" placeholderTextColor={C.muted} style={st.field} />
          <TextInput accessibilityLabel="Claim secret" autoCapitalize="none" autoCorrect={false} secureTextEntry value={secIn} onChangeText={setSecIn} placeholder="Claim secret" placeholderTextColor={C.muted} style={st.field} />
          <Button label="Use saved receipt" kind="ghost" onPress={loadSaved} />
          <Button label="Claim voucher" disabled={idIn.trim().length !== 32 || secIn.trim().length !== 64} onPress={doClaim} />
          {!!err && <Text style={st.err}>{err}</Text>}
          {!!voucher && <LinearGradient colors={[C.orange, "#b4410a"]} style={st.voucher}><Text style={{ color: C.deep, fontWeight: "800" }}>YOUR VOUCHER</Text><Text selectable style={[st.mono, { color: C.deep, fontSize: 22 }]}>{voucher}</Text></LinearGradient>}
          <Button kind="ghost" label="Back" onPress={back} />
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.deep }, pad: { padding: 24, paddingTop: 96, gap: 16 },
  exit: { position: "absolute", top: 48, right: 16, zIndex: 10, backgroundColor: "rgba(246,244,239,0.14)", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  exitText: { color: C.paper, fontWeight: "700" },
  eyebrow: { color: C.orange, letterSpacing: 3, fontWeight: "800" }, h1: { color: C.paper, fontSize: 38, fontWeight: "800", lineHeight: 44 },
  h2: { color: C.paper, fontSize: 30, fontWeight: "800" }, body: { color: "#d9d4c8", fontSize: 17, lineHeight: 25 },
  trust: { color: C.paper, fontSize: 16 }, small: { color: C.muted, fontSize: 14 }, label: { color: C.muted, letterSpacing: 2, fontSize: 12, fontWeight: "700" },
  mono: { color: C.paper, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 15 }, err: { color: C.warn, fontSize: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cat: { width: "47%", backgroundColor: C.card, borderRadius: 20, padding: 16, gap: 8, borderWidth: 2, borderColor: "transparent" }, catOn: { borderColor: C.orange },
  catText: { color: C.paper, fontWeight: "700" },
  input: { minHeight: 160, backgroundColor: C.card, borderRadius: 20, padding: 16, color: C.paper, fontSize: 17, textAlignVertical: "top" },
  field: { backgroundColor: C.card, borderRadius: 16, padding: 16, color: C.paper, fontSize: 17 },
  voucher: { borderRadius: 20, padding: 24, gap: 8 },
});
