import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Sparkles, MessageSquare, BellRing, WifiOff } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import TourGuide from './components/TourGuide';

const AVATAR_OPTIONS = ['🦊', '🐯', '🐼', '🐸', '🐙', '🦄', '🤖', '🧑‍💻', '🐱', '🦁', '🐻', '🐨'];

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('chatsync_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [toasts, setToasts] = useState([]);
  
  // Socket and Connection
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Lists & Messaging State
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState(() => {
    const saved = localStorage.getItem('chatsync_joined_groups');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [pinnedGroupCodes, setPinnedGroupCodes] = useState(() => {
    const saved = localStorage.getItem('chatsync_pinned_groups');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeChat, setActiveChat] = useState(null); // { type: 'group'|'direct', code?: string, partner?: string }
  const [groupDetails, setGroupDetails] = useState(null); // Full group details of active group
  const [groupMessages, setGroupMessages] = useState([]);
  const [directMessages, setDirectMessages] = useState([]); // Array of current active direct chat messages
  
  // Typing States
  const [typingUsers, setTypingUsers] = useState([]); // List of users typing in active group
  const [dmPartnerTyping, setDMPartnerTyping] = useState(false);

  // Tour Guide Onboarding
  const [showTour, setShowTour] = useState(false);

  // Keep track of pending joins from query string (?join=G-XXXXXX)
  const pendingJoinRef = useRef(null);

  // Refs to avoid stale closures in socket event listeners
  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const joinedGroupsRef = useRef(joinedGroups);
  useEffect(() => {
    joinedGroupsRef.current = joinedGroups;
  }, [joinedGroups]);

  // Toast notifier helper
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Parse invite join links on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      pendingJoinRef.current = joinCode;
      // Clean query parameter from address bar
      window.history.replaceState({}, document.title, window.location.pathname);
      // Run state changes asynchronously to avoid synchronous effect warnings
      setTimeout(() => {
        addToast(`Detected group invite link for ${joinCode}!`, 'info');
      }, 0);
    }

    // Check if first-time user
    const hasSeen = localStorage.getItem('chatsync_has_seen_tour');
    if (!hasSeen) {
      setTimeout(() => setShowTour(true), 0);
    }
  }, []);

  // Persist local state edits
  useEffect(() => {
    localStorage.setItem('chatsync_pinned_groups', JSON.stringify(pinnedGroupCodes));
  }, [pinnedGroupCodes]);

  useEffect(() => {
    localStorage.setItem('chatsync_joined_groups', JSON.stringify(joinedGroups));
  }, [joinedGroups]);

  // Establish Socket.io connection once profile is set
  useEffect(() => {
    if (!currentUser) return;

    // Connect strictly to 127.0.0.1
    const socket = io('http://127.0.0.1:3001', {
      transports: ['websocket'],
      withCredentials: true
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('register-user', { 
        username: currentUser.username, 
        avatar: currentUser.avatar 
      });
    });

    socket.on('registered', ({ username, friends: serverFriends, pendingRequests: serverRequests }) => {
      setFriends(serverFriends);
      setPendingRequests(serverRequests);
      
      // Update saved profile with finalized username if server changed it due to duplicates
      if (username !== currentUser.username) {
        const updated = { ...currentUser, username };
        setCurrentUser(updated);
        localStorage.setItem('chatsync_profile', JSON.stringify(updated));
      }

      // Check for pending join link queue
      if (pendingJoinRef.current) {
        socket.emit('join-group', { groupCode: pendingJoinRef.current });
        pendingJoinRef.current = null;
      } else {
        // Automatically rejoin previously joined rooms so Socket knows connections
        joinedGroupsRef.current.forEach(g => {
          socket.emit('join-group', { groupCode: g.code });
        });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Group created callback
    socket.on('group-created', (newGroup) => {
      setJoinedGroups(prev => {
        if (prev.some(g => g.code === newGroup.code)) return prev;
        return [...prev, { code: newGroup.code, name: newGroup.name, creator: newGroup.creator }];
      });
      setActiveChat({ type: 'group', code: newGroup.code });
      setGroupDetails(newGroup);
      setGroupMessages(newGroup.messages);
      addToast(`Group "${newGroup.name}" created successfully!`, 'success');
    });

    // Receive full active group details on join
    socket.on('group-details', (group) => {
      setGroupDetails(group);
      setGroupMessages(group.messages);
      
      setJoinedGroups(prev => {
        if (prev.some(g => g.code === group.code)) return prev;
        return [...prev, { code: group.code, name: group.name, creator: group.creator }];
      });

      const currentChat = activeChatRef.current;
      if (currentChat?.type === 'group' && currentChat.code === group.code) {
        // Just refresh messages
      } else {
        setActiveChat({ type: 'group', code: group.code });
      }
    });

    // Receive text/media message in group
    socket.on('group-message', (message) => {
      const currentChat = activeChatRef.current;
      // Filter by the matching groupCode to prevent mixing messages
      if (currentChat?.type === 'group' && currentChat.code === message.groupCode) {
        setGroupMessages(prev => [...prev, message]);
      } else {
        addToast(`New message from ${message.sender} in a group`, 'info');
      }
    });

    // Dynamic pins update
    socket.on('pins-updated', (pins) => {
      setGroupDetails(prev => {
        if (!prev) return null;
        return { ...prev, pinnedMessages: pins };
      });
      addToast('Pinned notices updated!', 'success');
    });

    // Dynamic member list update
    socket.on('user-joined', ({ username, avatar, members }) => {
      setGroupDetails(prev => {
        if (!prev) return null;
        return { ...prev, members };
      });
      addToast(`${avatar} ${username} joined the group.`, 'info');
    });

    socket.on('user-left', ({ username, members }) => {
      setGroupDetails(prev => {
        if (!prev) return null;
        return { ...prev, members };
      });
      addToast(`${username} left the group.`, 'info');
    });

    // Handle kicks
    socket.on('member-removed', ({ targetUsername, members }) => {
      setGroupDetails(prev => {
        if (!prev) return null;
        return { ...prev, members };
      });
      addToast(`${targetUsername} was removed from the group.`, 'info');
    });

    socket.on('kicked-from-group', (groupCode) => {
      addToast('You have been removed from the group chat by the creator.', 'error');
      setJoinedGroups(prev => prev.filter(g => g.code !== groupCode));
      
      const currentChat = activeChatRef.current;
      if (currentChat?.type === 'group' && currentChat.code === groupCode) {
        setActiveChat(null);
        setGroupDetails(null);
        setGroupMessages([]);
      }
    });

    // Handle group delete
    socket.on('group-deleted', (groupCode) => {
      addToast('Group has been deleted by the creator.', 'error');
      setJoinedGroups(prev => prev.filter(g => g.code !== groupCode));
      
      const currentChat = activeChatRef.current;
      if (currentChat?.type === 'group' && currentChat.code === groupCode) {
        setActiveChat(null);
        setGroupDetails(null);
        setGroupMessages([]);
      }
    });

    // Error alert
    socket.on('error-msg', (msg) => {
      addToast(msg, 'error');
    });

    // Friend list triggers
    socket.on('friend-request-sent', ({ target }) => {
      addToast(`Friend request sent to ${target}!`, 'success');
    });

    socket.on('incoming-friend-request', ({ from, pendingRequests: serverRequests }) => {
      setPendingRequests(serverRequests);
      addToast(`New friend request from ${from}!`, 'info');
    });

    socket.on('pending-requests-updated', ({ pendingRequests: serverRequests }) => {
      setPendingRequests(serverRequests);
    });

    socket.on('friend-list-updated', ({ friends: serverFriends }) => {
      setFriends(serverFriends);
      addToast('Your friend list was updated!', 'success');
    });

    // 1-to-1 Messaging receivers
    socket.on('direct-message', ({ message, partner }) => {
      const currentChat = activeChatRef.current;
      if (currentChat?.type === 'direct' && currentChat.partner === partner) {
        setDirectMessages(prev => [...prev, message]);
      } else {
        addToast(`New private message from ${message.sender}!`, 'success');
      }
    });

    socket.on('direct-chat-history', ({ partner, messages }) => {
      const currentChat = activeChatRef.current;
      if (currentChat?.type === 'direct' && currentChat.partner === partner) {
        setDirectMessages(messages);
      }
    });

    // Group typing triggers
    socket.on('typing-update', ({ username, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          if (prev.includes(username)) return prev;
          return [...prev, username];
        } else {
          return prev.filter(u => u !== username);
        }
      });
    });

    // Direct typing triggers
    socket.on('dm-typing-update', ({ username, isTyping }) => {
      const currentChat = activeChatRef.current;
      if (currentChat?.type === 'direct' && currentChat.partner === username) {
        setDMPartnerTyping(isTyping);
      }
    });

    // Cleanup connection
    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  // Request group chat details on active chat updates
  useEffect(() => {
    if (!socketRef.current || !connected) return;

    if (activeChat?.type === 'group') {
      socketRef.current.emit('join-group', { groupCode: activeChat.code });
      setTimeout(() => {
        setDMPartnerTyping(false);
      }, 0);
    } else if (activeChat?.type === 'direct') {
      socketRef.current.emit('get-direct-chat', { partner: activeChat.partner });
      setTimeout(() => {
        setTypingUsers([]);
        setDMPartnerTyping(false);
      }, 0);
    } else {
      setTimeout(() => {
        setGroupDetails(null);
        setGroupMessages([]);
        setDirectMessages([]);
        setTypingUsers([]);
        setDMPartnerTyping(false);
      }, 0);
    }
  }, [activeChat, connected]);

  // Profile save
  const handleRegisterProfile = (e) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      const profile = {
        username: usernameInput.trim(),
        avatar: selectedAvatar
      };
      setCurrentUser(profile);
      localStorage.setItem('chatsync_profile', JSON.stringify(profile));
      addToast(`Profile set as ${profile.username}!`, 'success');
    }
  };

  const handleResetProfile = () => {
    if (confirm('Are you sure you want to log out and reset your profile?')) {
      localStorage.removeItem('chatsync_profile');
      localStorage.removeItem('chatsync_joined_groups');
      localStorage.removeItem('chatsync_pinned_groups');
      setCurrentUser(null);
      setJoinedGroups([]);
      setFriends([]);
      setPendingRequests([]);
      setActiveChat(null);
      window.location.reload();
    }
  };

  // Group Handlers
  const handleCreateGroup = (groupName) => {
    socketRef.current?.emit('create-group', { groupName });
  };

  const handleJoinGroup = (groupCode) => {
    socketRef.current?.emit('join-group', { groupCode });
  };

  const handleSendGroupMessage = (groupCode, text, mediaUrl, mediaType, repliedTo) => {
    socketRef.current?.emit('send-group-message', {
      groupCode,
      text,
      mediaUrl,
      mediaType,
      repliedTo
    });
  };

  const handlePinMessage = (groupCode, messageId) => {
    socketRef.current?.emit('pin-message', { groupCode, messageId });
  };

  const handleRemoveMember = (groupCode, targetUsername) => {
    socketRef.current?.emit('remove-member', { groupCode, targetUsername });
  };

  const handleDeleteGroup = (groupCode) => {
    socketRef.current?.emit('delete-group', { groupCode });
  };

  // Friends Handlers
  const handleSendFriendRequest = (targetUsername) => {
    socketRef.current?.emit('send-friend-request', { targetUsername });
  };

  const handleRespondFriendRequest = (requestorUsername, accept) => {
    socketRef.current?.emit('respond-friend-request', { requestorUsername, accept });
  };

  const handleSendDirectMessage = (to, text, mediaUrl, mediaType, repliedTo) => {
    socketRef.current?.emit('send-direct-message', {
      to,
      text,
      mediaUrl,
      mediaType,
      repliedTo
    });
  };

  // Group typing notifier
  const handleToggleTyping = (roomCode, isTyping) => {
    socketRef.current?.emit('typing-status', { roomCode, isTyping });
  };

  // Direct typing notifier
  const handleToggleDMTyping = (partner, isTyping) => {
    socketRef.current?.emit('dm-typing-status', { partner, isTyping });
  };

  // Pin sidebar items
  const togglePinGroup = (groupCode) => {
    setPinnedGroupCodes(prev => {
      if (prev.includes(groupCode)) {
        return prev.filter(c => c !== groupCode);
      }
      return [...prev, groupCode];
    });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Dynamic Toast Messages */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <BellRing className="w-4 h-4" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Network Disconnect banner */}
      {currentUser && !connected && (
        <div style={{ background: 'var(--accent-red)', color: 'white', padding: '8px', textAlign: 'center', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 99 }}>
          <WifiOff className="w-4 h-4 animate-pulse" />
          Disconnected from ChatSync Server. Attempting to reconnect...
        </div>
      )}

      {/* Welcome Screen Profile Creation */}
      {!currentUser ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '16px' }}>
                <Sparkles className="w-10 h-10 animate-pulse" />
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 'bold', letterSpacing: '-0.02em' }}>Welcome to ChatSync</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>Create an ephemeral profile to begin real-time sync chatting.</p>
            </div>

            <form onSubmit={handleRegisterProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Nickname</label>
                <input 
                  type="text" 
                  placeholder="e.g. PixelPioneer" 
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="input-field"
                  maxLength={18}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Choose Avatar</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                  {AVATAR_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      style={{ 
                        fontSize: '1.6rem', 
                        padding: '8px', 
                        background: selectedAvatar === emoji ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.02)',
                        border: selectedAvatar === emoji ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '1rem', marginTop: '10px' }}>
                Enter Dashboard
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Connected Dashboard Area */
        <div className="dashboard-container">
          
          {/* Left Navigation bar */}
          <Sidebar
            currentUser={currentUser}
            friends={friends}
            pendingRequests={pendingRequests}
            joinedGroups={joinedGroups}
            pinnedGroupCodes={pinnedGroupCodes}
            togglePinGroup={togglePinGroup}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
            onCreateGroup={handleCreateGroup}
            onJoinGroup={handleJoinGroup}
            onSendFriendRequest={handleSendFriendRequest}
            onRespondFriendRequest={handleRespondFriendRequest}
            onTriggerTour={() => setShowTour(true)}
            onResetProfile={handleResetProfile}
          />

          {/* Active Chat Section */}
          {activeChat ? (
            <ChatArea
              currentUser={currentUser}
              activeChat={activeChat}
              groupDetails={groupDetails}
              directChatMessages={directMessages}
              groupMessages={groupMessages}
              pinnedMessages={groupDetails?.pinnedMessages || []}
              typingUsers={activeChat.type === 'group' ? typingUsers : (dmPartnerTyping ? [activeChat.partner] : [])}
              onSendGroupMessage={handleSendGroupMessage}
              onSendDirectMessage={handleSendDirectMessage}
              onPinMessage={handlePinMessage}
              onRemoveMember={handleRemoveMember}
              onDeleteGroup={handleDeleteGroup}
              onSendFriendRequest={handleSendFriendRequest}
              onToggleTyping={handleToggleTyping}
              onToggleDMTyping={handleToggleDMTyping}
            />
          ) : (
            /* Empty Chat Area Placeholder */
            <div className="chat-wrapper glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
              <div style={{ textAlign: 'center', maxWidth: '360px' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  padding: '20px', 
                  background: 'rgba(99, 102, 241, 0.05)', 
                  border: '1px solid rgba(99, 102, 241, 0.1)',
                  borderRadius: '50%', 
                  color: 'var(--primary)',
                  marginBottom: '20px'
                }}>
                  <MessageSquare className="w-12 h-12" />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '8px' }}>Start Syncing!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Select an active room or friend from the sidebar menu, or create a group to invite friends using code join-links.
                </p>
                
                <button 
                  onClick={() => setShowTour(true)}
                  className="btn-primary"
                  style={{ marginTop: '20px', fontSize: '0.85rem' }}
                >
                  Show Tour Guide
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Interactive Tour Guide Overlay Modal */}
      {showTour && (
        <TourGuide 
          onClose={() => {
            setShowTour(false);
            localStorage.setItem('chatsync_has_seen_tour', 'true');
          }} 
        />
      )}

    </div>
  );
}
