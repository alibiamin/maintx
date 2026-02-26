import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Badge,
  Avatar,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  alpha,
  useTheme,
  Popper,
  ClickAwayListener
} from '@mui/material';
import { Send as SendIcon, Chat as ChatIcon, Close as CloseIcon } from '@mui/icons-material';
import api from '../services/api';
import { useChat } from '../context/ChatContext';

function formatMessageTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubbles() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { channelsWithUnread, markChannelRead, refreshUnread, refreshChannelsWithUnread } = useChat();
  const [openBubbleId, setOpenBubbleId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const anchorRef = useRef(null);
  const bubbleRefs = useRef({});

  const openChannel = channelsWithUnread.find((ch) => ch.id === openBubbleId) || (openBubbleId ? { id: openBubbleId, displayName: 'Chat', name: 'Chat' } : null);
  const isChannelReadOnly = openChannel?.linkedType === 'work_order' && ['completed', 'cancelled'].includes((openChannel?.workOrderStatus || '').toLowerCase());

  useEffect(() => {
    if (!openBubbleId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    api.get(`/chat/channels/${openBubbleId}/messages`, { params: { limit: 20 } })
      .then((r) => setMessages(Array.isArray(r.data?.messages) ? r.data.messages : []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
    markChannelRead(openBubbleId);
  }, [openBubbleId, markChannelRead]);

  const handleSend = () => {
    const text = (input || '').trim();
    if (!text || !openBubbleId || sending) return;
    setSending(true);
    api.post(`/chat/channels/${openBubbleId}/messages`, { content: text })
      .then((r) => {
        setMessages((prev) => [...prev, r.data]);
        setInput('');
        refreshChannelsWithUnread();
        refreshUnread();
      })
      .catch(() => {})
      .finally(() => setSending(false));
  };

  const handleClose = () => {
    setOpenBubbleId(null);
    setInput('');
  };

  const openInFullPage = () => {
    handleClose();
    navigate('/app/chat');
  };

  const hasBubbles = channelsWithUnread && channelsWithUnread.length > 0;
  const showPopover = !!openBubbleId;

  return (
    <>
      <Box
        ref={anchorRef}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'flex-end',
          gap: 1.5,
          zIndex: 1300
        }}
      >
        {hasBubbles && channelsWithUnread.map((ch) => (
          <Box key={ch.id} ref={(el) => { bubbleRefs.current[ch.id] = el; }}>
            <Badge
              badgeContent={ch.unreadCount > 99 ? '99+' : ch.unreadCount}
              color="error"
              overlap="circular"
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Avatar
                onClick={() => setOpenBubbleId(openBubbleId === ch.id ? null : ch.id)}
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: openBubbleId === ch.id ? 'primary.main' : alpha(theme.palette.primary.main, 0.85),
                  cursor: 'pointer',
                  boxShadow: theme.shadows[4],
                  '&:hover': { transform: 'scale(1.05)' },
                  transition: 'transform 0.2s'
                }}
              >
                <ChatIcon />
              </Avatar>
            </Badge>
          </Box>
        ))}
      </Box>

      <Popper
        open={showPopover}
        anchorEl={anchorRef.current}
        placement="top-end"
        modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
        sx={{ zIndex: 1301 }}
      >
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            elevation={8}
            sx={{
              width: 360,
              maxWidth: 'calc(100vw - 48px)',
              maxHeight: 420,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box
              sx={{
                p: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1, pr: 1 }}>
                {openChannel?.displayName || openChannel?.name || 'Chat'}
              </Typography>
              <IconButton size="small" onClick={openInFullPage} title="Ouvrir dans le chat">
                <ChatIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <List
              sx={{
                flex: 1,
                overflow: 'auto',
                py: 1,
                px: 1.5,
                minHeight: 200,
                maxHeight: 260
              }}
            >
              {loadingMessages ? (
                <ListItem><Typography variant="caption" color="text.secondary">Chargement…</Typography></ListItem>
              ) : messages.length === 0 ? (
                <ListItem><Typography variant="caption" color="text.secondary">Aucun message.</Typography></ListItem>
              ) : (
                messages.map((msg) => (
                  <ListItem key={msg.id} disablePadding sx={{ mb: 0.75, flexDirection: 'column', alignItems: msg.isOwn ? 'flex-end' : 'flex-start' }}>
                    <Box
                      sx={{
                        maxWidth: '85%',
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,
                        bgcolor: msg.isOwn ? 'primary.main' : alpha(theme.palette.grey[500], 0.12),
                        color: msg.isOwn ? 'primary.contrastText' : 'text.primary'
                      }}
                    >
                      {msg.messageType === 'system' ? (
                        <Typography variant="caption" color="text.secondary">{msg.content}</Typography>
                      ) : (
                        <>
                          <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>{msg.authorName} · {formatMessageTime(msg.createdAt)}</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</Typography>
                        </>
                      )}
                    </Box>
                  </ListItem>
                ))
              )}
            </List>
            <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {isChannelReadOnly ? (
                <Typography variant="caption" color="text.secondary">Canal en lecture seule (OT clôturé ou annulé).</Typography>
              ) : (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <TextField
                      size="small"
                      fullWidth
                      placeholder="Écrire un message…"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      disabled={sending}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  <IconButton color="primary" onClick={handleSend} disabled={!input.trim() || sending} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}>
                    <SendIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}
