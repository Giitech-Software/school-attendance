// mobile/app/attendance/qr-generator.tsx
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
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy"; // LEGACY API
import * as Print from "expo-print";

import { listStudents } from "../../src/services/students";
import { generateQrPayload } from "../../src/services/qr";
import type { Student } from "../../src/services/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AppInput from "@/components/AppInput";
import { getStudentLabel } from "../../src/utils/studentLabel";
import { captureRef } from "react-native-view-shot";

/* ---------- small helpers ---------- */
function escapeHtml(str: string) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function (m) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[m];
  });
}

/* promisified toDataURL for react-native-qrcode-svg refs */
function toDataURLPromise(ref: any, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ref || typeof ref.toDataURL !== "function") {
      reject(new Error("QR ref does not have toDataURL"));
      return;
    }

    let done = false;
    const onDone = (data: string) => {
      if (done) return;
      done = true;
      resolve(data.replace(/^data:image\/png;base64,/, ""));
    };

    try {
      ref.toDataURL((data: string) => {
        onDone(data);
      });
    } catch (e) {
      reject(e);
      return;
    }

    // timeout guard
    setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error("toDataURL timed out"));
      }
    }, timeoutMs);
  });
}

/* small delay */
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function StudentQrGenerator() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [payloadJson, setPayloadJson] = useState<string | null>(null);
  const svgRef = useRef<any>(null);
