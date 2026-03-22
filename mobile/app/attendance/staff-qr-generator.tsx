import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../app/firebase";

import { generateQrPayload } from "../../src/services/qr";
import AppInput from "@/components/AppInput";

/* Helpers */
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

function toDataURLPromise(ref: any): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ref?.toDataURL) return reject("No ref");
    ref.toDataURL((data: string) => resolve(data.replace(/^data:image\/png;base64,/, "")));
  });
}

export default function StaffQrGenerator() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [payloadJson, setPayloadJson] = useState<string | null>(null);
  const svgRef = useRef<any>(null);

  // Export States
  const [exporting, setExporting] = useState(false);
  const [hiddenStaff, setHiddenStaff] = useState<any[] | null>(null);
  const qrRefs = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "staff"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        setStaffList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        Alert.alert("Error", "Failed to load staff.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter(s => 
      (s.name ?? "").toLowerCase().includes(q) || (s.staffId ?? "").toLowerCase().includes(q)
    );
  }, [staffList, searchQuery]);

  async function openQrForStaff(staff: any) {
    const payload = await generateQrPayload(staff.staffId ?? staff.id, "staff");
    setPayloadJson(JSON.stringify(payload));
    setSelectedStaff(staff);
    setModalVisible(true);
  }

  /* ---------- PDF EXPORT LOGIC ---------- */
  async function exportAllStaffPdf() {
    if (filteredStaff.length === 0) return;
    setExporting(true);
    try {
      setHiddenStaff(filteredStaff);
      await wait(800); // Wait for QR components to mount

      const items: { name: string; id: string; base64: string }[] = [];
      for (const s of filteredStaff) {
        const ref = qrRefs.current.get(s.id);
        const base64 = ref ? await toDataURLPromise(ref) : "";
        items.push({ name: s.name, id: s.staffId || "N/A", base64 });
      }

      // Build HTML
      const rows = [];
      for (let i = 0; i < items.length; i += 3) {
        const chunk = items.slice(i, i + 3);
        const cols = chunk.map(it => `
          <td style="width:33%; padding:15px; text-align:center; border:1px solid #eee;">
            <img src="data:image/png;base64,${it.base64}" style="width:160px; height:160px;" />
            <div style="font-weight:bold; margin-top:8px;">${it.name}</div>
            <div style="font-size:12px; color:#666;">ID: ${it.id}</div>
          </td>
        `).join("");
        rows.push(`<tr>${cols}</tr>`);
      }

      const html = `
        <html>
          <body style="font-family:sans-serif; padding:20px;">
            <h1 style="text-align:center;">Staff Identity QR Codes</h1>
            <table style="width:100%; border-collapse:collapse;">${rows.join("")}</table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (err) {
      Alert.alert("Export Failed", "Could not generate PDF.");
    } finally {
      setExporting(false);
      setHiddenStaff(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 p-4">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Pressable onPress={() => router.back()} className="p-1 mr-2"><MaterialIcons name="arrow-back" size={28} color="#0f172a" /></Pressable>
          <View>
            <Text className="text-2xl font-extrabold text-slate-900">Staff QRs</Text>
            <Text className="text-xs text-neutral">Tap to view or Export All</Text>
          </View>
        </View>
        
        <Pressable 
          onPress={exportAllStaffPdf}
          disabled={exporting}
          className="bg-indigo-600 px-4 py-2 rounded-xl flex-row items-center"
        >
          {exporting ? <ActivityIndicator color="white" size="small" /> : (
            <>
              <MaterialIcons name="picture-as-pdf" size={18} color="white" />
              <Text className="text-white font-bold ml-2 text-xs">PDF</Text>
            </>
          )}
        </Pressable>
      </View>

      <AppInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search name or ID..."
        className="border rounded-xl px-3 py-2 bg-white mb-4"
      />

      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => openQrForStaff(item)} className="bg-white rounded-xl p-4 mb-3 flex-row justify-between items-center shadow-sm">
            <View>
              <Text className="font-bold text-dark text-lg">{item.name}</Text>
              <Text className="text-xs text-neutral">Staff ID: {item.staffId || "N/A"}</Text>
            </View>
            <MaterialIcons name="qr-code" size={24} color="#4F46E5" />
          </Pressable>
        )}
      />

      {/* Hidden QR for PDF Generation */}
      {hiddenStaff && (
        <View style={{ position: "absolute", left: -1000, opacity: 0 }}>
          {hiddenStaff.map(s => (
            <QRCode 
              key={s.id}
              value={JSON.stringify({ staffId: s.staffId || s.id, role: "staff" })} 
              getRef={c => { if(c) qrRefs.current.set(s.id, c); }}
            />
          ))}
        </View>
      )}

      {/* Single QR Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View className="flex-1 items-center justify-center bg-black/60 p-6">
          <View className="bg-white w-full max-w-md rounded-3xl p-8 items-center">
            <Text className="text-2xl font-bold text-dark">{selectedStaff?.name}</Text>
            <Text className="text-indigo-600 font-bold mb-6 tracking-widest uppercase">Staff Access</Text>
            <View ref={svgRef} className="p-4 bg-white rounded-2xl border-4 border-indigo-50">
              {payloadJson && <QRCode value={payloadJson} size={220} ecl="H" />}
            </View>
            <Pressable onPress={() => setModalVisible(false)} className="mt-8 bg-slate-100 px-8 py-3 rounded-2xl">
              <Text className="text-slate-600 font-bold">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}