/**
 * driveSync.js - Google Identity Services and Google Drive API v3 client abstraction.
 * Provides offline-first background synchronisation to /Rukn_Data/ (or legacy /Alcove_Data/ and /PersonalDiaryApp_Data/).
 */

(function () {
  'use strict';

  const ROOT_FOLDER_NAME = 'Rukn_Data';
  const LEGACY_ROOT_FOLDER_NAME = 'Alcove_Data';
  const PREVIOUS_LEGACY_ROOT_FOLDER_NAME = 'PersonalDiaryApp_Data';
  const POSTS_FOLDER_NAME = 'posts';
  const MEDIA_FOLDER_NAME = 'media';
  const VAULT_FOLDER_NAME = 'vault';
  const MANIFEST_FILE_NAME = 'manifest.json';
  const CHAT_FILE_NAME = 'chat_history.json';
  const TASKS_FILE_NAME = 'tasks.json';
  const NOTES_FILE_NAME = 'notes.json';

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiresAt = 0;
  let isSyncing = false;
  let syncStatusListeners = [];

  const folderCache = {
    rootId: null,
    postsId: null,
    mediaId: null,
    vaultId: null,
    manifestId: null,
    chatId: null
  };

  const DriveSync = {
    // Status subscriber
    onStatusChange(listener) {
      if (typeof listener === 'function') {
        syncStatusListeners.push(listener);
      }
    },

    notifyStatus(status, detail = '') {
      for (const listener of syncStatusListeners) {
        try {
          listener(status, detail);
        } catch (e) {
          console.error('Error in sync status listener:', e);
        }
      }
    },

    // Token and OAuth management
    init(clientId, onTokenReceived = null) {
      if (!clientId) {
        return false;
      }
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        console.warn('Google Identity Services script not yet loaded.');
        return false;
      }

      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: (response) => {
          if (response.error) {
            console.error('OAuth token error:', response);
            this.notifyStatus('error', response.error_description || response.error);
            return;
          }
          accessToken = response.access_token;
          const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3599;
          tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
          localStorage.setItem('diary_drive_token', accessToken);
          localStorage.setItem('diary_drive_token_exp', tokenExpiresAt.toString());
          sessionStorage.setItem('diary_drive_token', accessToken);
          sessionStorage.setItem('diary_drive_token_exp', tokenExpiresAt.toString());

          // Automatically fetch Google user profile
          this.fetchUserProfile(accessToken).then((profile) => {
            if (profile) {
              localStorage.setItem('diary_google_profile', JSON.stringify(profile));
              if (typeof window.onGoogleProfileReceived === 'function') {
                window.onGoogleProfileReceived(profile);
              }
            }
          }).catch((err) => {
            console.warn('Failed to retrieve Google profile:', err);
          }).finally(() => {
            this.notifyStatus('connected', 'Google Drive connected.');
            if (typeof onTokenReceived === 'function') {
              onTokenReceived(accessToken);
            }
            // Trigger initial background sync
            this.syncAll().catch(err => console.error('Initial sync error:', err));
          });
        }
      });

      // Restore session token if valid
      const cachedToken = localStorage.getItem('diary_drive_token') || sessionStorage.getItem('diary_drive_token');
      const cachedExp = localStorage.getItem('diary_drive_token_exp') || sessionStorage.getItem('diary_drive_token_exp');
      if (cachedToken && cachedExp && Date.now() < parseInt(cachedExp, 10)) {
        accessToken = cachedToken;
        tokenExpiresAt = parseInt(cachedExp, 10);
        this.notifyStatus('connected', 'Google Drive connected from active session.');
      }

      return true;
    },

    async fetchUserProfile(token = null) {
      const activeToken = token || accessToken;
      if (!activeToken) return null;
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${activeToken}` }
        });
        if (!res.ok) {
          console.warn('Profile fetch response not ok:', res.status, res.statusText);
          return null;
        }
        return await res.json();
      } catch (err) {
        console.warn('Profile fetch network error:', err);
        return null;
      }
    },

    getStoredProfile() {
      try {
        const raw = localStorage.getItem('diary_google_profile');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    requestAuth(promptConsent = false) {
      if (!tokenClient) {
        const storedClientId = localStorage.getItem('diary_google_client_id');
        if (storedClientId) {
          try {
            this.init(JSON.parse(storedClientId));
          } catch {
            this.init(storedClientId);
          }
        }
      }
      if (!tokenClient) {
        throw new Error('Google OAuth Client ID not configured. Please add it in Settings.');
      }
      tokenClient.requestAccessToken({ prompt: promptConsent ? 'consent' : '' });
    },

    disconnect() {
      if (accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(accessToken, () => {
          console.log('Google Drive token revoked.');
        });
      }
      accessToken = null;
      tokenExpiresAt = 0;
      localStorage.removeItem('diary_drive_token');
      localStorage.removeItem('diary_drive_token_exp');
      localStorage.removeItem('diary_google_profile');
      sessionStorage.removeItem('diary_drive_token');
      sessionStorage.removeItem('diary_drive_token_exp');
      this.notifyStatus('disconnected', 'Disconnected from Google Drive.');
      if (typeof window.onGoogleDisconnected === 'function') {
        window.onGoogleDisconnected();
      }
    },

    isAuthenticated() {
      return Boolean(accessToken && Date.now() < tokenExpiresAt);
    },

    // HTTP Helper with 401 handling
    async fetchWithAuth(url, options = {}, isRetry = false) {
      if (!this.isAuthenticated()) {
        if (!tokenClient) {
          throw new Error('Not connected to Google Drive.');
        }
        // Attempt token request
        this.requestAuth();
        throw new Error('Google Drive authorisation expired. Please grant access.');
      }

      options.headers = options.headers || {};
      options.headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch(url, options);

      if (response.status === 401 && !isRetry) {
        console.warn('Received 401 from Drive API. Requesting refreshed token.');
        this.notifyStatus('unauthorized', 'Session expired. Reconnecting...');
        accessToken = null;
        sessionStorage.removeItem('diary_drive_token');
        if (tokenClient) {
          this.requestAuth();
        }
        throw new Error('Authorisation expired. Please grant access in the Google prompt.');
      }

      return response;
    },

    // Drive File and Folder Operations
    async findFolder(name, parentId = null) {
      let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
      const res = await this.fetchWithAuth(url);
      if (!res.ok) {
        throw new Error(`Failed to query folder ${name}: ${res.statusText}`);
      }
      const data = await res.json();
      return (data.files && data.files.length > 0) ? data.files[0] : null;
    },

    async createFolder(name, parentId = null) {
      const metadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
      };
      if (parentId) {
        metadata.parents = [parentId];
      }
      const res = await this.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });
      if (!res.ok) {
        throw new Error(`Failed to create folder ${name}: ${res.statusText}`);
      }
      return await res.json();
    },

    async ensureFolder(name, parentId = null) {
      const existing = await this.findFolder(name, parentId);
      if (existing) {
        return existing.id;
      }
      const created = await this.createFolder(name, parentId);
      return created.id;
    },

    async ensureAppFolderStructure() {
      if (folderCache.rootId && folderCache.postsId && folderCache.mediaId && folderCache.vaultId) {
        return folderCache;
      }

      // Root app folder: check Rukn_Data first, fallback to Alcove_Data, then PersonalDiaryApp_Data if found
      let rootFolder = await this.findFolder(ROOT_FOLDER_NAME);
      if (!rootFolder) {
        rootFolder = await this.findFolder(LEGACY_ROOT_FOLDER_NAME);
      }
      if (!rootFolder) {
        rootFolder = await this.findFolder(PREVIOUS_LEGACY_ROOT_FOLDER_NAME);
      }

      if (rootFolder) {
        folderCache.rootId = rootFolder.id;
      } else {
        folderCache.rootId = await this.ensureFolder(ROOT_FOLDER_NAME);
      }

      // Sub-folders
      const [postsId, mediaId, vaultId] = await Promise.all([
        this.ensureFolder(POSTS_FOLDER_NAME, folderCache.rootId),
        this.ensureFolder(MEDIA_FOLDER_NAME, folderCache.rootId),
        this.ensureFolder(VAULT_FOLDER_NAME, folderCache.rootId)
      ]);

      folderCache.postsId = postsId;
      folderCache.mediaId = mediaId;
      folderCache.vaultId = vaultId;

      return folderCache;
    },

    async findFile(name, parentId) {
      let query = `name = '${name}' and trashed = false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, size, modifiedTime)`;
      const res = await this.fetchWithAuth(url);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.files && data.files.length > 0) ? data.files[0] : null;
    },

    async uploadMultipartFile(name, blob, mimeType, parentId, existingFileId = null) {
      const metadata = {
        name,
        mimeType
      };
      if (parentId && !existingFileId) {
        metadata.parents = [parentId];
      }

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadataPart = delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata);

      const mediaHeader = delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`;

      const blobData = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
      const multipartBody = new Blob([metadataPart, mediaHeader, blobData, closeDelim]);

      const url = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

      const method = existingFileId ? 'PATCH' : 'POST';

      const res = await this.fetchWithAuth(url, {
        method,
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Upload failed for ${name} (${res.status}): ${errorText}`);
      }

      return await res.json();
    },

    async downloadFileBlob(fileId) {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await this.fetchWithAuth(url);
      if (!res.ok) {
        throw new Error(`Failed to download file ${fileId}: ${res.statusText}`);
      }
      return await res.blob();
    },

    async downloadJsonFile(fileId) {
      const blob = await this.downloadFileBlob(fileId);
      const text = await blob.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse JSON for fileId', fileId, e);
        return null;
      }
    },

    async listFilesInFolder(folderId) {
      const query = `'${folderId}' in parents and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, size, modifiedTime, createdTime)&pageSize=1000`;
      const res = await this.fetchWithAuth(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.files || [];
    },

    async deleteDriveFile(fileId) {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      const res = await this.fetchWithAuth(url, { method: 'DELETE' });
      return res.ok;
    },

    // Synchronisation Logic
    async syncManifest() {
      const folders = await this.ensureAppFolderStructure();
      const existing = await this.findFile(MANIFEST_FILE_NAME, folders.rootId);

      // Local profile and preferences
      const profile = await window.DiaryDB.getSetting('profile', {
        name: 'Rukn Resident',
        avatar: '🌙',
        theme: 'light'
      });

      const allPosts = await window.DiaryDB.getAllPosts();
      const dateIndex = allPosts.map(p => ({
        id: p.id,
        timestamp: p.timestamp,
        year: p.year,
        month: p.month,
        day: p.day,
        mood: p.mood
      }));

      const manifestData = {
        app: 'Rukn',
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        profile,
        dateIndex
      };

      const jsonBlob = new Blob([JSON.stringify(manifestData, null, 2)], { type: 'application/json' });
      const uploaded = await this.uploadMultipartFile(
        MANIFEST_FILE_NAME,
        jsonBlob,
        'application/json',
        folders.rootId,
        existing ? existing.id : null
      );
      folderCache.manifestId = uploaded.id;
      return manifestData;
    },

    async syncPosts() {
      const folders = await this.ensureAppFolderStructure();

      // 1. Upload unsynced local media items to Drive /media/
      const unsyncedPosts = await window.DiaryDB.getUnsyncedPosts();
      for (const post of unsyncedPosts) {
        if (post.media && Array.isArray(post.media)) {
          let modified = false;
          for (const m of post.media) {
            if (!m.driveFileId && m.id) {
              const mediaBlobRecord = await window.DiaryDB.getMediaBlob(m.id);
              if (mediaBlobRecord && mediaBlobRecord.blob) {
                const uploaded = await this.uploadMultipartFile(
                  m.name || `media_${m.id}`,
                  mediaBlobRecord.blob,
                  m.mimeType || 'application/octet-stream',
                  folders.mediaId
                );
                m.driveFileId = uploaded.id;
                modified = true;
              }
            }
          }
          if (modified) {
            await window.DiaryDB.savePost(post);
          }
        }
      }

      // 2. Yearly posts sync: gather local posts grouped by year
      const allLocalPosts = await window.DiaryDB.getAllPosts();
      const postsByYear = {};
      for (const p of allLocalPosts) {
        const year = p.year || new Date(p.timestamp).getFullYear();
        if (!postsByYear[year]) {
          postsByYear[year] = [];
        }
        postsByYear[year].push(p);
      }

      // Check remote posts files in /posts/
      const remotePostFiles = await this.listFilesInFolder(folders.postsId);
      const remoteFileMap = {};
      for (const f of remotePostFiles) {
        remoteFileMap[f.name] = f;
      }

      // Merge and push each year
      for (const year of Object.keys(postsByYear)) {
        const fileName = `posts_${year}.json`;
        const existingRemoteFile = remoteFileMap[fileName];
        let remotePosts = [];

        if (existingRemoteFile) {
          const fetched = await this.downloadJsonFile(existingRemoteFile.id);
          if (Array.isArray(fetched)) {
            remotePosts = fetched;
          }
        }

        // Merge: local posts take precedence or match on updatedAt
        const postMap = new Map();
        for (const rp of remotePosts) {
          postMap.set(rp.id, rp);
        }
        for (const lp of postsByYear[year]) {
          // Prepare clean post object without large in-memory blobs
          const cleanPost = {
            id: lp.id,
            timestamp: lp.timestamp,
            year: lp.year,
            month: lp.month,
            day: lp.day,
            mood: lp.mood,
            location: lp.location || null,
            content: lp.content,
            tags: lp.tags || [],
            media: (lp.media || []).map(m => ({
              id: m.id,
              name: m.name,
              mimeType: m.mimeType,
              size: m.size,
              driveFileId: m.driveFileId || null,
              isExternal: m.isExternal || false,
              url: m.url || null
            })),
            createdAt: lp.createdAt,
            updatedAt: lp.updatedAt || Date.now()
          };
          postMap.set(lp.id, cleanPost);
        }

        const mergedPosts = Array.from(postMap.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const jsonBlob = new Blob([JSON.stringify(mergedPosts, null, 2)], { type: 'application/json' });
        await this.uploadMultipartFile(
          fileName,
          jsonBlob,
          'application/json',
          folders.postsId,
          existingRemoteFile ? existingRemoteFile.id : null
        );

        // Update local Dexie with any remote posts that were missing
        for (const mp of mergedPosts) {
          mp.synced = 1;
          await window.DiaryDB.savePost(mp);
        }
      }

      // Pull any remote years not present locally
      for (const f of remotePostFiles) {
        const yearMatch = f.name.match(/^posts_(\d{4})\.json$/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          if (!postsByYear[year]) {
            const fetched = await this.downloadJsonFile(f.id);
            if (Array.isArray(fetched)) {
              for (const rp of fetched) {
                rp.synced = 1;
                await window.DiaryDB.savePost(rp);
              }
            }
          }
        }
      }
    },

    async syncVault() {
      const folders = await this.ensureAppFolderStructure();

      // 1. Upload unsynced local vault items
      const unsyncedVault = await window.DiaryDB.getUnsyncedVault();
      for (const item of unsyncedVault) {
        if (!item.driveFileId) {
          const blobRecord = item.blob || (await window.DiaryDB.getVaultFileById(item.id))?.blob;
          if (blobRecord) {
            const uploaded = await this.uploadMultipartFile(
              item.name,
              blobRecord,
              item.mimeType || 'application/octet-stream',
              folders.vaultId
            );
            await window.DiaryDB.markVaultSynced(item.id, uploaded.id);
          }
        }
      }

      // 2. Discover remote files in /vault/ and mirror metadata into local Dexie
      const remoteVaultFiles = await this.listFilesInFolder(folders.vaultId);
      const localVault = await window.DiaryDB.getVaultFiles();
      const localDriveIds = new Set(localVault.map(v => v.driveFileId).filter(Boolean));

      for (const rf of remoteVaultFiles) {
        if (!localDriveIds.has(rf.id)) {
          await window.DiaryDB.saveVaultFile({
            name: rf.name,
            mimeType: rf.mimeType,
            size: parseInt(rf.size || '0', 10),
            driveFileId: rf.id,
            uploadedAt: rf.createdTime || new Date().toISOString(),
            synced: 1,
            blob: null // Will be downloaded on demand
          });
        }
      }
    },

    async syncChat() {
      const folders = await this.ensureAppFolderStructure();
      const existing = await this.findFile(CHAT_FILE_NAME, folders.rootId);

      let remoteChats = [];
      if (existing) {
        const fetched = await this.downloadJsonFile(existing.id);
        if (Array.isArray(fetched)) {
          remoteChats = fetched;
        }
      }

      const localChats = await window.DiaryDB.getChatHistory(300);
      const chatMap = new Map();

      for (const rc of remoteChats) {
        chatMap.set(rc.id, rc);
      }
      for (const lc of localChats) {
        chatMap.set(lc.id, {
          id: lc.id,
          role: lc.role,
          content: lc.content,
          timestamp: lc.timestamp
        });
      }

      const mergedChats = Array.from(chatMap.values()).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const jsonBlob = new Blob([JSON.stringify(mergedChats, null, 2)], { type: 'application/json' });
      const uploaded = await this.uploadMultipartFile(
        CHAT_FILE_NAME,
        jsonBlob,
        'application/json',
        folders.rootId,
        existing ? existing.id : null
      );
      folderCache.chatId = uploaded.id;

      // Update local status
      for (const lc of localChats) {
        await window.DiaryDB.markChatSynced(lc.id);
      }
    },

    async syncTasks() {
      const folders = await this.ensureAppFolderStructure();
      const existing = await this.findFile(TASKS_FILE_NAME, folders.rootId);

      let remoteTasks = [];
      if (existing) {
        const fetched = await this.downloadJsonFile(existing.id);
        if (Array.isArray(fetched)) {
          remoteTasks = fetched;
        }
      }

      const localTasks = await window.DiaryDB.getAllTasks();
      const taskMap = new Map();

      for (const rt of remoteTasks) {
        taskMap.set(rt.id, rt);
      }
      for (const lt of localTasks) {
        const existingRemote = taskMap.get(lt.id);
        if (!existingRemote || (lt.updatedAt || 0) >= (existingRemote.updatedAt || 0)) {
          taskMap.set(lt.id, lt);
        }
      }

      const mergedTasks = Array.from(taskMap.values());
      const jsonBlob = new Blob([JSON.stringify(mergedTasks, null, 2)], { type: 'application/json' });
      await this.uploadMultipartFile(
        TASKS_FILE_NAME,
        jsonBlob,
        'application/json',
        folders.rootId,
        existing ? existing.id : null
      );

      for (const t of mergedTasks) {
        t.synced = 1;
        await window.DiaryDB.saveTask(t);
      }
    },

    async syncNotes() {
      const folders = await this.ensureAppFolderStructure();
      const existing = await this.findFile(NOTES_FILE_NAME, folders.rootId);

      let remoteNotes = [];
      if (existing) {
        const fetched = await this.downloadJsonFile(existing.id);
        if (Array.isArray(fetched)) {
          remoteNotes = fetched;
        }
      }

      const localNotes = await window.DiaryDB.getAllNotes();
      const noteMap = new Map();

      for (const rn of remoteNotes) {
        noteMap.set(rn.id, rn);
      }
      for (const ln of localNotes) {
        const existingRemote = noteMap.get(ln.id);
        if (!existingRemote || (ln.updatedAt || 0) >= (existingRemote.updatedAt || 0)) {
          noteMap.set(ln.id, ln);
        }
      }

      const mergedNotes = Array.from(noteMap.values());
      const jsonBlob = new Blob([JSON.stringify(mergedNotes, null, 2)], { type: 'application/json' });
      await this.uploadMultipartFile(
        NOTES_FILE_NAME,
        jsonBlob,
        'application/json',
        folders.rootId,
        existing ? existing.id : null
      );

      for (const n of mergedNotes) {
        n.synced = 1;
        await window.DiaryDB.saveNote(n);
      }
    },

    async syncProfile() {
      const folders = await this.ensureAppFolderStructure();
      const existing = await this.findFile('profile.json', folders.rootId);
      const profile = await window.DiaryDB.getSetting('profile');

      if (existing && (!profile || !profile.avatarImage)) {
        const remoteProfile = await this.downloadJsonFile(existing.id);
        if (remoteProfile) {
          await window.DiaryDB.saveSetting('profile', remoteProfile);
          return remoteProfile;
        }
      }

      if (profile) {
        const jsonBlob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
        await this.uploadMultipartFile(
          'profile.json',
          jsonBlob,
          'application/json',
          folders.rootId,
          existing ? existing.id : null
        );
      }
    },

    async syncAll() {
      if (isSyncing) return;
      if (!this.isAuthenticated()) {
        this.notifyStatus('offline', 'Drive not connected or token expired.');
        return;
      }

      isSyncing = true;
      this.notifyStatus('syncing', 'Synchronising with Google Drive...');

      try {
        await this.ensureAppFolderStructure();
        await this.syncProfile();
        await this.syncPosts();
        await this.syncVault();
        await this.syncTasks();
        await this.syncNotes();
        await this.syncChat();
        await this.syncManifest();
        this.notifyStatus('synced', `Synchronised at ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error('Drive sync failed:', err);
        this.notifyStatus('error', err.message || 'Sync failed.');
        throw err;
      } finally {
        isSyncing = false;
      }
    }
  };

  window.DriveSync = DriveSync;
})();
