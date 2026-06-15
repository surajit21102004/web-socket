const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3001;
const HOST = '127.0.0.1'; // MUST listen on localhost or 127.0.0.1 when testing

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
}

// Enable CORS
app.use(cors({
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

// In-memory data store
const groups = {}; // groupCode -> { name, code, creator, members: [], messages: [], pinnedMessages: [] }
const onlineUsers = {}; // socketId -> { username, avatar, currentRoom }
const usernameToSocket = {}; // username -> socketId
const friends = {}; // username -> Set of usernames
const pendingRequests = {}; // username -> Set of usernames (who sent requests to this username)
const directChats = {}; // chatId (sortedName1:sortedName2) -> messages[]

// Multer configurations for secure file upload
const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate secure random filename
    const fileExt = path.extname(file.originalname).toLowerCase();
    const secureName = crypto.randomBytes(16).toString('hex') + fileExt;
    cb(null, secureName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only standard images and videos are allowed.'));
    }
  }
});

// File Upload endpoint
app.post('/api/upload', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type rejected.' });
  }

  // Set file permissions to be non-executable (0o644)
  try {
    fs.chmodSync(req.file.path, 0o644);
  } catch (err) {
    console.error('Failed to set file permissions:', err);
  }

  const mediaUrl = `/api/media/${req.file.filename}`;
  const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

  res.json({
    mediaUrl,
    mediaType,
    filename: req.file.filename
  });
});

