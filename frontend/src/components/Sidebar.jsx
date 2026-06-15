import React, { useState } from 'react';
import { 
  Plus, LogIn, Pin, User, Users, UserPlus, Heart, BellRing, 
  HelpCircle, Settings2, ShieldCheck, ChevronDown, UserMinus 
} from 'lucide-react';

export default function Sidebar({
  currentUser,
  friends,
  pendingRequests,
  joinedGroups,
  pinnedGroupCodes,
  togglePinGroup,
  activeChat,
  setActiveChat,
  onCreateGroup,
  onJoinGroup,
  onSendFriendRequest,
  onRespondFriendRequest,
  onTriggerTour,
  onResetProfile
}) {
  const [groupName, setGroupName] = useState('');
  const [groupCodeInput, setGroupCodeInput] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' or 'friends'

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (groupName.trim()) {
      onCreateGroup(groupName.trim());
      setGroupName('');
      setShowCreateGroup(false);
    }
  };

  const handleJoinGroup = (e) => {
    e.preventDefault();
    if (groupCodeInput.trim()) {
      onJoinGroup(groupCodeInput.trim());
      setGroupCodeInput('');
      setShowJoinGroup(false);
    }
  };

  const handleAddFriend = (e) => {
    e.preventDefault();
    if (friendUsername.trim()) {
      onSendFriendRequest(friendUsername.trim());
      setFriendUsername('');
      setShowAddFriend(false);
    }
  };

  // Sort groups: pinned ones first
  const sortedGroups = [...joinedGroups].sort((a, b) => {
    const aPinned = pinnedGroupCodes.includes(a.code);
    const bPinned = pinnedGroupCodes.includes(b.code);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <aside className="sidebar-wrapper glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* User Profile Info */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '1.4rem',
            border: '2px solid rgba(255,255,255,0.1)'
          }}>
            {currentUser.avatar || '👤'}
          </div>
          <div>
            <h4 style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{currentUser.username}</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }}></span>
              Online
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={onTriggerTour} 
            title="Start App Tour"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
            className="btn-secondary"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button 
            onClick={onResetProfile} 
            title="Reset Profile"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
            className="btn-secondary"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.1)' }}>
        <button
          onClick={() => setActiveTab('groups')}
          style={{ 
            flex: 1, 
            padding: '12px', 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'groups' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'groups' ? '2px solid var(--primary)' : 'none',
            fontWeight: activeTab === 'groups' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Users className="w-4 h-4" />
          Groups ({joinedGroups.length})
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          style={{ 
            flex: 1, 
            padding: '12px', 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'friends' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'friends' ? '2px solid var(--primary)' : 'none',
            fontWeight: activeTab === 'friends' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Heart className="w-4 h-4" />
          Friends ({friends.length})
        </button>
      </div>

      {/* Main sidebar content body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Tab 1: Groups list view */}
        {activeTab === 'groups' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setShowCreateGroup(!showCreateGroup)} 
                className="btn-primary" 
                style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px' }}
              >
                <Plus className="w-4 h-4" /> Create Group
              </button>
              <button 
                onClick={() => setShowJoinGroup(!showJoinGroup)} 
                className="btn-secondary" 
                style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px' }}
              >
                <LogIn className="w-4 h-4" /> Join with Code
              </button>
            </div>

            {/* Create Group Form Modal */}
            {showCreateGroup && (
              <form onSubmit={handleCreateGroup} className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Enter Group Name" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  maxLength={25}
                  required
                />
                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '6px 12px', fontSize: '0.85rem', justifyContent: 'center' }}>
                  Create
                </button>
              </form>
            )}

            {/* Join Group Form Modal */}
            {showJoinGroup && (
              <form onSubmit={handleJoinGroup} className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Enter Group Code (e.g. G-XXXXXX)" 
                  value={groupCodeInput}
                  onChange={(e) => setGroupCodeInput(e.target.value)}
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  required
                />
                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '6px 12px', fontSize: '0.85rem', justifyContent: 'center' }}>
                  Join
                </button>
              </form>
            )}

            {/* Group Lists */}
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>
                Joined Rooms
              </span>
              
              {sortedGroups.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                  No groups joined yet. Create or join one to begin syncing!
                </p>
              ) : (
                sortedGroups.map(group => {
                  const isPinned = pinnedGroupCodes.includes(group.code);
                  const isActive = activeChat?.type === 'group' && activeChat?.code === group.code;
                  return (
                    <div 
                      key={group.code}
                      onClick={() => setActiveChat({ type: 'group', code: group.code })}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        background: isActive ? 'var(--glass-bg-active)' : 'var(--glass-bg)',
                        border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--glass-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                      }}
                      className="group-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: '38px', 
                          height: '38px', 
                          borderRadius: '8px', 
                          background: 'rgba(99, 102, 241, 0.1)', 
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          color: 'var(--primary)'
                        }}>
                          #
                        </div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {group.name}
                            {group.creator === currentUser.username && (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                Admin
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {group.code}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinGroup(group.code);
                        }}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer', 
                          color: isPinned ? 'var(--accent-yellow)' : 'var(--text-muted)' 
                        }}
                      >
                        <Pin className="w-3.5 h-3.5" fill={isPinned ? 'var(--accent-yellow)' : 'none'} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Friends and Private Direct messages */}
        {activeTab === 'friends' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Friends Action Section */}
            <button 
              onClick={() => setShowAddFriend(!showAddFriend)} 
              className="btn-primary" 
              style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px' }}
            >
              <UserPlus className="w-4 h-4" /> Add Friend
            </button>

            {showAddFriend && (
              <form onSubmit={handleAddFriend} className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Enter Friend's Nickname" 
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  required
                />
                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '6px 12px', fontSize: '0.85rem', justifyContent: 'center' }}>
                  Send Friend Request
                </button>
              </form>
            )}

            {/* Pending Incoming Requests Notification Banner */}
            {pendingRequests.length > 0 && (
              <div className="glass-panel" style={{ padding: '12px', borderLeft: '4px solid var(--accent-yellow)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-yellow)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  <BellRing className="w-4 h-4 animate-bounce" />
                  Friend Requests ({pendingRequests.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingRequests.map(reqName => (
                    <div key={reqName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '4px' }}>
                      <span style={{ fontWeight: '500' }}>{reqName}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          onClick={() => onRespondFriendRequest(reqName, true)}
                          className="btn-primary"
                          style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'var(--accent-green)', boxShadow: 'none' }}
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => onRespondFriendRequest(reqName, false)}
                          className="btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list map */}
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>
                Active Friends
              </span>

              {friends.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                  No friends added yet. Add a friend or click a user in group chats to connect!
                </p>
              ) : (
                friends.map(friendName => {
                  const isActive = activeChat?.type === 'direct' && activeChat?.partner === friendName;
                  return (
                    <div
                      key={friendName}
                      onClick={() => setActiveChat({ type: 'direct', partner: friendName })}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        background: isActive ? 'var(--glass-bg-active)' : 'var(--glass-bg)',
                        border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--glass-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '34px', 
                          height: '34px', 
                          borderRadius: '50%', 
                          background: 'rgba(255,255,255,0.05)', 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--glass-border)'
                        }}>
                          <User className="w-4 h-4" />
                        </div>
                        <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{friendName}</span>
                      </div>

                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)' }}></span>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>
    </aside>
  );
}
