import React, { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  EARLY_CHECKOUT_REASON_OPTIONS,
  LATE_REASON_OPTIONS,
  type MovementReasonRequirement,
} from "../src/services/movementPolicy";

type PendingPrompt = {
  requirement: MovementReasonRequirement;
  resolve: (value: string | null) => void;
};

export function useMovementReasonPrompt() {
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [selectedReason, setSelectedReason] = useState("");

  function promptMovementReason(requirement: MovementReasonRequirement) {
    setCustomReason("");
    setSelectedReason("");
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setPending({ requirement, resolve });
    });
  }

  function close(value: string | null) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  }

  function submit() {
    const reason = (customReason.trim() || selectedReason.trim()).trim();
    if (!reason) return;
    close(reason);
  }

  const options =
    pending?.requirement.kind === "early_checkout"
      ? EARLY_CHECKOUT_REASON_OPTIONS
      : LATE_REASON_OPTIONS;

  const promptNode = (
    <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => close(null)}>
      <View className="flex-1 justify-center bg-black/50 px-5">
        <View className="rounded-2xl bg-white p-5">
          <Text className="text-xs font-extrabold uppercase tracking-widest text-blue-700">
            Required attendance record
          </Text>
          <Text className="text-xl font-extrabold text-slate-900">
            {pending?.requirement.title}
          </Text>
          <Text className="mt-2 text-sm text-slate-600">
            {pending?.requirement.message}
          </Text>

          <View className="mt-4 flex-row flex-wrap">
            {options.map((option) => {
              const selected = selectedReason === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    setSelectedReason(option);
                    setCustomReason("");
                  }}
                  className={`mb-2 mr-2 rounded-full border px-3 py-2 ${
                    selected
                      ? "border-blue-600 bg-blue-600"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <Text className={selected ? "text-white font-semibold" : "text-slate-700"}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Additional details (optional if a reason is selected)
          </Text>
          <TextInput
            value={customReason}
            onChangeText={(value) => {
              setCustomReason(value);
              if (value.trim()) setSelectedReason("");
            }}
            placeholder="Enter a clear, authorised reason"
            multiline
            className="mt-3 min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />

          <View className="mt-4 flex-row">
            <Pressable onPress={() => close(null)} className="mr-2 flex-1 rounded-xl border border-slate-200 py-3">
              <Text className="text-center font-semibold text-slate-700">Go back</Text>
            </Pressable>
            <Pressable onPress={submit} className="flex-1 rounded-xl bg-blue-600 py-3">
              <Text className="text-center font-semibold text-white">Record entry</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  return { promptMovementReason, movementReasonPrompt: promptNode };
}