// Secure Media Retrieval
app.get('/api/media/:filename', (req, res) => {
  // Prevent path traversal by extracting only the base filename
  const filename = path.basename(req.params.filename);
  const safePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(safePath)) {
    return res.status(404).json({ error: 'Media file not found' });
  }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline'); // display inside chat cleanly

  // Determine Content-Type
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.mp4') contentType = 'video/mp4';
  else if (ext === '.webm') contentType = 'video/webm';

  res.setHeader('Content-Type', contentType);
  res.sendFile(safePath);
});

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Helper functions
function getDirectChatId(user1, user2) {
  return [user1, user2].sort().join(':');
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register or update user profile mapping
  socket.on('register-user', ({ username, avatar }) => {
    // If username is already taken by someone else online, force prefix/unique
    let finalUsername = username.trim();
    if (!finalUsername) finalUsername = `Guest_${socket.id.substring(0, 5)}`;

    onlineUsers[socket.id] = { username: finalUsername, avatar, currentRoom: null };
    usernameToSocket[finalUsername] = socket.id;

    if (!friends[finalUsername]) friends[finalUsername] = new Set();
    if (!pendingRequests[finalUsername]) pendingRequests[finalUsername] = new Set();

    socket.emit('registered', {
      username: finalUsername,
      friends: Array.from(friends[finalUsername]),
      pendingRequests: Array.from(pendingRequests[finalUsername])
    });

    console.log(`User registered: ${finalUsername} (Socket: ${socket.id})`);
  });

  // Create Group
  socket.on('create-group', ({ groupName }) => {
    const user = onlineUsers[socket.id];
    if (!user) return socket.emit('error-msg', 'User not registered');

    // Generate unique group code G-XXXXXX
    let groupCode;
    do {
      groupCode = 'G-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (groups[groupCode]);

    groups[groupCode] = {
      name: groupName,
      code: groupCode,
      creator: user.username,
      members: [{ username: user.username, avatar: user.avatar, socketId: socket.id }],
      messages: [],
      pinnedMessages: []
    };

    user.currentRoom = groupCode;
    socket.join(`group:${groupCode}`);
    socket.emit('group-created', groups[groupCode]);

    console.log(`Group created: ${groupName} (${groupCode}) by ${user.username}`);
  });

  // Join Group
  socket.on('join-group', ({ groupCode }) => {
    const user = onlineUsers[socket.id];
    if (!user) return socket.emit('error-msg', 'User not registered');

    const group = groups[groupCode];
    if (!group) return socket.emit('error-msg', 'Group not found');

    // Add member if not already in group
    const isMember = group.members.some(m => m.username === user.username);
    let shouldBroadcastJoin = false;

    if (!isMember) {
      group.members.push({ username: user.username, avatar: user.avatar, socketId: socket.id });
      shouldBroadcastJoin = true;
    } else {
      // Update socket ID if rejoining (reconnection)
      const memberIndex = group.members.findIndex(m => m.username === user.username);
      if (group.members[memberIndex].socketId !== socket.id) {
        group.members[memberIndex].socketId = socket.id;
        shouldBroadcastJoin = true; // only notify if socket changed (reconnection)
      }
    }

    user.currentRoom = groupCode;
    socket.join(`group:${groupCode}`);

    // Only notify others in room if it's a new join or reconnect
    if (shouldBroadcastJoin) {
      socket.to(`group:${groupCode}`).emit('user-joined', {
        username: user.username,
        avatar: user.avatar,
        members: group.members
      });
    }

    socket.emit('group-details', group);
    console.log(`${user.username} joined group ${groupCode} (shouldBroadcast: ${shouldBroadcastJoin})`);
  });

  // Leave Group
  socket.on('leave-group', ({ groupCode }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const group = groups[groupCode];
    if (!group) return;

    group.members = group.members.filter(m => m.username !== user.username);
    user.currentRoom = null;
    socket.leave(`group:${groupCode}`);

    socket.to(`group:${groupCode}`).emit('user-left', {
      username: user.username,
      members: group.members
    });

    socket.emit('left-group-success', groupCode);
    console.log(`${user.username} left group ${groupCode}`);
  });

  // Send Message inside group
  socket.on('send-group-message', ({ groupCode, text, mediaUrl, mediaType, repliedTo }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const group = groups[groupCode];
    if (!group) return;

    const message = {
      id: crypto.randomUUID(),
      groupCode: groupCode, // Include groupCode so client can filter/route
      sender: user.username,
      avatar: user.avatar,
      text: text || '',
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      repliedTo: repliedTo || null, // Contains { id, sender, text }
      timestamp: Date.now()
    };

    group.messages.push(message);

    io.to(`group:${groupCode}`).emit('group-message', message);
  });

  // Pin Message
  socket.on('pin-message', ({ groupCode, messageId }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const group = groups[groupCode];
    if (!group) return;

    const isPinned = group.pinnedMessages.includes(messageId);
    if (isPinned) {
      group.pinnedMessages = group.pinnedMessages.filter(id => id !== messageId);
    } else {
      group.pinnedMessages.push(messageId);
    }

    io.to(`group:${groupCode}`).emit('pins-updated', group.pinnedMessages);
  });

  // Remove Member (Admin only)
  socket.on('remove-member', ({ groupCode, targetUsername }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const group = groups[groupCode];
    if (!group) return;

    if (group.creator !== user.username) {
      return socket.emit('error-msg', 'Only the group creator can remove members.');
    }

    const targetIndex = group.members.findIndex(m => m.username === targetUsername);
    if (targetIndex === -1) return;

    const targetSocketId = group.members[targetIndex].socketId;
    group.members.splice(targetIndex, 1);

    // Broadcast updated members list
    io.to(`group:${groupCode}`).emit('member-removed', {
      targetUsername,
      members: group.members
    });

    // Notify the kicked member if online
    if (targetSocketId && io.sockets.sockets.get(targetSocketId)) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      targetSocket.leave(`group:${groupCode}`);
      if (onlineUsers[targetSocketId]) {
        onlineUsers[targetSocketId].currentRoom = null;
      }
      targetSocket.emit('kicked-from-group', groupCode);
    }

    console.log(`User ${targetUsername} kicked from ${groupCode} by admin ${user.username}`);
  });

  // Delete Group (Admin only)
  socket.on('delete-group', ({ groupCode }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const group = groups[groupCode];
    if (!group) return;

    if (group.creator !== user.username) {
      return socket.emit('error-msg', 'Only the group creator can delete the group.');
    }

    io.to(`group:${groupCode}`).emit('group-deleted', groupCode);

    // Make all members leave
    group.members.forEach(m => {
      const mSocket = io.sockets.sockets.get(m.socketId);
      if (mSocket) {
        mSocket.leave(`group:${groupCode}`);
        if (onlineUsers[m.socketId]) {
          onlineUsers[m.socketId].currentRoom = null;
        }
      }
    });

    delete groups[groupCode];
    console.log(`Group ${groupCode} deleted by creator ${user.username}`);
  });

  // Send Friend Request
  socket.on('send-friend-request', ({ targetUsername }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const target = targetUsername.trim();
    if (target === user.username) {
      return socket.emit('error-msg', 'You cannot send a friend request to yourself.');
    }

    // Check if already friends
    if (friends[user.username] && friends[user.username].has(target)) {
      return socket.emit('error-msg', `You are already friends with ${target}.`);
    }

    // Initialize collections
    if (!pendingRequests[target]) pendingRequests[target] = new Set();
    pendingRequests[target].add(user.username);

    // Notify target user if online
    const targetSocketId = usernameToSocket[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit('incoming-friend-request', {
        from: user.username,
        pendingRequests: Array.from(pendingRequests[target])
      });
    }

    socket.emit('friend-request-sent', { target });
    console.log(`Friend request sent from ${user.username} to ${target}`);
  });

  // Respond to Friend Request
  socket.on('respond-friend-request', ({ requestorUsername, accept }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    if (!pendingRequests[user.username] || !pendingRequests[user.username].has(requestorUsername)) {
      return;
    }

    // Remove from pending
    pendingRequests[user.username].delete(requestorUsername);

    if (accept) {
      if (!friends[user.username]) friends[user.username] = new Set();
      if (!friends[requestorUsername]) friends[requestorUsername] = new Set();

      friends[user.username].add(requestorUsername);
      friends[requestorUsername].add(user.username);

      // Notify both sides of the new friend list
      const requestorSocketId = usernameToSocket[requestorUsername];
      if (requestorSocketId) {
        io.to(requestorSocketId).emit('friend-list-updated', {
          friends: Array.from(friends[requestorUsername])
        });
      }

      socket.emit('friend-list-updated', {
        friends: Array.from(friends[user.username])
      });
    }

    // Update pending requests list for recipient
    socket.emit('pending-requests-updated', {
      pendingRequests: Array.from(pendingRequests[user.username])
    });

    console.log(`Friend request from ${requestorUsername} to ${user.username} - Accepted: ${accept}`);
  });

  // Send Direct Message
  socket.on('send-direct-message', ({ to, text, mediaUrl, mediaType, repliedTo }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    // Verify friendship first
    if (!friends[user.username] || !friends[user.username].has(to)) {
      return socket.emit('error-msg', 'You can only message registered friends.');
    }

    const chatId = getDirectChatId(user.username, to);
    if (!directChats[chatId]) {
      directChats[chatId] = [];
    }

    const message = {
      id: crypto.randomUUID(),
      sender: user.username,
      avatar: user.avatar,
      text: text || '',
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      repliedTo: repliedTo || null,
      timestamp: Date.now()
    };

    directChats[chatId].push(message);

    // Send to recipient if online
    const targetSocketId = usernameToSocket[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('direct-message', {
        chatId,
        message,
        partner: user.username
      });
    }

    // Send back to self
    socket.emit('direct-message', {
      chatId,
      message,
      partner: to
    });
  });

  // Fetch Direct Chat History
  socket.on('get-direct-chat', ({ partner }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const chatId = getDirectChatId(user.username, partner);
    const messages = directChats[chatId] || [];

    socket.emit('direct-chat-history', {
      chatId,
      partner,
      messages
    });
  });

  // Handle typing status updates
  socket.on('typing-status', ({ roomCode, isTyping }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    socket.to(`group:${roomCode}`).emit('typing-update', {
      username: user.username,
      isTyping
    });
  });

  // Handle direct message typing
  socket.on('dm-typing-status', ({ partner, isTyping }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    const targetSocketId = usernameToSocket[partner];
    if (targetSocketId) {
      io.to(targetSocketId).emit('dm-typing-update', {
        username: user.username,
        isTyping
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    if (user) {
      console.log(`User disconnected: ${user.username} (${socket.id})`);

      // If in group, notify group
      if (user.currentRoom) {
        const group = groups[user.currentRoom];
        if (group) {
          group.members = group.members.filter(m => m.username !== user.username);
          socket.to(`group:${user.currentRoom}`).emit('user-left', {
            username: user.username,
            members: group.members
          });
        }
      }

      delete usernameToSocket[user.username];
      delete onlineUsers[socket.id];
    }
  });
});

// Start listening
server.listen(PORT, HOST, () => {
  console.log(`[ChatSync Backend] Server running at http://${HOST}:${PORT}`);
});
