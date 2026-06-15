import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Paperclip, Pin, X, ShieldAlert, UserPlus, 
  Trash2, Link2, Copy, Smile, Image, Video, CornerDownRight, 
  Users, MessageSquare, Maximize2, Sparkles, Check 
} from 'lucide-react';

export default function ChatArea({
  currentUser,
  activeChat,
  groupDetails,
  directChatMessages,
  groupMessages,
  pinnedMessages,
  typingUsers,
  onSendGroupMessage,
  onSendDirectMessage,
  onPinMessage,
  onRemoveMember,
  onDeleteGroup,
  onSendFriendRequest,
  onToggleTyping,
  onToggleDMTyping
}) {
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [replyContext, setReplyContext] = useState(null); // { id, sender, text }
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Mentions
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  // Modals
  const [zoomImage, setZoomImage] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages, directChatMessages, typingUsers]);

  // Typing indicator trigger
  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);
    const pos = e.target.selectionStart;
    setCursorPosition(pos);

    // Mentions logic inside group chats
    if (activeChat.type === 'group' && groupDetails) {
      const lastAtIdx = text.lastIndexOf('@', pos - 1);
      if (lastAtIdx !== -1 && (lastAtIdx === 0 || text[lastAtIdx - 1] === ' ')) {
        const textAfterAt = text.substring(lastAtIdx + 1, pos);
        if (!textAfterAt.includes(' ')) {
          setShowMentions(true);
          setMentionFilter(textAfterAt.toLowerCase());
        } else {
          setShowMentions(false);
        }
      } else {
        setShowMentions(false);
      }
    }

    // Trigger typing socket notification
    if (activeChat.type === 'group') {
      onToggleTyping(activeChat.code, true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onToggleTyping(activeChat.code, false);
      }, 1500);
    } else if (activeChat.type === 'direct') {
      onToggleDMTyping(activeChat.partner, true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onToggleDMTyping(activeChat.partner, false);
      }, 1500);
    }
  };

  const selectMention = (username) => {
    const text = inputText;
    const pos = cursorPosition;
    const lastAtIdx = text.lastIndexOf('@', pos - 1);
    if (lastAtIdx !== -1) {
      const beforeAt = text.substring(0, lastAtIdx);
      const afterCursor = text.substring(pos);
      const newText = `${beforeAt}@${username} ${afterCursor}`;
      setInputText(newText);
      setShowMentions(false);
      inputRef.current?.focus();
    }
  };

  // Handle file select
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    setFileType(type);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload file to Express API
  const uploadFile = async () => {
    if (!selectedFile) return null;
    setUploading(true);
    const formData = new FormData();
    formData.append('media', selectedFile);

    try {
      const res = await fetch('http://127.0.0.1:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      return data; // { mediaUrl, mediaType }
    } catch (err) {
      console.error(err);
      alert('Failed to upload file. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Handle message submit
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    let mediaData = null;
    if (selectedFile) {
      mediaData = await uploadFile();
      if (!mediaData) return; // cancel if upload fails
    }

    const mediaUrl = mediaData ? mediaData.mediaUrl : null;
    const mediaType = mediaData ? mediaData.mediaType : null;

    if (activeChat.type === 'group') {
      onSendGroupMessage(
        activeChat.code,
        inputText,
        mediaUrl,
        mediaType,
        replyContext
      );
      onToggleTyping(activeChat.code, false);
    } else {
      onSendDirectMessage(
        activeChat.partner,
        inputText,
        mediaUrl,
        mediaType,
        replyContext
      );
      onToggleDMTyping(activeChat.partner, false);
    }

    // Reset Form
    setInputText('');
    setSelectedFile(null);
    setFilePreview(null);
    setFileType(null);
    setReplyContext(null);
    setShowMentions(false);
  };

  const copyCode = () => {
    if (!groupDetails) return;
    navigator.clipboard.writeText(groupDetails.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    if (!groupDetails) return;
    const joinLink = `${window.location.origin}?join=${groupDetails.code}`;
    navigator.clipboard.writeText(joinLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Message renderer helpers
  const renderMessageText = (text) => {
    if (!text) return '';
    // Format @mentions with highlighted span tags
    const words = text.split(' ');
    return words.map((word, i) => {
      if (word.startsWith('@') && word.length > 1) {
        const username = word.substring(1);
        return (
          <span key={i} style={{ color: 'var(--primary)', fontWeight: 'bold', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '4px', margin: '0 2px' }}>
            {word}
          </span>
        );
      }
      return word + ' ';
    });
  };

  // Determine message listing
  const isGroup = activeChat.type === 'group';
  const chatTitle = isGroup ? (groupDetails?.name || 'Group Chat') : `Direct Chat with ${activeChat.partner}`;
  const currentMessages = isGroup ? groupMessages : directChatMessages;

  // Filter mentions
  const filterMembers = groupDetails?.members.filter(m => 
    m.username !== currentUser.username && 
    m.username.toLowerCase().includes(mentionFilter)
  ) || [];

  return (
    <div className="chat-wrapper glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* Chat Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)' }}>
        <div>
          <h3 style={{ fontWeight: '600', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isGroup ? <Users className="w-5 h-5 text-indigo-400" /> : <MessageSquare className="w-5 h-5 text-emerald-400" />}
            {chatTitle}
          </h3>
          {isGroup && groupDetails && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Creator: {groupDetails.creator} | {groupDetails.members.length} members
            </span>
          )}
        </div>

        {/* Group Info / Invite badge toolbar */}
        {isGroup && groupDetails && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            
            {/* Copy Invitation Badges */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '18px', padding: '2px 8px', gap: '6px' }}>
              <button 
                onClick={copyCode} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}
                title="Copy Group Join Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                Code: {groupDetails.code}
              </button>
              <span style={{ color: 'var(--glass-border)', fontSize: '0.8rem' }}>|</span>
              <button 
                onClick={copyLink} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}
                title="Copy Quick Join Link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Link2 className="w-3.5 h-3.5" />}
                Join Link
              </button>
            </div>

            {/* View Members Panel */}
            <button 
              onClick={() => setShowMembersModal(true)} 
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Members
            </button>

            {/* Delete Group (Creator Only) */}
            {groupDetails.creator === currentUser.username && (
              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to delete this group? All members will be disconnected.')) {
                    onDeleteGroup(groupDetails.code);
                  }
                }}
                className="btn-secondary"
                style={{ padding: '6px 10px', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                title="Delete Group"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pinned Messages Banner inside Groups */}
      {isGroup && pinnedMessages.length > 0 && groupDetails && (
        <div style={{ background: 'rgba(99, 102, 241, 0.1)', borderBottom: '1px solid rgba(99, 102, 241, 0.2)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <Pin className="w-4 h-4 text-accent-yellow" fill="var(--accent-yellow)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Pinned Notice:</span>
          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
            {(() => {
              const latestPinId = pinnedMessages[pinnedMessages.length - 1];
              const msg = groupMessages.find(m => m.id === latestPinId);
              return msg ? `${msg.sender}: ${msg.text || '[Media]'}` : 'No messages pinned';
            })()}
          </div>
        </div>
      )}

      {/* Message Stream Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {currentMessages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', maxWidth: '300px' }}>
            <Sparkles className="w-8 h-8 mx-auto text-indigo-400" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '0.9rem' }}>Secure connection established. Type a message or drop files to sync.</p>
          </div>
        ) : (
          currentMessages.map(msg => {
            const isSelf = msg.sender === currentUser.username;
            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: isSelf ? 'flex-end' : 'flex-start',
                  animation: 'fadeInUp 0.2s ease',
                  position: 'relative'
                }}
                onDoubleClick={() => setReplyContext({ id: msg.id, sender: msg.sender, text: msg.text })}
              >
                
                {/* Sender Name (Non-self group chats) */}
                {isGroup && !isSelf && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', marginLeft: '8px', fontWeight: '500' }}>
                    {msg.avatar} {msg.sender}
                  </span>
                )}

                {/* Message Bubble box */}
                <div 
                  style={{ 
                    background: isSelf 
                      ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' 
                      : 'rgba(255,255,255,0.04)',
                    border: isSelf ? 'none' : '1px solid var(--glass-border)',
                    padding: '10px 16px',
                    borderRadius: '16px',
                    borderTopRightRadius: isSelf ? '4px' : '16px',
                    borderTopLeftRadius: isSelf ? '16px' : '4px',
                    maxWidth: '65%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    position: 'relative'
                  }}
                >
                  
                  {/* Replied-to Quote Render */}
                  {msg.repliedTo && (
                    <div style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      borderLeft: '3px solid var(--accent-yellow)', 
                      padding: '6px 10px', 
                      borderRadius: '4px',
                      marginBottom: '8px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>@{msg.repliedTo.sender}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.repliedTo.text || '[Media]'}</span>
                    </div>
                  )}

                  {/* Render Images */}
                  {msg.mediaUrl && msg.mediaType === 'image' && (
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', marginBottom: '6px', cursor: 'zoom-in' }} onClick={() => setZoomImage(msg.mediaUrl)}>
                      <img 
                        src={`http://127.0.0.1:3001${msg.mediaUrl}`} 
                        alt="Shared image" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} 
                      />
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '50%' }}>
                        <Maximize2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}

                  {/* Render Videos */}
                  {msg.mediaUrl && msg.mediaType === 'video' && (
                    <div style={{ overflow: 'hidden', borderRadius: '8px', marginBottom: '6px' }}>
                      <video 
                        src={`http://127.0.0.1:3001${msg.mediaUrl}`} 
                        controls 
                        style={{ width: '100%', maxHeight: '240px', display: 'block', borderRadius: '8px' }} 
                      />
                    </div>
                  )}

                  {/* Message text */}
                  {msg.text && (
                    <p style={{ fontSize: '0.92rem', lineHeight: '1.4', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                      {renderMessageText(msg.text)}
                    </p>
                  )}

                  {/* Message Actions & Timestamp panel */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    
                    {/* Timestamp */}
                    <span style={{ fontSize: '0.65rem', color: isSelf ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Group pin option */}
                    {isGroup && (
                      <button 
                        onClick={() => onPinMessage(groupDetails.code, msg.id)}
                        style={{ background: 'none', border: 'none', color: pinnedMessages.includes(msg.id) ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', padding: '2px' }}
                        title={pinnedMessages.includes(msg.id) ? 'Unpin message' : 'Pin message'}
                      >
                        <Pin className="w-3 h-3" fill={pinnedMessages.includes(msg.id) ? 'var(--accent-yellow)' : 'none'} />
                      </button>
                    )}

                    {/* Reply option trigger */}
                    <button 
                      onClick={() => setReplyContext({ id: msg.id, sender: msg.sender, text: msg.text })}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', padding: '2px' }}
                      title="Reply to message"
                    >
                      <CornerDownRight className="w-3 h-3" />
                    </button>
                  </div>

                </div>

              </div>
            );
          })
        )}

        {/* Typing Bubble list rendering */}
        {typingUsers.length > 0 && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="typing-bubble">
              <div style={{ display: 'flex', gap: '3px', marginRight: '6px' }}>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
              <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Mention List Panel */}
      {showMentions && filterMembers.length > 0 && (
        <div className="glass-panel" style={{ position: 'absolute', bottom: selectedFile ? '190px' : '90px', left: '20px', right: '20px', zIndex: 10, padding: '8px 0', maxH: '150px', overflowY: 'auto', background: 'rgba(15, 12, 38, 0.95)' }}>
          <span style={{ fontSize: '0.7rem', padding: '4px 16px', display: 'block', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Mention Room Member
          </span>
          {filterMembers.map(member => (
            <div 
              key={member.username}
              onClick={() => selectMention(member.username)}
              style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              className="hover:bg-slate-800"
            >
              <span>{member.avatar}</span>
              <span style={{ fontWeight: '500' }}>{member.username}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active Form Footer Input panel */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.1)' }}>
        
        {/* Reply/Quote contextual preview */}
        {replyContext && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--primary)', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Replying to @{replyContext.sender}</span>
              <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {replyContext.text || '[Media file]'}
              </span>
            </div>
            <button onClick={() => setReplyContext(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected Media/File attachment preview panel */}
        {filePreview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '8px 12px', borderRadius: '8px', position: 'relative' }}>
            {fileType === 'image' ? (
              <img src={filePreview} alt="Upload preview" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
            ) : (
              <div style={{ width: '50px', height: '50px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video className="w-6 h-6 text-indigo-400" />
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedFile.name}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>

            <button 
              onClick={() => {
                setSelectedFile(null);
                setFilePreview(null);
                setFileType(null);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 'auto' }}
            >
              <X className="w-5 h-5 text-red-400" />
            </button>
          </div>
        )}

        {/* Input submission bar */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          
          {/* File input button */}
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            style={{ padding: '12px', borderRadius: '50%', flexShrink: 0 }}
            title="Attach file (Image/Video)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*"
            style={{ display: 'none' }} 
          />

          {/* Text Input */}
          <input 
            type="text" 
            ref={inputRef}
            placeholder={activeChat.type === 'group' ? "Send message (type @ for members)" : "Type a secure message..."}
            value={inputText}
            onChange={handleInputChange}
            className="input-field"
            style={{ borderRadius: '24px' }}
          />

          {/* Submit button */}
          <button 
            type="submit" 
            disabled={uploading}
            className="btn-primary" 
            style={{ padding: '12px', borderRadius: '50%', flexShrink: 0, background: uploading ? 'var(--text-muted)' : '' }}
          >
            <Send className="w-5 h-5" />
          </button>

        </form>
      </div>

      {/* Modal Zoom Overlay for Images */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', animation: 'fadeIn 0.2s ease' }}
        >
          <img 
            src={`http://127.0.0.1:3001${zoomImage}`} 
            alt="Zoom view" 
            style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} 
          />
        </div>
      )}

      {/* Group Members Modal View */}
      {showMembersModal && isGroup && groupDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '24px', background: 'rgba(15, 12, 38, 0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Group Members</h3>
              <button onClick={() => setShowMembersModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxH: '300px', overflowY: 'auto' }}>
              {groupDetails.members.map(member => (
                <div key={member.username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.3rem' }}>{member.avatar}</span>
                    <div>
                      <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{member.username}</span>
                      {groupDetails.creator === member.username && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 4px', borderRadius: '4px', marginLeft: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          Admin
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Member Actions */}
                  {member.username !== currentUser.username && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      
                      {/* Send Friend Request */}
                      <button
                        onClick={() => {
                          onSendFriendRequest(member.username);
                        }}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
                        title="Add Friend"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>

                      {/* Kick Member (Creator Only) */}
                      {groupDetails.creator === currentUser.username && (
                        <button
                          onClick={() => {
                            if (confirm(`Kick ${member.username} from this group?`)) {
                              onRemoveMember(groupDetails.code, member.username);
                            }
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.1)', gap: '4px' }}
                          title="Remove Member"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                      )}

                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
