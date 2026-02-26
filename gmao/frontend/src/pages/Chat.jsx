import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Paper,
  InputAdornment,
  CircularProgress,
  Avatar,
  Badge,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  Chat as ChatIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
  People as PeopleIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  SmartToy as SmartToyIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';
import { useChat } from '../context/ChatContext';

const POLL_INTERVAL_MS = 3000;

function formatMessageTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Chat() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const messagesEndRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({ in_progress: true, pending: true, deferred: true, other: true, completed: false, cancelled: false });
  const [channelFilter, setChannelFilter] = useState('');
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const { markChannelRead, refreshUnread } = useChat();

  const createWo = searchParams.get('createWo');
  const createEq = searchParams.get('createEq');

  const loadChannels = useCallback((silent = false) => {
    if (!silent) setLoadingChannels(true);
    api.get('/chat/channels')
      .then((r) => setChannels(Array.isArray(r.data) ? r.data : []))
      .catch((err) => {
        setChannels([]);
        if (!silent) {
          const msg = err.response?.data?.error || err.message || 'Impossible de charger les canaux';
          snackbar.showError(msg);
        }
      })
      .finally(() => { if (!silent) setLoadingChannels(false); });
  }, [snackbar]);

  useEffect(() => {
    loadChannels(false);
    const t = setInterval(() => loadChannels(true), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadChannels]);

  const loadMessages = useCallback((channelId) => {
    if (!channelId) return;
    setLoadingMessages(true);
    api.get(`/chat/channels/${channelId}/messages`, { params: { limit: 100 } })
      .then((r) => {
        const list = (r.data && r.data.messages);
        setMessages(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setSelectedChannelId(null);
          setChannel(null);
          snackbar.showError(err.response?.data?.error || 'Canal non disponible');
        } else {
          snackbar.showError(err.response?.data?.error || 'Impossible de charger les messages');
        }
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
  }, [snackbar]);

  useEffect(() => {
    if (selectedChannelId) {
      prevMessagesLengthRef.current = 0;
      markChannelRead(selectedChannelId);
      refreshUnread();
      loadMessages(selectedChannelId);
      api.get(`/chat/channels/${selectedChannelId}`)
        .then((r) => setChannel(r.data))
        .catch((err) => {
          setChannel(null);
          if (err.response?.status === 403) {
            setSelectedChannelId(null);
            setMessages([]);
            snackbar.showError(err.response?.data?.error || 'Canal non disponible');
          }
        });
    } else {
      setChannel(null);
      setMessages([]);
    }
  }, [selectedChannelId, loadMessages, snackbar, markChannelRead, refreshUnread]);

  // Ne défiler vers le bas que quand un nouveau message arrive (pas à chaque polling)
  useEffect(() => {
    const len = messages.length;
    const prevLen = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = len;
    if (len > prevLen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!selectedChannelId) return;
    const poll = () => {
      api.get(`/chat/channels/${selectedChannelId}/messages`, { params: { limit: 100 } })
        .then((r) => setMessages((r.data && r.data.messages) || []))
        .catch(() => {});
      api.get(`/chat/channels/${selectedChannelId}`)
        .then((r) => setChannel(r.data))
        .catch(() => {});
    };
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [selectedChannelId]);

  useEffect(() => {
    if (createWo || createEq) {
      const param = createWo ? 'workOrderId' : 'equipmentId';
      const id = createWo || createEq;
      api.get('/chat/channels/by-link', { params: { [param]: id } })
        .then((r) => {
          if (r.data && r.data.channel) {
            setSelectedChannelId(r.data.channel.id);
            navigate({ pathname: '/app/chat', search: '' }, { replace: true });
            setSearchParams({});
            if (r.data.workOrderClosed) {
              snackbar.showInfo('Consultation en lecture seule (OT clôturé ou annulé).');
            }
          } else if (r.data?.workOrderClosed) {
            snackbar.showInfo('Aucun historique de chat pour cet OT clôturé ou annulé.');
            navigate({ pathname: '/app/chat', search: '' }, { replace: true });
            setSearchParams({});
          } else {
            setCreateDialogOpen(true);
            setNewChannelName(createWo ? `OT ${id}` : `Équipement ${id}`);
          }
        })
        .catch(() => setCreateDialogOpen(true));
    }
  }, [createWo, createEq, navigate, setSearchParams, snackbar]);

  const handleSend = () => {
    const text = (input || '').trim();
    if (!text || !selectedChannelId || sending) return;
    setSending(true);
    api.post(`/chat/channels/${selectedChannelId}/messages`, { content: text })
      .then((r) => {
        setMessages((prev) => [...prev, r.data]);
        setInput('');
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Envoi impossible'))
      .finally(() => setSending(false));
  };

  const handleAskAi = () => {
    const text = (input || '').trim();
    if (!text || !selectedChannelId || aiAssistLoading) return;
    setAiAssistLoading(true);
    api.post(`/chat/channels/${selectedChannelId}/ai-assist`, { message: text })
      .then((r) => {
        setMessages((prev) => [...prev, r.data.userMessage, r.data.assistantMessage]);
        setInput('');
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Assistant IA indisponible'))
      .finally(() => setAiAssistLoading(false));
  };

  const handleCreateChannel = () => {
    const name = (newChannelName || '').trim();
    if (!name || createLoading) return;
    setCreateLoading(true);
    const payload = { name, type: createWo ? 'work_order' : createEq ? 'equipment' : 'team' };
    if (createWo) { payload.linkedType = 'work_order'; payload.linkedId = parseInt(createWo, 10); }
    if (createEq) { payload.linkedType = 'equipment'; payload.linkedId = parseInt(createEq, 10); }
    api.post('/chat/channels', payload)
      .then((r) => {
        loadChannels();
        setSelectedChannelId(r.data.id);
        setCreateDialogOpen(false);
        setNewChannelName('');
        setSearchParams({});
        navigate('/app/chat', { replace: true });
        snackbar.showSuccess('Canal créé');
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Création impossible'))
      .finally(() => setCreateLoading(false));
  };

  const getChannelIcon = (ch) => {
    if (ch.linkedType === 'work_order') return <AssignmentIcon />;
    if (ch.linkedType === 'equipment') return <BuildIcon />;
    return <GroupIcon />;
  };

  const GROUP_ORDER = ['in_progress', 'pending', 'deferred', 'other', 'completed', 'cancelled'];
  const GROUP_LABELS = {
    in_progress: 'En cours',
    pending: 'En attente',
    deferred: 'Reporté',
    other: 'Autres',
    completed: 'Terminé',
    cancelled: 'Annulé'
  };
  const getGroupKey = (ch) => {
    if (ch.linkedType !== 'work_order' || !ch.workOrderStatus) return 'other';
    const s = (ch.workOrderStatus || '').toLowerCase();
    if (['in_progress'].includes(s)) return 'in_progress';
    if (['pending'].includes(s)) return 'pending';
    if (['deferred'].includes(s)) return 'deferred';
    if (['completed'].includes(s)) return 'completed';
    if (['cancelled'].includes(s)) return 'cancelled';
    return 'other';
  };
  const groupedChannels = React.useMemo(() => {
    const q = (channelFilter || '').trim().toLowerCase();
    const filtered = (channels || []).filter((ch) => {
      if (!q) return true;
      const name = (ch.displayName || ch.name || '').toLowerCase();
      const teams = (Array.isArray(ch.teamNames) ? ch.teamNames : []).join(' ').toLowerCase();
      return name.includes(q) || teams.includes(q);
    });
    const groups = {};
    GROUP_ORDER.forEach((k) => { groups[k] = []; });
    filtered.forEach((ch) => {
      const key = getGroupKey(ch);
      if (!groups[key]) groups[key] = [];
      groups[key].push(ch);
    });
    return GROUP_ORDER.map((key) => ({ key, label: GROUP_LABELS[key], channels: groups[key] || [] })).filter((g) => g.channels.length > 0);
  }, [channels, channelFilter]);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 400 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
          Messagerie équipe
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Échangez sur les interventions et équipements — canaux liés aux OT ou à un équipement.
        </Typography>
      </Box>

      <Paper
        elevation={isDark ? 0 : 2}
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          borderRadius: 3,
          overflow: 'hidden',
          border: isDark ? '1px solid' : 'none',
          borderColor: 'divider',
          boxShadow: isDark ? 'none' : '0 4px 24px rgba(0,0,0,0.06)'
        }}
      >
        {/* Sidebar canaux */}
        <Box
          sx={{
            width: 300,
            minWidth: 300,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: isDark ? alpha(theme.palette.background.paper, 0.6) : alpha(theme.palette.primary.main, 0.04),
            borderRight: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChatIcon sx={{ color: 'primary.contrastText', fontSize: 22 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700}>Canaux</Typography>
          </Box>
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField
              size="small"
              placeholder="Filtrer les canaux…"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              fullWidth
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
            {loadingChannels ? (
              <Box display="flex" justifyContent="center" py={4}><CircularProgress size={32} /></Box>
            ) : channels.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <GroupIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
                <Typography variant="body2" color="text.secondary">
                  Les canaux s&apos;ouvrent avec les OT. Ouvrez un OT et cliquez sur « Discuter ».
                </Typography>
              </Box>
            ) : groupedChannels.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
                <Typography variant="body2" color="text.secondary">
                  Aucun canal ne correspond au filtre.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ overflow: 'auto', flex: 1 }}>
                {groupedChannels.map(({ key, label, channels: groupChannels }) => {
                  const isExpanded = expandedGroups[key] !== false;
                  return (
                    <Box key={key} sx={{ mb: 0.5 }}>
                      <Button
                        fullWidth
                        size="small"
                        onClick={() => toggleGroup(key)}
                        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{
                          justifyContent: 'space-between',
                          textTransform: 'none',
                          fontWeight: 600,
                          color: (key === 'completed' || key === 'cancelled') ? 'text.secondary' : 'text.primary',
                          py: 0.75,
                          px: 1.5,
                          borderRadius: 1
                        }}
                      >
                        {label} ({groupChannels.length})
                      </Button>
                      {isExpanded && (
                        <List disablePadding sx={{ px: 1 }}>
                          {groupChannels.map((ch) => {
                            const unread = ch.unreadCount ?? 0;
                            return (
                              <ListItemButton
                                key={ch.id}
                                selected={selectedChannelId === ch.id}
                                onClick={() => setSelectedChannelId(ch.id)}
                                sx={{
                                  borderRadius: 2,
                                  py: 1.25,
                                  mb: 0.5,
                                  opacity: (key === 'completed' || key === 'cancelled') ? 0.85 : 1,
                                  '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.12), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.18) } }
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 44 }}>
                                  {unread > 0 ? (
                                    <Badge badgeContent={unread > 99 ? '99+' : unread} color="error">
                                      {getChannelIcon(ch)}
                                    </Badge>
                                  ) : (
                                    getChannelIcon(ch)
                                  )}
                                </ListItemIcon>
                                <ListItemText
                                  primary={ch.displayName || ch.name}
                                  primaryTypographyProps={{ noWrap: true, variant: 'body2', fontWeight: selectedChannelId === ch.id ? 600 : 500 }}
                                  secondary={[ch.teamNames?.length > 0 && `Équipe : ${ch.teamNames.join(', ')}`, ch.lastMessageAt && formatMessageTime(ch.lastMessageAt)].filter(Boolean).join(' · ') || null}
                                  secondaryTypographyProps={{ variant: 'caption', noWrap: true, sx: { display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 } }}
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* Zone messages */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: isDark ? 'background.default' : alpha(theme.palette.grey[50], 0.5) }}>
          {!selectedChannelId ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
              <Box textAlign="center" sx={{ maxWidth: 360 }}>
                <Box sx={{ width: 80, height: 80, borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <ChatIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
                <Typography variant="h6" fontWeight={600} gutterBottom>Sélectionnez un canal</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choisissez une conversation dans la liste. Depuis un OT, utilisez « Discuter » pour ouvrir le canal.
                </Typography>
              </Box>
            </Box>
          ) : (
            <>
              {/* En-tête canal */}
              <Box
                sx={{
                  p: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: isDark ? 'background.paper' : alpha(theme.palette.primary.main, 0.03),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: '-0.01em' }}>{channel?.displayName || channel?.name || '…'}</Typography>
                  {channel?.linkedType === 'work_order' && channel?.linkedId && (
                    <Chip size="small" label={`OT #${channel.linkedId}`} onClick={() => navigate(`/app/work-orders/${channel.linkedId}`)} sx={{ cursor: 'pointer', borderRadius: 1.5 }} />
                  )}
                  {channel?.linkedType === 'equipment' && channel?.linkedId && (
                    <Chip size="small" label="Équipement" onClick={() => navigate(`/app/equipment/${channel.linkedId}`)} sx={{ cursor: 'pointer', borderRadius: 1.5 }} />
                  )}
                </Box>
                {channel?.teamNames?.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">Équipe : {channel.teamNames.join(', ')}</Typography>
                  </Box>
                )}
              </Box>

              {/* Fil de messages */}
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  background: isDark
                    ? undefined
                    : 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(248,250,252,0.4) 100%)'
                }}
              >
                {loadingMessages ? (
                  <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                    <Box sx={{ textAlign: 'center', maxWidth: 320 }}>
                      <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                        <ChatIcon sx={{ fontSize: 28, color: 'primary.main', opacity: 0.8 }} />
                      </Box>
                      <Typography variant="body2" color="text.secondary">Aucun message pour l&apos;instant.</Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>Les échanges et mises à jour de l&apos;OT apparaîtront ici.</Typography>
                    </Box>
                  </Box>
                ) : (
                  messages.map((msg, idx) => {
                    const msgKey = `msg-${msg.id ?? 'n'}-${idx}`;
                    return msg.messageType === 'system' ? (
                      <Box key={msgKey} sx={{ display: 'flex', justifyContent: 'center', my: 0.5 }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2, py: 1, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.info.main, 0.2) }}>
                          <InfoIcon sx={{ fontSize: 16, color: 'info.main' }} />
                          <Typography variant="caption" color="text.secondary">{msg.content}</Typography>
                          <Typography variant="caption" color="text.disabled">· {formatMessageTime(msg.createdAt)}</Typography>
                        </Box>
                      </Box>
                    ) : msg.messageType === 'assistant' ? (
                      <Box key={msgKey} sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'flex-end', maxWidth: '82%', alignSelf: 'flex-start' }}>
                        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.secondary.main, 0.9), flexShrink: 0 }}>
                          <SmartToyIcon sx={{ fontSize: 22 }} />
                        </Avatar>
                        <Box sx={{ px: 2, py: 1.5, borderRadius: 2.5, borderTopRightRadius: 4, bgcolor: alpha(theme.palette.secondary.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.secondary.main, 0.22), boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <Typography variant="caption" sx={{ opacity: 0.85, display: 'block', mb: 0.5, fontWeight: 600 }}>{msg.authorName} · {formatMessageTime(msg.createdAt)}</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{msg.content}</Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box
                        key={msgKey}
                        sx={{
                          display: 'flex',
                          flexDirection: msg.isOwn ? 'row-reverse' : 'row',
                          gap: 1.5,
                          alignItems: 'flex-end',
                          maxWidth: '82%',
                          alignSelf: msg.isOwn ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <Avatar sx={{ width: 38, height: 38, bgcolor: msg.isOwn ? 'primary.main' : 'grey.400', fontSize: '0.9rem', flexShrink: 0 }}>
                          {(msg.authorName || 'U').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box
                          sx={{
                            px: 2,
                            py: 1.5,
                            borderRadius: 2.5,
                            borderTopRightRadius: msg.isOwn ? 4 : 2.5,
                            borderTopLeftRadius: msg.isOwn ? 2.5 : 4,
                            bgcolor: msg.isOwn ? 'primary.main' : 'background.paper',
                            color: msg.isOwn ? 'primary.contrastText' : 'text.primary',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            border: msg.isOwn ? 'none' : '1px solid',
                            borderColor: 'divider'
                          }}
                        >
                          <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.5 }}>{msg.authorName} · {formatMessageTime(msg.createdAt)}</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{msg.content}</Typography>
                        </Box>
                      </Box>
                    );
                  })
                )
                }
                <div ref={messagesEndRef} />
              </Box>

              {/* Saisie (lecture seule si OT clôturé ou annulé) */}
              <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                {(() => {
                  const isChannelReadOnly = channel?.linkedType === 'work_order' && ['completed', 'cancelled'].includes((channel?.workOrderStatus || '').toLowerCase());
                  if (isChannelReadOnly) {
                    return (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1, px: 0.5 }}>
                        Ce canal est en lecture seule (OT clôturé ou annulé). Vous pouvez consulter les messages mais pas en envoyer.
                      </Typography>
                    );
                  }
                  const hasAi = channel?.linkedType === 'work_order';
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={hasAi ? 'Écrire un message ou demander à l\'assistant IA…' : 'Écrire un message…'}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        multiline
                        maxRows={4}
                        disabled={sending || aiAssistLoading}
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 3,
                            bgcolor: isDark ? alpha(theme.palette.background.paper, 0.8) : '#fff',
                            border: '2px solid',
                            borderColor: alpha(theme.palette.primary.main, 0.35),
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            '&:hover': {
                              borderColor: alpha(theme.palette.primary.main, 0.6),
                              bgcolor: isDark ? undefined : '#fff'
                            },
                            '&.Mui-focused': {
                              borderColor: 'primary.main',
                              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
                              bgcolor: '#fff'
                            },
                            '&.Mui-disabled': { borderColor: 'divider', bgcolor: 'action.hover' }
                          },
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                        }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 0.75, mr: 0.25, gap: 0.75 }}>
                              {hasAi && (
                                <Tooltip title="Question à l'assistant IA (réponse basée sur l'OT)">
                                  <span style={{ display: 'inline-flex' }}>
                                    <IconButton
                                      onClick={handleAskAi}
                                      disabled={!input.trim() || aiAssistLoading || sending}
                                      size="small"
                                      sx={{
                                        width: 40,
                                        height: 40,
                                        bgcolor: alpha(theme.palette.secondary.main, 0.14),
                                        color: 'secondary.main',
                                        '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.24), color: 'secondary.dark' },
                                        '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
                                      }}
                                    >
                                      {aiAssistLoading ? <CircularProgress size={22} color="inherit" /> : <SmartToyIcon sx={{ fontSize: 22 }} />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                              <Tooltip title="Envoyer à l'équipe">
                                <span style={{ display: 'inline-flex' }}>
                                  <IconButton
                                    onClick={handleSend}
                                    disabled={!input.trim() || sending || aiAssistLoading}
                                    size="small"
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      bgcolor: 'primary.main',
                                      color: 'primary.contrastText',
                                      '&:hover': { bgcolor: 'primary.dark' },
                                      '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
                                    }}
                                  >
                                    {sending ? <CircularProgress size={22} color="inherit" /> : <SendIcon sx={{ fontSize: 22 }} />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </InputAdornment>
                          )
                        }}
                      />
                      {hasAi && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SendIcon sx={{ fontSize: 14, color: 'primary.main', opacity: 0.9 }} />
                            <Typography variant="caption" color="text.secondary">Message à l&apos;équipe</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SmartToyIcon sx={{ fontSize: 14, color: 'secondary.main', opacity: 0.9 }} />
                            <Typography variant="caption" color="text.secondary">Question à l&apos;assistant IA (contexte OT)</Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  );
                })()}
              </Box>
            </>
          )}
        </Box>
      </Paper>

      <Dialog open={createDialogOpen} onClose={() => { setCreateDialogOpen(false); setSearchParams({}); }} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau canal</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nom du canal"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="ex. Équipe, OT 42, Pompe P-01"
            sx={{ mt: 1 }}
          />
          {(createWo || createEq) && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Ce canal sera lié à {createWo ? `l'OT #${createWo}` : `l'équipement #${createEq}`}.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateDialogOpen(false); setSearchParams({}); }}>Annuler</Button>
          <Button variant="contained" onClick={handleCreateChannel} disabled={!newChannelName.trim() || createLoading}>
            {createLoading ? <CircularProgress size={24} /> : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