const router = useRouter();

  // Export state
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedClassForExport, setSelectedClassForExport] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  // Hidden QR refs and hidden students list for toDataURL()
  const qrRefs = useRef<Map<string, any>>(new Map());
  const [hiddenQrStudents, setHiddenQrStudents] = useState<Student[] | null>(null);

  // Load students
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await listStudents();
        if (!mounted) return;
        setStudents((s || []).filter((st: any) => !!st?.id));
      } catch (err) {
        console.error("listStudents error", err);
        Alert.alert("Load error", "Failed to load students.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
     // prefer studentId over id for searching OVER SHORT CODE
      const sid = (s.studentId ?? "").toLowerCase();

      const roll = (s.rollNo ?? "").toLowerCase();
      return name.includes(q) || sid.includes(q) || roll.includes(q);
    });
  }, [students, query]);

  // classIds derived from students
  const classIds = useMemo(() => {
    const set = new Set<string>();
    (students || []).forEach((s: any) => {
      if (s.classId) set.add(s.classId);
    });
    return Array.from(set);
  }, [students]);

  useEffect(() => {
    if (!selectedClassForExport && classIds.length > 0) {
      setSelectedClassForExport(classIds[0]);
    }
  }, [classIds, selectedClassForExport]);

  // Single student QR (signed)
  async function openQrForStudent(s: Student) {
    setGenerating(true);
    try {
      const role = "student";
      const classId = s.classId ?? undefined;
     const payload = await generateQrPayload(s.studentId ?? s.id, role, classId);
 const json = JSON.stringify(payload);
      setPayloadJson(json);
      setSelected(s);
      setModalVisible(true);
    } catch (err: any) {
      console.error("generateQrPayload error", err);
      Alert.alert("Error", "Failed to generate QR payload.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyPayload() {
    if (!payloadJson) return;
    await Clipboard.setStringAsync(payloadJson);
    Alert.alert("Copied", "QR payload copied to clipboard.");
  }

  async function shareQrAsPng() {
  if (!svgRef.current) {
    Alert.alert("No QR", "Nothing to share.");
    return;
  }

  try {
    const uri = await captureRef(svgRef, {
      format: "png",
      quality: 1,
    });

    await Sharing.shareAsync(uri);
  } catch (err) {
    console.error("shareQr error", err);
    Alert.alert("Share error", "Unable to share QR image.");
  }
}

  function renderStudent({ item }: { item: Student }) {
    return (
      <Pressable
        onPress={() => openQrForStudent(item)}
        className="bg-white rounded-xl p-4 mb-3 flex-row justify-between items-center"
      >
       <View>
  <Text className="font-semibold text-dark">{getStudentLabel(item)}</Text>
  <Text className="text-xs text-neutral mt-1">Class: {item.classId ?? "-"}</Text>
</View>


        <Pressable
          onPress={() => openQrForStudent(item)}
          className="bg-primary px-3 py-2 rounded-xl"
        >
          <Text className="text-white font-semibold">Generate QR</Text>
        </Pressable>
      </Pressable>
    );
  } 

  /* ---------- EXPORT (OFFLINE PNG -> PDF) ---------- */
  async function exportClassQrs(classId: string | null) {
    if (!classId) {
      Alert.alert("Select a class", "Please select a class to export.");
      return;
    }

    const studentsForClass = students.filter((s) => s.classId === classId);
    if (!studentsForClass || studentsForClass.length === 0) {
      Alert.alert("No students", "No students found for the selected class.");
      return;
    }

    // Guard for huge exports
    const maxAllowed = 400;
    if (studentsForClass.length > maxAllowed) {
      const proceed = await new Promise<boolean>((res) => {
        Alert.alert(
          "Large export",
          `This class has ${studentsForClass.length} students. Exporting many QR codes may take time and use memory. Continue?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => res(false) },
            { text: "Continue", onPress: () => res(true) },
          ],
          { cancelable: false }
        );
      });
      if (!proceed) return;
    }

    try {
      setExporting(true);
      setExportProgress({ done: 0, total: studentsForClass.length });

      // Prepare hidden QR components and refs
      qrRefs.current.clear();
      setHiddenQrStudents(studentsForClass);

      // allow mount
      await wait(600);

      const images: { name: string; roll: string; base64: string }[] = [];

      // Sequential processing
      for (let i = 0; i < studentsForClass.length; i++) {
        const s = studentsForClass[i];

        // For printable QR we use a simple scanner-friendly payload:
        // { studentId: "<docId>", classId: "<shortClassId>" }
       const printablePayload = JSON.stringify({ studentId: s.studentId ?? s.id, classId: s.classId ?? "" });

        // find the ref
        const ref = qrRefs.current.get(s.id);
        let base64 = "";
        try {
          if (ref) {
            base64 = await toDataURLPromise(ref, 8000);
          } else {
            // If ref missing, generate a fallback by creating a temporary QR using QR lib isn't possible here.
            // We'll treat this as a missing QR (placeholder).
            throw new Error("QR ref missing");
          }
        } catch (err) {
          console.warn("toDataURL failed for", s.id, err);
          base64 = "";
        }

        // If the hidden QR ref was using a different payload, ensure we generated the ref with the printable payload
        // (HiddenQRs below will render the printable payload.)

 images.push({
  name: getStudentLabel(s),
  roll: "", // nothing else printed
  base64
});

 
        setExportProgress({ done: i + 1, total: studentsForClass.length });
        await wait(50);
      }

      // Build HTML embedding base64 PNGs
      const colsPerRow = 4;
      const rowsHtml: string[] = [];
      let cellBuffer: string[] = [];

      images.forEach((it, idx) => {
        const imgHtml = it.base64
          ? `<img src="data:image/png;base64,${it.base64}" style="width:220px;height:220px;display:block;margin:0 auto 8px auto;border-radius:8px;" />`
          : `<div style="width:220px;height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:8px;color:#666;">No QR</div>`;

        const cell = `
          <td style="vertical-align:top;padding:10px;width:${100 / colsPerRow}%">
            <div style="border:1px solid #e6e6e6;padding:8px;border-radius:8px;text-align:center;">
              ${imgHtml}
             <div style="font-size:14px;font-weight:600;color:#111;">
  ${escapeHtml(it.name || "-")}
</div>
<div style="font-size:12px;color:#444;margin-top:4px;">
  ${escapeHtml(it.roll || "-")}
</div>

</div>
          </td>
        `;
        cellBuffer.push(cell);
        if (cellBuffer.length === colsPerRow || idx === images.length - 1) {
          rowsHtml.push(`<tr>${cellBuffer.join("")}</tr>`);
          cellBuffer = [];
        }
      });

      const title = `Class ${classId} — QR Codes (${images.length})`;
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 24px; color: #111; }
              .title { text-align: center; margin-bottom: 18px; }
              table { width: 100%; border-collapse: collapse; }
              td { padding: 8px; }
              @media print {
                img { max-width: 100% !important; height: auto !important; }
              }
            </style>
          </head>
          <body>
            <div class="title">
              <h1>${escapeHtml(title)}</h1>
              <div style="font-size:14px;color:#666;">Generated: ${new Date().toLocaleString()}</div>
            </div>
            <table>
              ${rowsHtml.join("")}
            </table>
          </body>
        </html>
      `;

      // create pdf
      const { uri } = await Print.printToFileAsync({ html, width: 1240, height: 1754 });
      if (!uri) throw new Error("Failed to generate PDF");

      if (Platform.OS === "web") {
        Alert.alert("Exported", "PDF created. Download via your browser.");
      } else {
        await Sharing.shareAsync(uri);
      }
    } catch (err: any) {
      console.error("exportClassQrs error:", err);
      Alert.alert("Export error", err?.message ?? "Failed to export QR PDF.");
    } finally {
      setExporting(false);
      setExportModalVisible(false);
      setExportProgress(null);
      setHiddenQrStudents(null);
      qrRefs.current.clear();
      await wait(200);
    }
  }

  /* ---------- Hidden QR components (render printable payload) ---------- */
  function HiddenQRs() {
    if (!hiddenQrStudents || hiddenQrStudents.length === 0) return null;

    return (
      <View style={{ position: "absolute", left: -10000, top: -10000, width: 1, height: 1, opacity: 0 }}>
        {hiddenQrStudents.map((s) => {
          // printable payload for offline QR: { studentId, classId }
          const printablePayload = JSON.stringify({ studentId: s.studentId ?? s.id, classId: s.classId ?? "" });
return (
            <View key={s.id} style={{ width: 300, height: 300 }}>
              <QRCode
                value={printablePayload}
                size={260}
                getRef={(c) => {
                  if (c) qrRefs.current.set(s.id, c);
                }}
                ecl="H"
                quietZone={12 as any}
              />
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 p-4">
      <View className="mb-4 flex-row items-center justify-between">
       <View className="mb-4 flex-row flex-wrap items-start">

  <View className="flex-1 pr-2">
    <View className="flex-row items-center mb-2">
  <Pressable
    onPress={() => router.back()}
    className="p-1 mr-2"
    hitSlop={8}
  >
    <MaterialIcons
      name="arrow-back"
      size={26}
      color="#0f172a"
    />
  </Pressable>

  <Text className="text-2xl font-extrabold text-slate-900" numberOfLines={2}>
   Student QR Generator
  </Text>
</View>
    <Text className="text-m text-neutral mt-1">
      Tap a student to generate a signed QR for check-in/out.
    </Text>
  </View>

  <Pressable
    onPress={() => setExportModalVisible(true)}
    className="bg-primary px-3 py-2 rounded-xl mt-2"
    disabled={exporting || classIds.length === 0}
  >
    <Text className="text-white font-semibold text-sm">
      Export PDF
    </Text>
  </Pressable>
</View>

      </View>

      <AppInput
  value={query}
  onChangeText={setQuery}
  placeholder="Search by name, roll or id"
  className="border rounded-xl px-3 py-2 bg-white mb-4"
  autoCorrect={false}
/>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderStudent}
          ListEmptyComponent={<Text className="text-neutral text-center mt-6">No students found.</Text>}
        />
      )}

      {/* Single QR Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View className="flex-1 items-center justify-center bg-black/60 p-6">
          <View className="bg-white w-full max-w-md rounded-xl p-6">

            <Text className="text-lg font-semibold text-dark mb-2">
  {getStudentLabel(selected ?? {})}
</Text>
  
    <View className="items-center mb-6">
  {payloadJson ? (
    <View
      ref={svgRef}
      className="p-4 bg-white rounded-2xl border border-gray-300 shadow-lg items-center"
    >
      <Text className="text-sm font-semibold text-dark mb-2">
        {getStudentLabel(selected ?? {})}
      </Text>

      <QRCode
        value={payloadJson}
        size={260}
        color="#000"
        backgroundColor="#ffffff"
        ecl="H"
        quietZone={20 as any}
      />
    </View>
  ) : (
    <ActivityIndicator />
  )}
</View>



            <View className="mb-3">
              <Text className="text-xs text-neutral">Payload (JSON)</Text>
              <Text className="text-xs text-neutral mt-1 break-words">{payloadJson ?? ""}</Text>
            </View>

            <View className="flex-row justify-between space-x-3">
              <Pressable onPress={copyPayload} className="flex-1 bg-primary py-3 rounded-xl">
                <Text className="text-white text-center font-semibold">Copy JSON</Text>
              </Pressable>
              <Pressable onPress={shareQrAsPng} className="flex-1 border py-3 rounded">
                <Text className="text-center font-semibold">Share PNG</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => { setModalVisible(false); setSelected(null); setPayloadJson(null); }}
              className="py-3 rounded-xl mt-3"
            >
              <Text className="text-center text-neutral">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal visible={exportModalVisible} animationType="fade" transparent>
        <View className="flex-1 items-center justify-center bg-black/60 p-6">
          <View className="bg-white w-full max-w-md rounded-xl p-6">
            <Text className="text-lg font-semibold text-dark mb-2">Export Class QR PDF</Text>
            <Text className="text-sm text-neutral mb-4">Choose which class to export QR codes for.</Text>

            <View className="mb-4">
              {classIds.length === 0 ? (
                <Text className="text-neutral">No classes available.</Text>
              ) : (
                classIds.map((cid) => (
                  <Pressable
                    key={cid}
                    onPress={() => setSelectedClassForExport(cid)}
                    className={`px-3 py-2 rounded-xl mb-2 ${selectedClassForExport === cid ? "bg-primary" : "bg-white"}`}
                    style={selectedClassForExport === cid ? undefined : { borderWidth: 1, borderColor: "#E5E7EB" }}
                  >
                    <Text className={selectedClassForExport === cid ? "text-white" : "text-dark"}>{cid}</Text>
                  </Pressable>
                ))
              )}
            </View>

            {exportProgress ? (
              <View className="mb-3">
                <Text className="text-sm text-neutral">Exporting {exportProgress.done} / {exportProgress.total}</Text>
                <View style={{ height: 8 }} />
                <View style={{ backgroundColor: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                  <View style={{ width: `${(exportProgress.done / exportProgress.total) * 100}%`, height: 8, backgroundColor: "#1E3A8A" }} />
                </View>
              </View>
            ) : null}

            <View className="flex-row space-x-3">
              <Pressable
                onPress={() => exportClassQrs(selectedClassForExport)}
                className="flex-1 bg-primary py-3 rounded-xl"
                disabled={exporting || !selectedClassForExport}
              >
                <Text className="text-white text-center font-semibold">{exporting ? "Exporting..." : "Export PDF"}</Text>
              </Pressable>

              <Pressable
                onPress={() => setExportModalVisible(false)}
                className="flex-1 border py-3 rounded-xl"
              >
                <Text className="text-center font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hidden QR components rendered off-screen for toDataURL extraction */}
      <HiddenQRs />
    </SafeAreaView>
  );
}
