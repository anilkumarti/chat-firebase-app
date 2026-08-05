import { create } from "zustand";
import { supabase } from "./Supabase";

export const useCallStore = create((set, get) => ({
  incomingCall: null,
  pendingCall: null,
  activeCall: null,
  signalCh: null,
  remoteScreenShare: false,

  setIncomingCall: (v) => set({ incomingCall: v }),
  setPendingCall: (v) => set({ pendingCall: v }),
  setSignalCh: (v) => set({ signalCh: v }),
  setRemoteScreenShare: (v) => set({ remoteScreenShare: v }),
  setActiveCall: (v) =>
    set({ activeCall: v, pendingCall: null, incomingCall: null }),

  clearCall: () => {
    const { pendingCall, activeCall, signalCh } = get();
    pendingCall?.peer?.close();
    pendingCall?.localStream?.getTracks().forEach((t) => t.stop());
    activeCall?.peer?.close();
    activeCall?.localStream?.getTracks().forEach((t) => t.stop());
    if (signalCh) {
      try { supabase.removeChannel(signalCh); } catch (_) {}
    }
    set({ incomingCall: null, pendingCall: null, activeCall: null, signalCh: null });
  },
}));
