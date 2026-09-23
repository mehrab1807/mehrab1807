/**
 * db.js - IndexedDB storage abstraction using Dexie.js for offline-first resilience.
 * Extended with Task Reminders, Scratchpad Notes, and Full-Text Searching across Posts and Files.
 */

(function () {
  'use strict';

  if (typeof Dexie === 'undefined') {
    console.error('Dexie.js is not loaded. Ensure dexie.js CDN is included before db.js.');
    return;
  }

  const db = new Dexie('PersonalDiaryDB');

  db.version(1).stores({
    posts: 'id, timestamp, year, month, day, mood, synced, createdAt',
    media: 'id, postId, name, mimeType, size, driveFileId, isVault, createdAt',
    chat_history: 'id, role, timestamp, synced',
    vault: 'id, name, mimeType, size, driveFileId, uploadedAt, synced',
    settings: 'key'
  });

  db.version(2).stores({
    posts: 'id, timestamp, year, month, day, mood, synced, createdAt',
    media: 'id, postId, name, mimeType, size, driveFileId, isVault, createdAt',
    chat_history: 'id, role, timestamp, synced',
    vault: 'id, name, mimeType, size, driveFileId, uploadedAt, synced',
    settings: 'key',
    tasks: 'id, title, dueDate, completed, priority, reminder, createdAt, updatedAt, synced',
    notes: 'id, title, pinned, createdAt, updatedAt, synced'
  });

  const DiaryDB = {
    db,

    // Post Operations
    async savePost(post) {
      if (!post.id) {
        post.id = 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }
      const postDate = post.timestamp ? new Date(post.timestamp) : new Date();
      post.timestamp = postDate.toISOString();
      post.year = postDate.getFullYear();
      post.month = postDate.getMonth() + 1; // 1-12
      post.day = postDate.getDate();
      post.createdAt = post.createdAt || Date.now();
      post.updatedAt = Date.now();
      if (typeof post.synced === 'undefined') {
        post.synced = 0;
      }
      await db.posts.put(post);
      return post;
    },

    async getAllPosts(sortDesc = true) {
      const posts = await db.posts.toArray();
      posts.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortDesc ? timeB - timeA : timeA - timeB;
      });
      return posts;
    },

    async getPostById(id) {
      return await db.posts.get(id);
    },

    async deletePost(id) {
      const post = await db.posts.get(id);
      if (post && post.media && Array.isArray(post.media)) {
        for (const m of post.media) {
          if (m.id) {
            await db.media.delete(m.id);
          }
        }
      }
      await db.posts.delete(id);
    },

    async getMemoriesForDate(month, day, currentYear) {
      const allPosts = await db.posts.toArray();
      return allPosts.filter(p => {
        return p.month === month && p.day === day && p.year < currentYear;
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },

    // Media Blob Storage
    async saveMediaBlob(mediaItem) {
      if (!mediaItem.id) {
        mediaItem.id = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }
      mediaItem.createdAt = mediaItem.createdAt || Date.now();
      await db.media.put(mediaItem);
      return mediaItem;
    },

    async getMediaBlob(id) {
      return await db.media.get(id);
    },

    async deleteMediaBlob(id) {
      await db.media.delete(id);
    },

    // Task Reminders Operations
    async saveTask(task) {
      if (!task.id) {
        task.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }
      task.createdAt = task.createdAt || Date.now();
      task.updatedAt = Date.now();
      task.completed = Boolean(task.completed);
      task.reminder = Boolean(task.reminder);
      if (typeof task.synced === 'undefined') {
        task.synced = 0;
      }
      await db.tasks.put(task);
      return task;
    },

    async getAllTasks() {
      const tasks = await db.tasks.toArray();
      tasks.sort((a, b) => {
        // Incomplete first
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        // Then by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt - a.createdAt;
      });
      return tasks;
    },

    async toggleTask(id) {
      const task = await db.tasks.get(id);
      if (task) {
        task.completed = !task.completed;
        task.updatedAt = Date.now();
        task.synced = 0;
        await db.tasks.put(task);
      }
      return task;
    },

    async deleteTask(id) {
      await db.tasks.delete(id);
    },

    async getPendingReminders() {
      const now = new Date().getTime();
      const tasks = await db.tasks.toArray();
      return tasks.filter(t => {
        if (t.completed || !t.dueDate) return false;
        const dueTime = new Date(t.dueDate).getTime();
        return dueTime <= now + 3600000; // Due within next hour or overdue
      });
    },

    // Notes Operations
    async saveNote(note) {
      if (!note.id) {
        note.id = 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }
      note.createdAt = note.createdAt || Date.now();
      note.updatedAt = Date.now();
      note.pinned = Boolean(note.pinned);
      if (typeof note.synced === 'undefined') {
        note.synced = 0;
      }
      await db.notes.put(note);
      return note;
    },

    async getAllNotes() {
      const notes = await db.notes.toArray();
      notes.sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return b.updatedAt - a.updatedAt;
      });
      return notes;
    },

    async deleteNote(id) {
      await db.notes.delete(id);
    },

    // Chat History
    async saveChatMessage(msg) {
      if (!msg.id) {
        msg.id = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }
      msg.timestamp = msg.timestamp || new Date().toISOString();
      if (typeof msg.synced === 'undefined') {
        msg.synced = 0;
      }
      await db.chat_history.put(msg);
      return msg;
    },

    async getChatHistory(limit = 100) {
      const chats = await db.chat_history.toArray();
      chats.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (limit && chats.length > limit) {
        return chats.slice(-limit);
      }
      return chats;
    },

    async clearChatHistory() {
      await db.chat_history.clear();
    },

    // Vault Storage
    async saveVaultFile(vaultItem) {
      if (!vaultItem.id) {
        vaultItem.id = 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }
      vaultItem.uploadedAt = vaultItem.uploadedAt || new Date().toISOString();
      if (typeof vaultItem.synced === 'undefined') {
        vaultItem.synced = 0;
      }
      await db.vault.put(vaultItem);
      return vaultItem;
    },

    async getVaultFiles() {
      const files = await db.vault.toArray();
      files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      return files;
    },

    async getVaultFileById(id) {
      return await db.vault.get(id);
    },

    async deleteVaultFile(id) {
      await db.vault.delete(id);
    },

    // Global Search across Posts, Vault Files, Notes, and Tasks
    async searchAll(query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) {
        return { posts: [], vault: [], notes: [], tasks: [] };
      }

      const [allPosts, allVault, allNotes, allTasks] = await Promise.all([
        db.posts.toArray(),
        db.vault.toArray(),
        db.notes.toArray(),
        db.tasks.toArray()
      ]);

      const matchedPosts = allPosts.filter(p => {
        const textMatch = (p.content || '').toLowerCase().includes(q);
        const moodMatch = (p.mood || '').toLowerCase().includes(q);
        const locationMatch = (p.location || '').toLowerCase().includes(q);
        const mediaMatch = (p.media || []).some(m => (m.name || '').toLowerCase().includes(q));
        const dateMatch = (p.timestamp || '').toLowerCase().includes(q);
        return textMatch || moodMatch || locationMatch || mediaMatch || dateMatch;
      });

      const matchedVault = allVault.filter(v => {
        const nameMatch = (v.name || '').toLowerCase().includes(q);
        const mimeMatch = (v.mimeType || '').toLowerCase().includes(q);
        return nameMatch || mimeMatch;
      });

      const matchedNotes = allNotes.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        return titleMatch || contentMatch;
      });

      const matchedTasks = allTasks.filter(t => {
        return (t.title || '').toLowerCase().includes(q);
      });

      return {
        posts: matchedPosts,
        vault: matchedVault,
        notes: matchedNotes,
        tasks: matchedTasks
      };
    },

    // Settings
    async getSetting(key, defaultVal = null) {
      const item = await db.settings.get(key);
      if (item !== undefined && item !== null) {
        return item.value;
      }
      const localVal = localStorage.getItem('diary_' + key);
      if (localVal !== null) {
        try {
          return JSON.parse(localVal);
        } catch (e) {
          return localVal;
        }
      }
      return defaultVal;
    },

    async saveSetting(key, value) {
      await db.settings.put({ key, value });
      try {
        localStorage.setItem('diary_' + key, JSON.stringify(value));
      } catch (e) {}
      return value;
    },

    // Sync helpers
    async getUnsyncedPosts() {
      return await db.posts.where('synced').equals(0).toArray();
    },

    async markPostSynced(id) {
      await db.posts.update(id, { synced: 1 });
    },

    async getUnsyncedVault() {
      return await db.vault.where('synced').equals(0).toArray();
    },

    async markVaultSynced(id, driveFileId) {
      const updateData = { synced: 1 };
      if (driveFileId) {
        updateData.driveFileId = driveFileId;
      }
      await db.vault.update(id, updateData);
    },

    async getUnsyncedChats() {
      return await db.chat_history.where('synced').equals(0).toArray();
    },

    async markChatSynced(id) {
      await db.chat_history.update(id, { synced: 1 });
    },

    async getUnsyncedTasks() {
      return await db.tasks.where('synced').equals(0).toArray();
    },

    async markTaskSynced(id) {
      await db.tasks.update(id, { synced: 1 });
    },

    async getUnsyncedNotes() {
      return await db.notes.where('synced').equals(0).toArray();
    },

    async markNoteSynced(id) {
      await db.notes.update(id, { synced: 1 });
    }
  };

  window.DiaryDB = DiaryDB;
})();
