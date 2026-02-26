import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';

const ChatContext = createContext(null);

const CHAT_UNREAD_POLL_MS = 4000;

export function ChatProvider({ children }) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [channelsWithUnread, setChannelsWithUnread] = useState([]);

  const refreshUnread = useCallback(() => {
    api.get('/chat/unread-total')
      .then((r) => setTotalUnread(r.data?.total ?? 0))
      .catch(() => setTotalUnread(0));
  }, []);

  const refreshChannelsWithUnread = useCallback(() => {
    api.get('/chat/channels')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setChannelsWithUnread(list.filter((ch) => (ch.unreadCount ?? 0) > 0));
      })
      .catch(() => setChannelsWithUnread([]));
  }, []);

  const markChannelRead = useCallback((channelId) => {
    if (!channelId) return;
    api.post(`/chat/channels/${channelId}/read`)
      .then(() => {
        refreshUnread();
        setChannelsWithUnread((prev) => prev.filter((ch) => ch.id !== channelId));
      })
      .catch(() => {});
  }, [refreshUnread]);

  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, CHAT_UNREAD_POLL_MS);
    return () => clearInterval(t);
  }, [refreshUnread]);

  useEffect(() => {
    refreshChannelsWithUnread();
    const t = setInterval(refreshChannelsWithUnread, CHAT_UNREAD_POLL_MS);
    return () => clearInterval(t);
  }, [refreshChannelsWithUnread]);

  const value = {
    totalUnread,
    channelsWithUnread,
    refreshUnread,
    refreshChannelsWithUnread,
    markChannelRead
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  return ctx || { totalUnread: 0, channelsWithUnread: [], refreshUnread: () => {}, refreshChannelsWithUnread: () => {}, markChannelRead: () => {} };
}
