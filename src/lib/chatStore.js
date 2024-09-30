import { doc, getDoc } from "firebase/firestore";
import { create } from "zustand";
import { db } from "./Firebase";
import { useUserStore } from "./UserStore";

export const useChatStore = create((set) => ({
  chatId: null,
  user: null,
  isCurrentUserBlocked: false,
  isRecieverBlocked: false,
  changeChat: (chatId, user) => {
    const currentUser = useUserStore.getState().currentUser;
    if (user.blocked.includes(currentUser.id)) {
      return set({
        chatId,
        user: null,
        isCurrentUserBlocked: true,
        isRecieverBlocked: false,
      });
    }

    if (currentUser.blocked.includes(user.id)) {
      return set({
        chatId,
        user: user,
        isCurrentUserBlocked: false,
        isRecieverBlocked: true,
      });
    }
  },
  changeBlock: () => {
    set((state) => ({...state, isRecieverBlocked: !state.isRecieverBlocked}));
  },
}));
