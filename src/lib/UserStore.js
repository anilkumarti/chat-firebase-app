import { create } from "zustand";
import { supabase } from "./Supabase";

export const useUserStore = create((set) => ({
  currentUser: null,
  isLoading: true,
  fetchUserinfo: async (uid) => {
    if (!uid) return set({ currentUser: null, isLoading: false });
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();
      if (error) throw error;
      set({ currentUser: data, isLoading: false });
    } catch (error) {
      console.log(error);
      set({ currentUser: null, isLoading: false });
    }
  },
  clearUser: () => set({ currentUser: null, isLoading: false }),
  updateBlocked: (blocked) =>
    set((state) => ({ currentUser: { ...state.currentUser, blocked } })),
}));
