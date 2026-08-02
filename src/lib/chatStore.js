import { create } from "zustand";
import { useUserStore } from "./UserStore";

export const useChatStore = create((set) => ({
  chatId: null,
  user: null,
  isGroupChat: false,
  groupInfo: null,
  isCurrentUserBlocked: false,
  isRecieverBlocked: false,

  changeChat: (chatId, user) => {
    const currentUser = useUserStore.getState().currentUser;
    if ((user.blocked || []).includes(currentUser.id)) {
      return set({ chatId, user: null, isGroupChat: false, groupInfo: null, isCurrentUserBlocked: true, isRecieverBlocked: false });
    }
    if ((currentUser.blocked || []).includes(user.id)) {
      return set({ chatId, user, isGroupChat: false, groupInfo: null, isCurrentUserBlocked: false, isRecieverBlocked: true });
    }
    return set({ chatId, user, isGroupChat: false, groupInfo: null, isCurrentUserBlocked: false, isRecieverBlocked: false });
  },

  changeGroup: (chatId, groupInfo) =>
    set({ chatId, groupInfo, isGroupChat: true, user: null, isCurrentUserBlocked: false, isRecieverBlocked: false }),

  changeBlock: () =>
    set((state) => ({ ...state, isRecieverBlocked: !state.isRecieverBlocked })),

  resetChat: () =>
    set({ chatId: null, user: null, isGroupChat: false, groupInfo: null, isCurrentUserBlocked: false, isRecieverBlocked: false }),

  chatListRefresh: 0,
  triggerChatListRefresh: () =>
    set((state) => ({ chatListRefresh: state.chatListRefresh + 1 })),

  showSearch: false,
  setShowSearch: (v) => set({ showSearch: v }),
}));
