/**
 * app.js - Main UI controller, state manager, feed renderer,
 * memories engine, private vault, task reminders, scratchpad notes,
 * and global search across posts, files, notes, and tasks.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    currentTab: 'feed', // 'feed' | 'memories' | 'vault' | 'notes' | 'tasks' | 'search'
    previousTab: 'feed',
    posts: [],
    memories: [],
    vaultFiles: [],
    notes: [],
    tasks: [],
    profile: {
      name: 'Alcove Resident',
      avatar: '🌙',
      avatarImage: null,
      theme: 'acrylic',
      colorMode: 'dark'
    },
    googleClientId: '',
    geminiApiKey: '',
    syncStatus: 'offline',
    selectedComposerFiles: [],
    selectedInlineFiles: [],
    likedPosts: new Set(),
    searchQuery: '',
    searchCategory: 'all',
    searchResults: { posts: [], vault: [], notes: [], tasks: [] },
    feedSearchQuery: '',
    feedMoodFilter: 'all',
    feedDateFilter: '',
    taskFilter: 'all',
    lightbox: {
      isOpen: false,
      images: [],
      currentIndex: 0
    }
  };

  // Curated Preset Artworks & Portraits
  const PRESET_AVATARS = [
    {
      id: 'crescent',
      name: 'Crescent Night',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g1" cx="30%" cy="30%"><stop offset="0%" stop-color="%233a322d"/><stop offset="100%" stop-color="%23171412"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g1)"/><path d="M56 24 C40 28 32 44 38 60 C44 76 60 80 72 72 C58 76 44 68 42 54 C40 40 50 28 56 24 Z" fill="%23f59e0b"/><circle cx="68" cy="32" r="3.5" fill="%23fef3c7"/></svg>'
    },
    {
      id: 'geometric',
      name: 'Geometric Star',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a231f"/><circle cx="50" cy="50" r="42" fill="none" stroke="%2310b981" stroke-width="2" opacity="0.6"/><polygon points="50,15 75,35 85,65 65,85 35,85 15,65 25,35" fill="none" stroke="%2334d399" stroke-width="2" opacity="0.7"/><polygon points="50,85 25,65 15,35 35,15 65,15 85,35 75,65" fill="none" stroke="%23f59e0b" stroke-width="1.5" opacity="0.7"/><circle cx="50" cy="50" r="12" fill="%23059669"/></svg>'
    },
    {
      id: 'dunes',
      name: 'Desert Dunes',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%2378350f"/><stop offset="70%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23fef3c7"/></linearGradient></defs><rect width="100" height="100" fill="url(%23sky)"/><circle cx="76" cy="36" r="10" fill="%23fffbeb"/><path d="M0 70 Q30 55 60 72 T100 68 L100 100 L0 100 Z" fill="%2392400e"/><path d="M0 80 Q40 68 80 84 T100 82 L100 100 L0 100 Z" fill="%23451a03"/></svg>'
    },
    {
      id: 'olive',
      name: 'Olive Branch',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231c1917"/><circle cx="50" cy="50" r="44" fill="%23292524"/><path d="M25 75 C45 65 55 45 75 25" stroke="%23a8a29e" stroke-width="3" stroke-linecap="round"/><ellipse cx="40" cy="58" rx="8" ry="4" transform="rotate(-30 40 58)" fill="%2365a30d"/><ellipse cx="58" cy="40" rx="8" ry="4" transform="rotate(-30 58 40)" fill="%2384cc16"/><circle cx="48" cy="50" r="4.5" fill="%233f6212"/></svg>'
    },
    {
      id: 'lantern',
      name: 'Warm Lantern',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23181513"/><circle cx="50" cy="54" r="28" fill="%23d97706" opacity="0.3"/><line x1="50" y1="10" x2="50" y2="28" stroke="%23fbbf24" stroke-width="2"/><polygon points="40,32 60,32 56,28 44,28" fill="%23f59e0b"/><polygon points="40,32 60,32 66,54 50,68 34,54" fill="none" stroke="%23fbbf24" stroke-width="2.5"/><circle cx="50" cy="50" r="6" fill="%23fef08a"/></svg>'
    },
    {
      id: 'silhouette',
      name: 'Quiet Silhouette',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23292524"/><stop offset="100%" stop-color="%230c0a09"/></linearGradient></defs><rect width="100" height="100" fill="url(%23sg)"/><circle cx="50" cy="40" r="18" fill="%23e7e5e4"/><path d="M22 92 C24 72 38 66 50 66 C62 66 76 72 78 92 Z" fill="%23e7e5e4"/></svg>'
    }
  ];

  // Helper: Format relative timestamp
  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function highlightMatches(text, query) {
    if (!query || !text) return escapeHtml(text || '');
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  async function detectCurrentLocationName() {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
              {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
              }
            );
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const place = addr.city || addr.town || addr.village || addr.suburb || addr.hamlet || addr.county;
              const country = addr.country || '';
              if (place && country) {
                return resolve(`${place}, ${country}`);
              }
              if (place) {
                return resolve(place);
              }
              if (data.display_name) {
                const parts = data.display_name.split(',').map(s => s.trim());
                return resolve(parts.slice(0, 2).join(', '));
              }
            }
          } catch (e) {
            // Geocoding request timed out or was blocked, fall through to coordinates
          }
          const latFormatted = `${Math.abs(latitude).toFixed(3)}° ${latitude >= 0 ? 'N' : 'S'}`;
          const lonFormatted = `${Math.abs(longitude).toFixed(3)}° ${longitude >= 0 ? 'E' : 'W'}`;
          resolve(`${latFormatted}, ${lonFormatted}`);
        },
        (err) => reject(err),
        { timeout: 9000, maximumAge: 60000, enableHighAccuracy: false }
      );
    });
  }

  // DOM Elements Cache
  let dom = {};

  function cacheDom() {
    dom = {
      // Top nav
      currentDateEl: document.getElementById('currentDateDisplay'),
      globalSearchInput: document.getElementById('globalSearchInput'),
      clearSearchBtn: document.getElementById('clearSearchBtn'),
      navFeedBtn: document.getElementById('navFeedBtn'),
      navNotesBtn: document.getElementById('navNotesBtn'),
      navTasksBtn: document.getElementById('navTasksBtn'),
      taskReminderBadge: document.getElementById('taskReminderBadge'),
      navVaultBtn: document.getElementById('navVaultBtn'),
      navMemoriesBtn: document.getElementById('navMemoriesBtn'),
      toggleChatBtn: document.getElementById('toggleChatBtn'),
      floatingMessengerBtn: document.getElementById('floatingMessengerBtn'),
      installAppBtn: document.getElementById('installAppBtn'),
      quickThemeBtn: document.getElementById('quickThemeBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      syncStatusBadge: document.getElementById('syncStatusBadge'),
      userAvatarNav: document.getElementById('userAvatarNav'),
      themeCardsGrid: document.getElementById('themeCardsGrid'),
      modeSelectBtns: document.querySelectorAll('.mode-select-btn'),

      // Main Views
      feedView: document.getElementById('feedView'),
      searchView: document.getElementById('searchView'),
      notesView: document.getElementById('notesView'),
      tasksView: document.getElementById('tasksView'),
      memoriesView: document.getElementById('memoriesView'),
      vaultView: document.getElementById('vaultView'),

      // Search Elements
      searchQueryLabel: document.getElementById('searchQueryLabel'),
      exitSearchBtn: document.getElementById('exitSearchBtn'),
      searchResultsContainer: document.getElementById('searchResultsContainer'),
      searchEmptyState: document.getElementById('searchEmptyState'),
      searchFilterPills: document.querySelectorAll('.search-filter-pill'),
      countSearchAll: document.getElementById('countSearchAll'),
      countSearchPosts: document.getElementById('countSearchPosts'),
      countSearchVault: document.getElementById('countSearchVault'),
      countSearchNotes: document.getElementById('countSearchNotes'),
      countSearchTasks: document.getElementById('countSearchTasks'),

      // Inline Composer (Threads Style)
      inlineComposerBox: document.getElementById('inlineComposerBox'),
      inlineComposerAvatar: document.getElementById('inlineComposerAvatar'),
      inlineComposerName: document.getElementById('inlineComposerName'),
      inlineComposerContent: document.getElementById('inlineComposerContent'),
      inlineComposerFiles: document.getElementById('inlineComposerFiles'),
      inlineComposerPhotos: document.getElementById('inlineComposerPhotos'),
      inlineComposerVideos: document.getElementById('inlineComposerVideos'),
      inlineAddPhotosBtn: document.getElementById('inlineAddPhotosBtn'),
      inlineAddVideosBtn: document.getElementById('inlineAddVideosBtn'),
      inlineComposerMood: document.getElementById('inlineComposerMood'),
      inlineFilePreview: document.getElementById('inlineFilePreview'),
      inlineLocationBar: document.getElementById('inlineLocationBar'),
      inlineLocationInput: document.getElementById('inlineLocationInput'),
      inlineAddLocationBtn: document.getElementById('inlineAddLocationBtn'),
      inlineAddLocationBtnLabel: document.getElementById('inlineAddLocationBtnLabel'),
      inlineDetectLocationBtn: document.getElementById('inlineDetectLocationBtn'),
      inlineClearLocationBtn: document.getElementById('inlineClearLocationBtn'),
      inlineSubmitBtn: document.getElementById('inlineSubmitBtn'),

      // Feed & Memories
      memoriesBanner: document.getElementById('memoriesBanner'),
      memoriesBannerCount: document.getElementById('memoriesBannerCount'),
      feedContainer: document.getElementById('feedContainer'),
      memoriesFeedContainer: document.getElementById('memoriesFeedContainer'),

      // In-Feed Search & Timeline Filters
      feedSearchInput: document.getElementById('feedSearchInput'),
      clearFeedSearchBtn: document.getElementById('clearFeedSearchBtn'),
      jumpToDateInput: document.getElementById('jumpToDateInput'),
      feedMoodFilterBtns: document.querySelectorAll('.feed-mood-filter-btn'),
      feedSearchFeedback: document.getElementById('feedSearchFeedback'),
      feedSearchCount: document.getElementById('feedSearchCount'),
      resetFeedFilterBtn: document.getElementById('resetFeedFilterBtn'),

      // Notes
      noteTitleInput: document.getElementById('noteTitleInput'),
      noteContentInput: document.getElementById('noteContentInput'),
      noteColorInput: document.getElementById('noteColorInput'),
      notePinInput: document.getElementById('notePinInput'),
      saveNoteBtn: document.getElementById('saveNoteBtn'),
      notesContainer: document.getElementById('notesContainer'),
      notesEmptyState: document.getElementById('notesEmptyState'),

      // Tasks
      taskRemindersAlertBanner: document.getElementById('taskRemindersAlertBanner'),
      taskRemindersAlertText: document.getElementById('taskRemindersAlertText'),
      taskTitleInput: document.getElementById('taskTitleInput'),
      taskDueDateInput: document.getElementById('taskDueDateInput'),
      taskPriorityInput: document.getElementById('taskPriorityInput'),
      taskReminderInput: document.getElementById('taskReminderInput'),
      addTaskBtn: document.getElementById('addTaskBtn'),
      tasksSummaryText: document.getElementById('tasksSummaryText'),
      tasksContainer: document.getElementById('tasksContainer'),
      tasksEmptyState: document.getElementById('tasksEmptyState'),
      taskFilterBtns: document.querySelectorAll('.task-filter-btn'),

      // Sidebar Elements
      sidebarTasksList: document.getElementById('sidebarTasksList'),
      sidebarNotesList: document.getElementById('sidebarNotesList'),
      sidebarMemoriesList: document.getElementById('sidebarMemoriesList'),

      // Vault
      vaultDropzone: document.getElementById('vaultDropzone'),
      vaultFileInput: document.getElementById('vaultFileInput'),
      vaultTableBody: document.getElementById('vaultTableBody'),
      vaultEmptyState: document.getElementById('vaultEmptyState'),

      // Advanced Composer Modal
      composerTrigger: document.getElementById('composerTrigger'),
      composerModal: document.getElementById('composerModal'),
      closeComposerBtn: document.getElementById('closeComposerBtn'),
      composerContent: document.getElementById('composerContent'),
      composerMood: document.getElementById('composerMood'),
      composerLocation: document.getElementById('composerLocation'),
      modalDetectLocationBtn: document.getElementById('modalDetectLocationBtn'),
      composerDate: document.getElementById('composerDate'),
      composerFiles: document.getElementById('composerFiles'),
      composerPhotos: document.getElementById('composerPhotos'),
      composerVideos: document.getElementById('composerVideos'),
      modalAddPhotosBtn: document.getElementById('modalAddPhotosBtn'),
      modalAddVideosBtn: document.getElementById('modalAddVideosBtn'),
      composerExternalUrl: document.getElementById('composerExternalUrl'),
      composerFilePreview: document.getElementById('composerFilePreview'),
      submitPostBtn: document.getElementById('submitPostBtn'),

      // Chat Drawer
      chatDrawer: document.getElementById('chatDrawer'),
      closeChatBtn: document.getElementById('closeChatBtn'),
      clearChatBtn: document.getElementById('clearChatBtn'),
      chatMessagesContainer: document.getElementById('chatMessagesContainer'),
      chatInput: document.getElementById('chatInput'),
      sendChatBtn: document.getElementById('sendChatBtn'),
      typingIndicator: document.getElementById('typingIndicator'),
      reflectJournalBtn: document.getElementById('reflectJournalBtn'),
      quickChips: document.querySelectorAll('.quick-chip'),

      // Settings Modal
      settingsModal: document.getElementById('settingsModal'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      clientIdInput: document.getElementById('clientIdInput'),
      geminiKeyInput: document.getElementById('geminiKeyInput'),
      displayNameInput: document.getElementById('displayNameInput'),
      avatarSelect: document.getElementById('avatarSelect'),
      avatarPreviewContainer: document.getElementById('avatarPreviewContainer'),
      settingsAvatarPreview: document.getElementById('settingsAvatarPreview'),
      profilePicInput: document.getElementById('profilePicInput'),
      uploadProfilePicBtn: document.getElementById('uploadProfilePicBtn'),
      removeProfilePicBtn: document.getElementById('removeProfilePicBtn'),
      presetAvatarsContainer: document.getElementById('presetAvatarsContainer'),
      themeToggle: document.getElementById('themeToggle'),
      connectDriveBtn: document.getElementById('connectDriveBtn'),
      disconnectDriveBtn: document.getElementById('disconnectDriveBtn'),
      manualSyncBtn: document.getElementById('manualSyncBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      settingsInstallBtn: document.getElementById('settingsInstallBtn'),
      iosInstructionsBtn: document.getElementById('iosInstructionsBtn'),
      pwaInstalledBadge: document.getElementById('pwaInstalledBadge'),

      // iOS Install Modal
      iosInstallModal: document.getElementById('iosInstallModal'),
      closeIosInstallBtn: document.getElementById('closeIosInstallBtn'),
      dismissIosInstallBtn: document.getElementById('dismissIosInstallBtn'),

      // Lightbox
      lightboxModal: document.getElementById('lightboxModal'),
      lightboxImg: document.getElementById('lightboxImg'),
      lightboxCloseBtn: document.getElementById('lightboxCloseBtn'),
      lightboxPrevBtn: document.getElementById('lightboxPrevBtn'),
      lightboxNextBtn: document.getElementById('lightboxNextBtn'),
      lightboxCounter: document.getElementById('lightboxCounter')
    };
  }

  // Progressive Web App: Service Worker Registration
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('Alcove Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('Alcove Service Worker registration failed:', err);
          });
      });
    }
  }

  // Progressive Web App: Standalone Installation Management
  let deferredInstallPrompt = null;

  function initPwaInstall() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      dom.installAppBtn?.classList.add('hidden');
      dom.pwaInstalledBadge?.classList.remove('hidden');
      if (dom.settingsInstallBtn) {
        dom.settingsInstallBtn.textContent = 'Installed';
        dom.settingsInstallBtn.disabled = true;
      }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      dom.installAppBtn?.classList.remove('hidden');
      if (dom.settingsInstallBtn) dom.settingsInstallBtn.disabled = false;
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      dom.installAppBtn?.classList.add('hidden');
      dom.pwaInstalledBadge?.classList.remove('hidden');
      if (dom.settingsInstallBtn) {
        dom.settingsInstallBtn.textContent = 'Installed';
        dom.settingsInstallBtn.disabled = true;
      }
    });

    const triggerInstall = async () => {
      const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
      if (isIos && !window.navigator.standalone) {
        dom.iosInstallModal?.classList.remove('hidden');
        return;
      }

      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          deferredInstallPrompt = null;
          dom.installAppBtn?.classList.add('hidden');
        }
      } else {
        dom.iosInstallModal?.classList.remove('hidden');
      }
    };

    dom.installAppBtn?.addEventListener('click', triggerInstall);
    dom.settingsInstallBtn?.addEventListener('click', triggerInstall);
    dom.iosInstructionsBtn?.addEventListener('click', () => {
      dom.iosInstallModal?.classList.remove('hidden');
    });

    const closeIosModal = () => dom.iosInstallModal?.classList.add('hidden');
    dom.closeIosInstallBtn?.addEventListener('click', closeIosModal);
    dom.dismissIosInstallBtn?.addEventListener('click', closeIosModal);
  }

  // Network Detection & Automatic Background Synchronisation
  function initNetworkAndAutoSync() {
    function handleNetworkChange() {
      const isOnline = navigator.onLine;
      if (!isOnline) {
        updateSyncBadge('offline', 'Offline mode active. All entries are encrypted locally in IndexedDB.');
      } else {
        if (window.DriveSync && window.DriveSync.isAuthenticated()) {
          updateSyncBadge('connected', 'Google Drive connected. Auto-sync active.');
        } else {
          updateSyncBadge('local', 'Online. Saved locally in IndexedDB.');
        }
      }
    }

    window.addEventListener('online', async () => {
      handleNetworkChange();
      // Silently auto-sync unsynced posts and vault files when back online
      if (window.DriveSync && window.DriveSync.isAuthenticated()) {
        try {
          updateSyncBadge('syncing', 'Syncing pending records to Google Drive...');
          await window.DriveSync.syncPosts();
          await window.DriveSync.syncVault();
          updateSyncBadge('synced', 'All entries synced to Google Drive.');
          await refreshFeed();
        } catch (err) {
          console.warn('Background auto-sync on reconnect error:', err);
        }
      }
    });

    window.addEventListener('offline', () => {
      handleNetworkChange();
    });

    handleNetworkChange();
  }

  // Initialise Application
  async function init() {
    cacheDom();
    setupEventListeners();
    registerServiceWorker();
    initPwaInstall();
    initNetworkAndAutoSync();
    updateDateDisplay();

    await loadSettings();

    if (state.googleClientId && window.DriveSync) {
      window.DriveSync.init(state.googleClientId, () => {
        updateSyncBadge('connected', 'Google Drive connected.');
      });
    }

    if (window.DriveSync) {
      window.DriveSync.onStatusChange((status, detail) => {
        state.syncStatus = status;
        updateSyncBadge(status, detail);
      });
    }

    // Load initial data
    await Promise.all([
      refreshFeed(),
      checkMemories(),
      refreshVault(),
      refreshNotes(),
      refreshTasks(),
      renderChatHistory()
    ]);

    // Check task reminders periodically (every 60 seconds)
    setInterval(checkTaskReminders, 60000);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function updateDateDisplay() {
    if (dom.currentDateEl) {
      const now = new Date();
      dom.currentDateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  async function loadSettings() {
    const profile = await window.DiaryDB.getSetting('profile', {
      name: 'Alcove Resident',
      avatar: '🌙',
      avatarImage: null,
      theme: 'cyberneon',
      colorMode: 'dark'
    });

    // Default to Cyber Neon theme
    if (!profile.theme || profile.theme === 'acrylic' || profile.theme === 'dark') {
      profile.theme = 'cyberneon';
    }
    if (!profile.colorMode) profile.colorMode = 'dark';

    state.profile = profile;

    const clientId = await window.DiaryDB.getSetting('google_client_id', '');
    state.googleClientId = clientId;

    const geminiKey = await window.DiaryDB.getSetting('gemini_api_key', '');
    state.geminiApiKey = geminiKey;

    applyProfile();
  }

  function renderAvatarElement(container, avatarImage, avatarEmoji, name) {
    if (!container) return;
    container.innerHTML = '';
    if (avatarImage) {
      const img = document.createElement('img');
      img.src = avatarImage;
      img.alt = escapeHtml(name || 'Profile Picture');
      img.className = 'w-full h-full object-cover rounded-full';
      container.appendChild(img);
    } else {
      container.textContent = avatarEmoji || '🌙';
    }
  }

  function getAvatarHtml(avatarImage, avatarEmoji, name, sizeClass = 'w-10 h-10', textClass = 'text-lg') {
    if (avatarImage) {
      return `<div class="${sizeClass} rounded-full overflow-hidden bg-stone-800 border border-white/10 flex-shrink-0 shadow-md"><img src="${avatarImage}" alt="${escapeHtml(name || 'Avatar')}" class="w-full h-full object-cover"></div>`;
    }
    return `<div class="${sizeClass} rounded-full bg-stone-800 border border-white/10 flex items-center justify-center ${textClass} flex-shrink-0 shadow-md select-none">${escapeHtml(avatarEmoji || '🌙')}</div>`;
  }

  function processProfileImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Please select a valid image file (PNG, JPG, or WEBP).'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image file content.'));
        img.onload = () => {
          const size = 320;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPresetAvatars() {
    if (!dom.presetAvatarsContainer) return;
    dom.presetAvatarsContainer.innerHTML = '';

    PRESET_AVATARS.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-avatar-btn ' + (state.profile.avatarImage === preset.url ? 'active' : '');
      btn.title = preset.name;
      btn.innerHTML = `<img src="${preset.url}" alt="${escapeHtml(preset.name)}">`;
      btn.addEventListener('click', () => {
        state.profile.avatarImage = preset.url;
        applyProfile();
      });
      dom.presetAvatarsContainer.appendChild(btn);
    });
  }

  const THEMES = [
    {
      id: 'cyberneon',
      name: 'Dark Neon Transparent',
      desc: 'Translucent dark glass & neon glowing borders',
      gradient: 'linear-gradient(135deg, #04060c, #00f0ff, #a855f7)',
      dotColor: '#00f0ff',
      isLight: false
    },
    {
      id: 'drikell',
      name: 'Vermillion Horizon (Drikell)',
      desc: 'Acoustic ember & neon vermillion',
      gradient: 'linear-gradient(135deg, #090403, #ff5722)',
      dotColor: '#ff5722',
      isLight: false
    },
    {
      id: 'crystal',
      name: 'Transparent Liquid Glass',
      desc: 'Translucent aqua glass & mist',
      gradient: 'linear-gradient(135deg, #0ea5e9, #2dd4bf, #f0fdfa)',
      dotColor: '#0ea5e9',
      isLight: true
    },
    {
      id: 'acrylic',
      name: 'Smoked Acrylic',
      desc: 'Neutral Threads dark glass',
      gradient: 'linear-gradient(135deg, #1e2025, #f59e0b)',
      dotColor: '#f59e0b',
      isLight: false
    },
    {
      id: 'violet',
      name: 'Midnight Violet',
      desc: 'Plum & neon violet aura',
      gradient: 'linear-gradient(135deg, #1d0c36, #a855f7)',
      dotColor: '#a855f7',
      isLight: false
    },
    {
      id: 'oled',
      name: 'Obsidian OLED',
      desc: 'Pitch black & monochrome',
      gradient: 'linear-gradient(135deg, #000000, #e2e8f0)',
      dotColor: '#e2e8f0',
      isLight: false
    },
    {
      id: 'emerald',
      name: 'Emerald Sanctuary',
      desc: 'Pine green & spiritual gold',
      gradient: 'linear-gradient(135deg, #0a2118, #10b981)',
      dotColor: '#10b981',
      isLight: false
    },
    {
      id: 'ocean',
      name: 'Oceanic Abyss',
      desc: 'Deep slate & arctic teal',
      gradient: 'linear-gradient(135deg, #0b2232, #06b6d4)',
      dotColor: '#06b6d4',
      isLight: false
    },
    {
      id: 'light',
      name: 'Pearl Daylight',
      desc: 'Crisp frosted light mode',
      gradient: 'linear-gradient(135deg, #f1f5f9, #d97706)',
      dotColor: '#d97706',
      isLight: true
    }
  ];

  function applyTheme(themeId = 'cyberneon', colorMode = 'dark') {
    if (themeId === 'dark') themeId = 'cyberneon';
    if (!THEMES.some(t => t.id === themeId)) themeId = 'cyberneon';

    let effectiveMode = colorMode;
    if (colorMode === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveMode = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.dataset.theme = themeId;
    document.documentElement.dataset.mode = effectiveMode;

    if (effectiveMode === 'light' || themeId === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }

    state.profile.theme = themeId;
    state.profile.colorMode = colorMode;

    dom.modeSelectBtns?.forEach(btn => {
      btn.classList.toggle('active-mode', btn.dataset.mode === colorMode);
    });

    renderThemeCards();
    window.DiaryDB.saveSetting('profile', state.profile).catch(e => console.warn('Theme save error:', e));
  }

  function renderThemeCards() {
    if (!dom.themeCardsGrid) return;
    dom.themeCardsGrid.innerHTML = '';

    const currentTheme = state.profile.theme || 'acrylic';

    for (const theme of THEMES) {
      const isSelected = currentTheme === theme.id;
      const card = document.createElement('div');
      card.className = `theme-card-tile ${isSelected ? 'active-theme' : ''}`;
      card.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="theme-swatch-circle" style="background: ${theme.gradient}; border-color: ${theme.dotColor};"></div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-stone-100 truncate">${escapeHtml(theme.name)}</div>
            <div class="text-[10px] text-stone-400 truncate">${escapeHtml(theme.desc)}</div>
          </div>
          ${isSelected ? `<i data-lucide="check-circle-2" class="w-4 h-4 text-amber-400 flex-shrink-0"></i>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        applyTheme(theme.id, theme.isLight ? 'light' : (state.profile.colorMode === 'light' ? 'dark' : state.profile.colorMode));
      });

      dom.themeCardsGrid.appendChild(card);
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function applyProfile() {
    renderAvatarElement(dom.userAvatarNav, state.profile.avatarImage, state.profile.avatar, state.profile.name);
    renderAvatarElement(dom.inlineComposerAvatar, state.profile.avatarImage, state.profile.avatar, state.profile.name);
    renderAvatarElement(dom.settingsAvatarPreview, state.profile.avatarImage, state.profile.avatar, state.profile.name);

    if (dom.inlineComposerName) dom.inlineComposerName.textContent = state.profile.name || 'Alcove Resident';

    if (dom.removeProfilePicBtn) {
      dom.removeProfilePicBtn.classList.toggle('hidden', !state.profile.avatarImage);
    }

    renderPresetAvatars();
    applyTheme(state.profile.theme || 'cyberneon', state.profile.colorMode || 'dark');

    if (dom.clientIdInput) dom.clientIdInput.value = state.googleClientId;
    if (dom.geminiKeyInput) dom.geminiKeyInput.value = state.geminiApiKey;
    if (dom.displayNameInput) dom.displayNameInput.value = state.profile.name;
    if (dom.avatarSelect) dom.avatarSelect.value = state.profile.avatar || '🌙';
  }

  function updateSyncBadge(status, detail) {
    if (!dom.syncStatusBadge) return;
    const dot = dom.syncStatusBadge.querySelector('.status-dot');
    const label = dom.syncStatusBadge.querySelector('.status-text');

    if (status === 'connected' || status === 'synced') {
      dot.className = 'status-dot w-2 h-2 rounded-full bg-emerald-500';
      label.textContent = 'Drive Synced';
      dom.syncStatusBadge.title = detail || 'Connected and up to date';
      if (dom.connectDriveBtn) dom.connectDriveBtn.classList.add('hidden');
      if (dom.disconnectDriveBtn) dom.disconnectDriveBtn.classList.remove('hidden');
    } else if (status === 'syncing') {
      dot.className = 'status-dot w-2 h-2 rounded-full bg-amber-500 animate-pulse';
      label.textContent = 'Syncing...';
      dom.syncStatusBadge.title = detail || 'Syncing data with Google Drive';
    } else if (status === 'unauthorized' || status === 'error') {
      dot.className = 'status-dot w-2 h-2 rounded-full bg-rose-500';
      label.textContent = 'Sync Error';
      dom.syncStatusBadge.title = detail || 'Authorisation or connection error';
      if (dom.connectDriveBtn) dom.connectDriveBtn.classList.remove('hidden');
      if (dom.disconnectDriveBtn) dom.disconnectDriveBtn.classList.add('hidden');
    } else {
      dot.className = 'status-dot w-2 h-2 rounded-full bg-stone-500';
      label.textContent = 'Offline / Local';
      dom.syncStatusBadge.title = 'Saved to IndexedDB offline. Add Google Client ID in Settings to sync.';
      if (dom.connectDriveBtn) dom.connectDriveBtn.classList.remove('hidden');
      if (dom.disconnectDriveBtn) dom.disconnectDriveBtn.classList.add('hidden');
    }
  }

  // Navigation Tab Switching
  function switchTab(tab) {
    if (tab !== 'search') {
      state.previousTab = tab;
    }
    state.currentTab = tab;

    dom.feedView?.classList.toggle('hidden', tab !== 'feed');
    dom.searchView?.classList.toggle('hidden', tab !== 'search');
    dom.notesView?.classList.toggle('hidden', tab !== 'notes');
    dom.tasksView?.classList.toggle('hidden', tab !== 'tasks');
    dom.memoriesView?.classList.toggle('hidden', tab !== 'memories');
    dom.vaultView?.classList.toggle('hidden', tab !== 'vault');

    const navButtons = [dom.navFeedBtn, dom.navNotesBtn, dom.navTasksBtn, dom.navVaultBtn, dom.navMemoriesBtn];
    for (const btn of navButtons) {
      if (!btn) continue;
      btn.classList.remove('text-stone-100', 'font-semibold', 'bg-white/15');
      btn.classList.add('text-stone-400');
    }

    if (tab === 'feed' && dom.navFeedBtn) {
      dom.navFeedBtn.classList.remove('text-stone-400');
      dom.navFeedBtn.classList.add('text-stone-100', 'font-semibold', 'bg-white/15');
    } else if (tab === 'notes' && dom.navNotesBtn) {
      dom.navNotesBtn.classList.remove('text-stone-400');
      dom.navNotesBtn.classList.add('text-stone-100', 'font-semibold', 'bg-white/15');
      refreshNotes();
    } else if (tab === 'tasks' && dom.navTasksBtn) {
      dom.navTasksBtn.classList.remove('text-stone-400');
      dom.navTasksBtn.classList.add('text-stone-100', 'font-semibold', 'bg-white/15');
      refreshTasks();
    } else if (tab === 'memories' && dom.navMemoriesBtn) {
      dom.navMemoriesBtn.classList.remove('text-stone-400');
      dom.navMemoriesBtn.classList.add('text-stone-100', 'font-semibold', 'bg-white/15');
      renderMemoriesTab();
    } else if (tab === 'vault' && dom.navVaultBtn) {
      dom.navVaultBtn.classList.remove('text-stone-400');
      dom.navVaultBtn.classList.add('text-stone-100', 'font-semibold', 'bg-white/15');
      refreshVault();
    }

    const dockTabs = document.querySelectorAll('.floating-glass-dock .dock-item[data-dock-tab]');
    dockTabs.forEach(item => {
      item.classList.toggle('active', item.dataset.dockTab === tab);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // GLOBAL SEARCH ENGINE (Posts, Files, Notes, Tasks)
  async function handleSearchInput(e) {
    const query = (e.target.value || '').trim();
    state.searchQuery = query;

    if (!query) {
      dom.clearSearchBtn.classList.add('hidden');
      switchTab(state.previousTab || 'feed');
      return;
    }

    dom.clearSearchBtn.classList.remove('hidden');
    if (state.currentTab !== 'search') {
      switchTab('search');
    }

    if (dom.searchQueryLabel) {
      dom.searchQueryLabel.textContent = query;
    }

    // Perform full-text search across all IndexedDB stores
    const results = await window.DiaryDB.searchAll(query);
    state.searchResults = results;

    updateSearchCounts(results);
    renderSearchResults();
  }

  function updateSearchCounts(results) {
    const total = results.posts.length + results.vault.length + results.notes.length + results.tasks.length;
    if (dom.countSearchAll) dom.countSearchAll.textContent = total;
    if (dom.countSearchPosts) dom.countSearchPosts.textContent = results.posts.length;
    if (dom.countSearchVault) dom.countSearchVault.textContent = results.vault.length;
    if (dom.countSearchNotes) dom.countSearchNotes.textContent = results.notes.length;
    if (dom.countSearchTasks) dom.countSearchTasks.textContent = results.tasks.length;
  }

  function renderSearchResults() {
    if (!dom.searchResultsContainer) return;
    dom.searchResultsContainer.innerHTML = '';

    const { posts, vault, notes, tasks } = state.searchResults;
    const cat = state.searchCategory;
    const query = state.searchQuery;

    let hasMatches = false;

    // 1. Posts Matches
    if ((cat === 'all' || cat === 'posts') && posts.length > 0) {
      hasMatches = true;
      const section = document.createElement('div');
      section.className = 'space-y-3';
      section.innerHTML = `<h4 class="text-xs uppercase font-semibold text-amber-400 tracking-wider flex items-center gap-1.5"><i data-lucide="newspaper" class="w-3.5 h-3.5"></i> Matching Diary Posts (${posts.length})</h4>`;

      for (const p of posts) {
        const item = document.createElement('div');
        item.className = 'glass-inset p-3.5 space-y-1.5 text-xs cursor-pointer hover:border-amber-500/50 transition group';
        item.innerHTML = `
          <div class="flex items-center justify-between text-stone-400 text-[11px]">
            <span>${new Date(p.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <div class="flex items-center gap-2">
              ${p.location ? `<span class="badge-location text-[10px] py-0 px-2" title="Location"><i data-lucide="map-pin" class="w-2.5 h-2.5 text-rose-400"></i>${highlightMatches(p.location, query)}</span>` : ''}
              <span class="btn-pill py-0 px-2 text-[10px]">${escapeHtml(p.mood || 'Reflection')}</span>
              <span class="text-amber-400 group-hover:text-amber-300 font-medium text-[11px] flex items-center gap-0.5">
                <span>Jump to post</span>
                <i data-lucide="arrow-right" class="w-3 h-3"></i>
              </span>
            </div>
          </div>
          <div class="text-stone-200 leading-relaxed text-sm">${highlightMatches(p.content, query)}</div>
        `;
        item.addEventListener('click', () => jumpToPost(p.id));
        section.appendChild(item);
      }
      dom.searchResultsContainer.appendChild(section);
    }

    // 2. Private Vault File Matches
    if ((cat === 'all' || cat === 'vault') && vault.length > 0) {
      hasMatches = true;
      const section = document.createElement('div');
      section.className = 'space-y-3';
      section.innerHTML = `<h4 class="text-xs uppercase font-semibold text-amber-400 tracking-wider flex items-center gap-1.5"><i data-lucide="lock" class="w-3.5 h-3.5"></i> Matching Private Vault Files (${vault.length})</h4>`;

      for (const v of vault) {
        const item = document.createElement('div');
        item.className = 'glass-inset p-3 flex items-center justify-between text-xs';
        item.innerHTML = `
          <div class="flex items-center gap-2.5 truncate">
            <i data-lucide="file-text" class="w-4 h-4 text-amber-500 flex-shrink-0"></i>
            <span class="font-medium text-stone-200 truncate">${highlightMatches(v.name, query)}</span>
            <span class="text-stone-500 text-[11px]">(${formatFileSize(v.size)})</span>
          </div>
          <button type="button" class="btn-vault-search-download btn-pill text-[11px] py-0.5 px-2.5 flex items-center gap-1">
            <i data-lucide="download" class="w-3 h-3"></i> Download
          </button>
        `;
        item.querySelector('.btn-vault-search-download').addEventListener('click', async () => {
          let blob = v.blob || (await window.DiaryDB.getVaultFileById(v.id))?.blob;
          if (!blob && v.driveFileId && window.DriveSync && window.DriveSync.isAuthenticated()) {
            blob = await window.DriveSync.downloadFileBlob(v.driveFileId);
          }
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = v.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        });
        section.appendChild(item);
      }
      dom.searchResultsContainer.appendChild(section);
    }

    // 3. Notes Matches
    if ((cat === 'all' || cat === 'notes') && notes.length > 0) {
      hasMatches = true;
      const section = document.createElement('div');
      section.className = 'space-y-3';
      section.innerHTML = `<h4 class="text-xs uppercase font-semibold text-amber-400 tracking-wider flex items-center gap-1.5"><i data-lucide="sticky-note" class="w-3.5 h-3.5"></i> Matching Scratchpad Notes (${notes.length})</h4>`;

      for (const n of notes) {
        const item = document.createElement('div');
        item.className = 'glass-inset p-3.5 space-y-1.5 text-xs';
        item.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-semibold text-stone-100 text-sm">${highlightMatches(n.title, query)}</span>
            <span class="text-[11px] text-stone-500">${formatRelativeTime(n.updatedAt)}</span>
          </div>
          <div class="text-stone-300 leading-relaxed">${highlightMatches(n.content, query)}</div>
        `;
        section.appendChild(item);
      }
      dom.searchResultsContainer.appendChild(section);
    }

    // 4. Tasks Matches
    if ((cat === 'all' || cat === 'tasks') && tasks.length > 0) {
      hasMatches = true;
      const section = document.createElement('div');
      section.className = 'space-y-3';
      section.innerHTML = `<h4 class="text-xs uppercase font-semibold text-amber-400 tracking-wider flex items-center gap-1.5"><i data-lucide="check-square" class="w-3.5 h-3.5"></i> Matching Tasks (${tasks.length})</h4>`;

      for (const t of tasks) {
        const item = document.createElement('div');
        item.className = 'task-row ' + (t.completed ? 'completed' : '');
        item.innerHTML = `
          <div class="flex items-center gap-2.5">
            <input type="checkbox" class="custom-checkbox" ${t.completed ? 'checked' : ''} disabled>
            <span class="task-title text-xs font-medium text-stone-200">${highlightMatches(t.title, query)}</span>
          </div>
          <span class="text-[11px] text-stone-400">${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date'}</span>
        `;
        section.appendChild(item);
      }
      dom.searchResultsContainer.appendChild(section);
    }

    if (dom.searchEmptyState) {
      dom.searchEmptyState.classList.toggle('hidden', hasMatches);
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function clearSearch() {
    state.searchQuery = '';
    if (dom.globalSearchInput) dom.globalSearchInput.value = '';
    if (dom.clearSearchBtn) dom.clearSearchBtn.classList.add('hidden');
    switchTab(state.previousTab || 'feed');
  }

  // NOTES & SCRATCHPAD MANAGEMENT
  async function refreshNotes() {
    state.notes = await window.DiaryDB.getAllNotes();
    renderNotes();
    renderSidebarNotes();
  }

  function renderNotes() {
    if (!dom.notesContainer) return;
    dom.notesContainer.innerHTML = '';

    if (state.notes.length === 0) {
      if (dom.notesEmptyState) dom.notesEmptyState.classList.remove('hidden');
      return;
    }
    if (dom.notesEmptyState) dom.notesEmptyState.classList.add('hidden');

    for (const note of state.notes) {
      const card = document.createElement('div');
      card.className = `note-card ${note.pinned ? 'pinned' : ''}`;

      // Color accent mapping
      let colorBorder = 'border-stone-500/20';
      let colorTag = 'Mocha';
      if (note.color === 'amber') {
        colorBorder = 'border-amber-500/30';
        colorTag = 'Amber';
      } else if (note.color === 'sage') {
        colorBorder = 'border-emerald-500/30';
        colorTag = 'Sage';
      } else if (note.color === 'indigo') {
        colorBorder = 'border-indigo-500/30';
        colorTag = 'Indigo';
      }

      card.classList.add(colorBorder);

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h4 class="font-bold text-sm text-stone-100">${escapeHtml(note.title || 'Untitled Note')}</h4>
            ${note.pinned ? '<span class="badge-amber text-[10px] py-0 px-1.5">Pinned</span>' : ''}
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-pin-note p-1 text-stone-400 hover:text-amber-400" title="${note.pinned ? 'Unpin' : 'Pin to top'}">
              <i data-lucide="${note.pinned ? 'pin-off' : 'pin'}" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="btn-delete-note p-1 text-stone-400 hover:text-rose-400" title="Delete note">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <p class="text-xs text-stone-300 whitespace-pre-wrap leading-relaxed mb-3">${escapeHtml(note.content || '')}</p>

        <div class="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-white/[0.06]">
          <span>${formatRelativeTime(note.updatedAt)}</span>
          <button type="button" class="btn-copy-note text-stone-400 hover:text-stone-200">Copy text</button>
        </div>
      `;

      // Event handlers
      card.querySelector('.btn-pin-note').addEventListener('click', async () => {
        note.pinned = !note.pinned;
        await window.DiaryDB.saveNote(note);
        await refreshNotes();
        if (window.DriveSync && window.DriveSync.isAuthenticated()) {
          window.DriveSync.syncNotes().catch(e => console.warn(e));
        }
      });

      card.querySelector('.btn-delete-note').addEventListener('click', async () => {
        if (confirm('Delete this note?')) {
          await window.DiaryDB.deleteNote(note.id);
          await refreshNotes();
          if (window.DriveSync && window.DriveSync.isAuthenticated()) {
            window.DriveSync.syncNotes().catch(e => console.warn(e));
          }
        }
      });

      card.querySelector('.btn-copy-note').addEventListener('click', () => {
        navigator.clipboard.writeText(`${note.title ? note.title + '\n\n' : ''}${note.content}`);
        alert('Note copied to clipboard.');
      });

      dom.notesContainer.appendChild(card);
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  async function handleSaveNote() {
    const title = dom.noteTitleInput.value.trim();
    const content = dom.noteContentInput.value.trim();
    const color = dom.noteColorInput.value;
    const pinned = dom.notePinInput.checked;

    if (!title && !content) {
      alert('Please enter a note title or content.');
      return;
    }

    dom.saveNoteBtn.disabled = true;
    try {
      await window.DiaryDB.saveNote({
        title,
        content,
        color,
        pinned
      });

      dom.noteTitleInput.value = '';
      dom.noteContentInput.value = '';
      dom.notePinInput.checked = false;

      await refreshNotes();

      if (window.DriveSync && window.DriveSync.isAuthenticated()) {
        window.DriveSync.syncNotes().catch(e => console.warn('Drive notes sync error:', e));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save note: ' + err.message);
    } finally {
      dom.saveNoteBtn.disabled = false;
    }
  }

  function renderSidebarNotes() {
    if (!dom.sidebarNotesList) return;
    dom.sidebarNotesList.innerHTML = '';

    const previewNotes = state.notes.slice(0, 3);
    if (previewNotes.length === 0) {
      dom.sidebarNotesList.innerHTML = `
        <div class="text-xs text-stone-500 py-1">
          No memos stored. Click + New Note above.
        </div>
      `;
      return;
    }

    for (const n of previewNotes) {
      const item = document.createElement('div');
      item.className = 'glass-inset p-2.5 space-y-1 cursor-pointer hover:border-amber-500/40 transition';
      item.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <span class="font-semibold text-stone-200 truncate">${escapeHtml(n.title || 'Note')}</span>
          ${n.pinned ? '<i data-lucide="pin" class="w-3 h-3 text-amber-400"></i>' : ''}
        </div>
        <p class="text-[11px] text-stone-400 truncate">${escapeHtml(n.content || '')}</p>
      `;
      item.addEventListener('click', () => switchTab('notes'));
      dom.sidebarNotesList.appendChild(item);
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // TASK REMINDERS MANAGEMENT
  async function refreshTasks() {
    state.tasks = await window.DiaryDB.getAllTasks();
    renderTasks();
    checkTaskReminders();
    renderSidebarTasks();
  }

  function checkTaskReminders() {
    const now = Date.now();
    const dueOrOverdue = state.tasks.filter(t => {
      if (t.completed || !t.dueDate || !t.reminder) return false;
      const due = new Date(t.dueDate).getTime();
      return due <= now + 3600000; // Overdue or due in the next hour
    });

    if (dom.taskReminderBadge) {
      if (dueOrOverdue.length > 0) {
        dom.taskReminderBadge.textContent = dueOrOverdue.length;
        dom.taskReminderBadge.classList.remove('hidden');
      } else {
        dom.taskReminderBadge.classList.add('hidden');
      }
    }

    if (dom.taskRemindersAlertBanner) {
      if (dueOrOverdue.length > 0) {
        dom.taskRemindersAlertBanner.classList.remove('hidden');
        if (dom.taskRemindersAlertText) {
          const names = dueOrOverdue.map(t => `"${t.title}"`).slice(0, 3).join(', ');
          dom.taskRemindersAlertText.textContent = `You have ${dueOrOverdue.length} pending task ${dueOrOverdue.length === 1 ? 'reminder' : 'reminders'}: ${names}.`;
        }
      } else {
        dom.taskRemindersAlertBanner.classList.add('hidden');
      }
    }
  }

  function renderTasks() {
    if (!dom.tasksContainer) return;
    dom.tasksContainer.innerHTML = '';

    const filter = state.taskFilter;
    let filtered = state.tasks;
    if (filter === 'pending') {
      filtered = state.tasks.filter(t => !t.completed);
    } else if (filter === 'completed') {
      filtered = state.tasks.filter(t => t.completed);
    }

    const pendingCount = state.tasks.filter(t => !t.completed).length;
    if (dom.tasksSummaryText) {
      dom.tasksSummaryText.textContent = `${pendingCount} pending, ${state.tasks.length - pendingCount} completed`;
    }

    if (filtered.length === 0) {
      if (dom.tasksEmptyState) dom.tasksEmptyState.classList.remove('hidden');
      return;
    }
    if (dom.tasksEmptyState) dom.tasksEmptyState.classList.add('hidden');

    for (const task of filtered) {
      const row = document.createElement('div');
      row.className = `task-row ${task.completed ? 'completed' : ''}`;

      const isOverdue = !task.completed && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
      let dueBadge = '';
      if (task.dueDate) {
        const dueDateObj = new Date(task.dueDate);
        const dueText = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        dueBadge = `
          <span class="text-[11px] px-2 py-0.5 rounded-full ${isOverdue ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40' : 'bg-stone-800 text-stone-400'}">
            ${isOverdue ? 'Overdue: ' : 'Due: '}${dueText}
          </span>
        `;
      }

      row.innerHTML = `
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <input type="checkbox" class="custom-checkbox task-check" ${task.completed ? 'checked' : ''}>
          <div class="flex-1 truncate">
            <span class="task-title text-sm font-medium text-stone-200 block truncate">${escapeHtml(task.title)}</span>
            <div class="flex items-center gap-2 mt-0.5">
              ${dueBadge}
              ${task.reminder ? '<i data-lucide="bell" class="w-3 h-3 text-amber-400" title="Reminder enabled"></i>' : ''}
              ${task.priority === 'urgent' ? '<span class="text-[10px] text-rose-400 font-semibold uppercase">Urgent</span>' : ''}
              ${task.priority === 'high' ? '<span class="text-[10px] text-amber-400 font-semibold uppercase">High</span>' : ''}
            </div>
          </div>
        </div>
        <button type="button" class="btn-delete-task text-stone-500 hover:text-rose-400 p-1" title="Delete task">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;

      row.querySelector('.task-check').addEventListener('change', async () => {
        await window.DiaryDB.toggleTask(task.id);
        await refreshTasks();
        if (window.DriveSync && window.DriveSync.isAuthenticated()) {
          window.DriveSync.syncTasks().catch(e => console.warn(e));
        }
      });

      row.querySelector('.btn-delete-task').addEventListener('click', async () => {
        if (confirm('Delete this task?')) {
          await window.DiaryDB.deleteTask(task.id);
          await refreshTasks();
          if (window.DriveSync && window.DriveSync.isAuthenticated()) {
            window.DriveSync.syncTasks().catch(e => console.warn(e));
          }
        }
      });

      dom.tasksContainer.appendChild(row);
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  async function handleAddTask() {
    const title = dom.taskTitleInput.value.trim();
    const dueDate = dom.taskDueDateInput.value;
    const priority = dom.taskPriorityInput.value;
    const reminder = dom.taskReminderInput.checked;

    if (!title) {
      alert('Please enter a task title.');
      return;
    }

    dom.addTaskBtn.disabled = true;
    try {
      await window.DiaryDB.saveTask({
        title,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
        reminder,
        completed: false
      });

      dom.taskTitleInput.value = '';
      dom.taskDueDateInput.value = '';

      await refreshTasks();

      if (window.DriveSync && window.DriveSync.isAuthenticated()) {
        window.DriveSync.syncTasks().catch(e => console.warn('Drive tasks sync error:', e));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save task: ' + err.message);
    } finally {
      dom.addTaskBtn.disabled = false;
    }
  }

  function renderSidebarTasks() {
    if (!dom.sidebarTasksList) return;
    dom.sidebarTasksList.innerHTML = '';

    const pending = state.tasks.filter(t => !t.completed).slice(0, 4);
    if (pending.length === 0) {
      dom.sidebarTasksList.innerHTML = `
        <div class="text-xs text-stone-500 py-1">
          No pending tasks. You're all caught up!
        </div>
      `;
      return;
    }

    for (const t of pending) {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between gap-2 p-1.5 glass-inset text-xs';
      item.innerHTML = `
        <div class="flex items-center gap-2 truncate">
          <input type="checkbox" class="custom-checkbox sidebar-task-check" data-id="${t.id}">
          <span class="truncate font-medium text-stone-300">${escapeHtml(t.title)}</span>
        </div>
        ${t.dueDate ? `<span class="text-[10px] text-amber-400 flex-shrink-0">${new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>` : ''}
      `;

      item.querySelector('.sidebar-task-check').addEventListener('change', async () => {
        await window.DiaryDB.toggleTask(t.id);
        await refreshTasks();
        if (window.DriveSync && window.DriveSync.isAuthenticated()) {
          window.DriveSync.syncTasks().catch(e => console.warn(e));
        }
      });

      dom.sidebarTasksList.appendChild(item);
    }
  }

  // FEED & MEMORIES RENDERING
  async function refreshFeed() {
    state.posts = await window.DiaryDB.getAllPosts();
    filterAndRenderFeed();
    renderSidebarMemories();
  }

  function filterAndRenderFeed() {
    if (!state.posts) return;

    let filtered = [...state.posts];
    const query = (state.feedSearchQuery || '').toLowerCase().trim();
    const mood = state.feedMoodFilter || 'all';
    const dateFilter = state.feedDateFilter || '';

    // Filter by text search query across content, mood, location, and media filenames
    if (query) {
      filtered = filtered.filter(p => {
        const contentMatch = (p.content || '').toLowerCase().includes(query);
        const moodMatch = (p.mood || '').toLowerCase().includes(query);
        const locationMatch = (p.location || '').toLowerCase().includes(query);
        const mediaMatch = p.media && p.media.some(m => (m.name || '').toLowerCase().includes(query));
        return contentMatch || moodMatch || locationMatch || mediaMatch;
      });
    }

    // Filter by mood or media presence
    if (mood === 'has_media') {
      filtered = filtered.filter(p => p.media && p.media.length > 0);
    } else if (mood && mood !== 'all') {
      filtered = filtered.filter(p => (p.mood || '').includes(mood));
    }

    // Filter by date (timezone-safe comparison)
    if (dateFilter) {
      const [filterYear, filterMonth, filterDay] = dateFilter.split('-').map(Number);
      filtered = filtered.filter(p => {
        if (!p.timestamp) return false;
        const postDate = new Date(p.timestamp);
        return (
          postDate.getFullYear() === filterYear &&
          (postDate.getMonth() + 1) === filterMonth &&
          postDate.getDate() === filterDay
        );
      });
    }

    // Update search feedback banner
    const hasActiveFilter = Boolean(query || mood !== 'all' || dateFilter);
    if (dom.feedSearchFeedback) {
      dom.feedSearchFeedback.classList.toggle('hidden', !hasActiveFilter);
    }
    if (dom.clearFeedSearchBtn) {
      dom.clearFeedSearchBtn.classList.toggle('hidden', !query);
    }

    if (dom.feedSearchCount) {
      if (filtered.length === 0) {
        dom.feedSearchCount.textContent = 'No matching entries found';
      } else {
        dom.feedSearchCount.textContent = `Showing ${filtered.length} of ${state.posts.length} ${state.posts.length === 1 ? 'entry' : 'entries'}`;
      }
    }

    renderFeed(dom.feedContainer, filtered);
  }

  function resetFeedFilters() {
    state.feedSearchQuery = '';
    state.feedMoodFilter = 'all';
    state.feedDateFilter = '';

    if (dom.feedSearchInput) dom.feedSearchInput.value = '';
    if (dom.jumpToDateInput) dom.jumpToDateInput.value = '';
    if (dom.clearFeedSearchBtn) dom.clearFeedSearchBtn.classList.add('hidden');
    if (dom.feedSearchFeedback) dom.feedSearchFeedback.classList.add('hidden');

    if (dom.feedMoodFilterBtns) {
      dom.feedMoodFilterBtns.forEach(b => {
        if (b.dataset.mood === 'all') {
          b.classList.add('bg-white/15', 'text-stone-100');
        } else {
          b.classList.remove('bg-white/15', 'text-stone-100');
        }
      });
    }

    filterAndRenderFeed();
  }

  function jumpToPost(postId) {
    if (!postId) return;

    // Switch to feed tab if currently on search or another tab
    switchTab('feed');

    // Reset feed filters so post is not hidden by an active filter
    resetFeedFilters();

    // Allow DOM to settle, then scroll to and highlight post
    setTimeout(() => {
      const postCard = document.querySelector(`[data-post-id="${postId}"]`);
      if (postCard) {
        postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        postCard.classList.remove('highlight-pulse');
        void postCard.offsetWidth; // trigger reflow
        postCard.classList.add('highlight-pulse');
        setTimeout(() => {
          postCard.classList.remove('highlight-pulse');
        }, 3600);
      }
    }, 120);
  }

  async function checkMemories() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const currentYear = today.getFullYear();

    state.memories = await window.DiaryDB.getMemoriesForDate(month, day, currentYear);
    if (dom.memoriesBanner) {
      if (state.memories.length > 0) {
        dom.memoriesBanner.classList.remove('hidden');
        if (dom.memoriesBannerCount) {
          dom.memoriesBannerCount.textContent = `${state.memories.length} ${state.memories.length === 1 ? 'memory' : 'memories'}`;
        }
      } else {
        dom.memoriesBanner.classList.add('hidden');
      }
    }
  }

  function renderSidebarMemories() {
    if (!dom.sidebarMemoriesList) return;
    dom.sidebarMemoriesList.innerHTML = '';

    const itemsToShow = state.memories.length > 0 ? state.memories : state.posts.slice(0, 4);

    if (itemsToShow.length === 0) {
      dom.sidebarMemoriesList.innerHTML = `
        <div class="text-xs text-stone-500 py-2">
          No reflections yet. Write a thread to begin.
        </div>
      `;
      return;
    }

    itemsToShow.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3 group';

      const postDate = new Date(item.timestamp);
      const isPastYear = item.year < new Date().getFullYear();
      const dateText = isPastYear
        ? `${new Date().getFullYear() - item.year}y ago (${item.year})`
        : formatRelativeTime(item.timestamp);

      const snippet = item.content ? (item.content.length > 28 ? item.content.slice(0, 26) + '...' : item.content) : (item.mood || 'Media entry');

      row.innerHTML = `
        <div class="flex items-center gap-2.5 overflow-hidden">
          <div class="w-8 h-8 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center text-xs flex-shrink-0">
            ${escapeHtml(item.mood?.split(' ')[0] || state.profile.avatar || '🌙')}
          </div>
          <div class="truncate">
            <div class="text-xs font-medium text-stone-200 truncate group-hover:text-amber-400 transition">
              ${escapeHtml(snippet)}
            </div>
            <div class="text-[11px] text-stone-500">
              ${dateText}
            </div>
          </div>
        </div>
        <button type="button" class="btn-sidebar-reflect btn-pill text-[11px] py-0.5 px-2.5 flex-shrink-0">
          Reflect
        </button>
      `;

      row.querySelector('.btn-sidebar-reflect').addEventListener('click', () => {
        openChatDrawer();
        const dateStr = postDate.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const prompt = `Here is a reflection from ${dateStr}${item.mood ? ` (${item.mood})` : ''}:\n\n"${item.content}"\n\nPlease offer gentle Islamic perspective and comfort.`;
        window.NaseehaChat.sendMessage(prompt, handleChatMessageAdded);
      });

      dom.sidebarMemoriesList.appendChild(row);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function renderMemoriesTab() {
    if (!dom.memoriesFeedContainer) return;
    if (state.memories.length === 0) {
      dom.memoriesFeedContainer.innerHTML = `
        <div class="glass-inset p-10 text-center">
          <div class="text-3xl mb-2">🗓️</div>
          <h3 class="text-base font-semibold text-stone-200">No Memories For Today</h3>
          <p class="text-stone-400 text-xs mt-1">
            Entries penned on this day in past years will appear here.
          </p>
        </div>
      `;
      return;
    }
    renderFeed(dom.memoriesFeedContainer, state.memories, true);
  }

  function renderFeed(container, posts, isMemoryFeed = false) {
    if (!container) return;

    if (window.MediaPlayer) {
      window.MediaPlayer.destroyAll();
    }

    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <div class="glass-inset p-10 text-center">
          <div class="text-3xl mb-2">✍️</div>
          <h3 class="text-base font-semibold text-stone-200">Your Diary is Empty</h3>
          <p class="text-stone-400 text-xs mt-1">
            Start a thread above to save your first private reflection.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    posts.forEach((post, index) => {
      const isLast = index === posts.length - 1;
      const card = createPostCard(post, isMemoryFeed, isLast);
      container.appendChild(card);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  async function generateAndAttachFriendComment(postId, force = false) {
    const post = await window.DiaryDB.getPostById(postId);
    if (!post) return;

    post.comments = post.comments || [];
    const hasGuideComment = post.comments.some(c => c.authorRole === 'Friend & Guide');
    if (!force && hasGuideComment) {
      return;
    }

    if (!window.NaseehaChat) return;
    const apiKey = window.NaseehaChat.getApiKey();
    if (!apiKey) {
      if (force) {
        alert('Please configure your Gemini API Key in Settings to receive friend guidance comments from Naseeha.');
      }
      return;
    }

    const card = dom.feedContainer?.querySelector(`[data-post-id="${postId}"]`);
    let loadingEl = null;
    if (card) {
      const section = card.querySelector('.post-comments-section');
      if (section) {
        loadingEl = document.createElement('div');
        loadingEl.className = 'friend-guide-loading flex items-center gap-2 text-xs text-emerald-400 py-1.5 px-2 bg-emerald-950/30 rounded-lg border border-emerald-500/20';
        loadingEl.innerHTML = `
          <div class="flex items-center gap-1">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
          <span>Naseeha is penning a friend's reflection...</span>
        `;
        section.prepend(loadingEl);
      }
    }

    try {
      const commentText = await window.NaseehaChat.generateFriendPostComment(post.content, post.mood, post.location);
      const newComment = {
        id: 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        authorName: 'Naseeha',
        authorRole: 'Friend & Guide',
        avatar: '🌿',
        content: commentText,
        timestamp: new Date().toISOString()
      };

      if (force && hasGuideComment) {
        post.comments = post.comments.filter(c => c.authorRole !== 'Friend & Guide');
      }
      post.comments.push(newComment);
      post.synced = 0;

      await window.DiaryDB.savePost(post);
      await refreshFeed();

      if (window.DriveSync && window.DriveSync.isAuthenticated()) {
        window.DriveSync.syncPosts().catch(err => console.warn('Sync after comment error:', err));
      }
    } catch (err) {
      console.error('Failed to generate friend comment:', err);
      if (loadingEl) {
        loadingEl.innerHTML = `<span class="text-rose-400 text-xs">Could not generate counsel: ${escapeHtml(err.message)}</span>`;
        setTimeout(() => loadingEl?.remove(), 4000);
      }
    }
  }

  function createPostCard(post, isMemory = false, isLast = false) {
    const card = document.createElement('article');
    card.className = 'thread-post-wrapper glass-inset p-4 sm:p-5 mb-4 relative';
    card.dataset.postId = post.id;

    const postDate = new Date(post.timestamp);
    const dateFormatted = postDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeFormatted = postDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    const relativeTime = formatRelativeTime(post.timestamp);

    let memoryBadge = '';
    if (isMemory) {
      const yearsAgo = new Date().getFullYear() - post.year;
      memoryBadge = `
        <div class="badge-amber mb-3">
          <i data-lucide="history" class="w-3 h-3"></i>
          <span>${yearsAgo} ${yearsAgo === 1 ? 'Year' : 'Years'} Ago Today (${post.year})</span>
        </div>
      `;
    }

    const editedTag = post.isEdited
      ? `<span class="text-[10px] text-stone-400 font-normal italic ml-1" title="Edited on ${post.editedAt ? new Date(post.editedAt).toLocaleString() : ''}">(edited)</span>`
      : '';

    let moodBadge = '';
    if (post.mood) {
      moodBadge = `
        <span class="btn-pill text-[11px] py-0 px-2 text-stone-300 ml-1.5 inline-block">
          ${escapeHtml(post.mood)}
        </span>
      `;
    }

    let locationBadge = '';
    if (post.location && post.location.trim()) {
      locationBadge = `
        <button type="button" class="badge-location text-[11px] py-0 px-2 ml-1.5" title="Filter feed by ${escapeHtml(post.location)}">
          <i data-lucide="map-pin" class="w-3 h-3 text-rose-400"></i>
          <span>${escapeHtml(post.location)}</span>
        </button>
      `;
    }

    const content = post.content || '';
    const isLong = content.length > 320;
    let bodyHtml = '';
    if (isLong) {
      const excerpt = escapeHtml(content.slice(0, 300));
      const full = escapeHtml(content);
      bodyHtml = `
        <div class="post-content text-stone-200 text-sm leading-relaxed whitespace-pre-wrap mt-1.5">
          <span class="content-excerpt">${excerpt}...</span>
          <span class="content-full hidden">${full}</span>
          <button type="button" class="btn-read-more text-amber-400 hover:text-amber-300 font-medium ml-1 text-xs">See more</button>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="post-content text-stone-200 text-sm leading-relaxed whitespace-pre-wrap mt-1.5">${escapeHtml(content)}</div>
      `;
    }

    const isLiked = state.likedPosts.has(post.id);

    // Comments list and Naseeha friend guide comment
    const commentsList = Array.isArray(post.comments) ? post.comments : [];
    const guideComment = commentsList.find(c => c.authorRole === 'Friend & Guide' || c.authorName === 'Naseeha');
    const userComments = commentsList.filter(c => c !== guideComment);

    let commentsHtml = '';
    if (guideComment) {
      commentsHtml += `
        <div class="friend-guide-comment relative">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs">
                🌿
              </div>
              <span class="font-semibold text-emerald-300 text-xs">Naseeha</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">Friend & Guide</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-stone-400">${formatRelativeTime(guideComment.timestamp)}</span>
              <button type="button" class="btn-refresh-guide-comment text-stone-400 hover:text-emerald-300 p-0.5 transition" title="Ask Naseeha for a refreshed perspective">
                <i data-lucide="rotate-cw" class="w-3 h-3"></i>
              </button>
            </div>
          </div>
          <div class="text-xs text-stone-200 leading-relaxed">${escapeHtml(guideComment.content)}</div>
        </div>
      `;
    } else {
      commentsHtml += `
        <div class="flex items-center justify-between flex-wrap gap-2 py-0.5">
          <button type="button" class="btn-request-guide-comment btn-pill text-xs py-1 px-3 flex items-center gap-1.5 text-emerald-300 bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-500/30 transition">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-400"></i>
            <span>Ask Naseeha to comment as a friend</span>
          </button>
          <span class="text-[11px] text-stone-500">Get gentle guidance on this entry</span>
        </div>
      `;
    }

    for (const uc of userComments) {
      commentsHtml += `
        <div class="friend-comment-bubble flex items-start gap-2">
          ${getAvatarHtml(uc.authorAvatarImage, uc.authorAvatar || '🌙', uc.authorName || 'Alcove Resident', 'w-6 h-6', 'text-xs')}
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-stone-200 text-xs">${escapeHtml(uc.authorName || 'Alcove Resident')}</span>
              <span class="text-[10px] text-stone-500">${formatRelativeTime(uc.timestamp)}</span>
            </div>
            <div class="text-xs text-stone-300 mt-0.5 leading-relaxed">${escapeHtml(uc.content)}</div>
          </div>
        </div>
      `;
    }

    commentsHtml += `
      <div class="flex items-center gap-2 mt-2">
        <input type="text" class="post-comment-input flex-1 glass-inset px-3 py-1.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none" placeholder="Write a reply or thought on this post...">
        <button type="button" class="btn-submit-comment btn-post-primary text-xs py-1.5 px-3 font-medium">
          Reply
        </button>
      </div>
    `;

    card.innerHTML = `
      ${memoryBadge}
      ${!isLast ? '<div class="thread-line"></div>' : ''}

      <div class="flex items-start gap-3 relative z-10">
        ${getAvatarHtml(post.authorAvatarImage || state.profile.avatarImage, post.authorAvatar || state.profile.avatar || '🌙', post.authorName || state.profile.name || 'Alcove Resident', 'w-10 h-10', 'text-lg')}

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center flex-wrap">
              <span class="font-semibold text-stone-100 text-sm">${escapeHtml(state.profile.name || 'Alcove Resident')}</span>
              <span class="text-xs text-stone-500 ml-2 font-normal" title="${dateFormatted} at ${timeFormatted}">${relativeTime}</span>
              ${editedTag}
              ${moodBadge}
              ${locationBadge}
            </div>

            <div class="flex items-center gap-1">
              <button type="button" class="btn-edit-post p-1 text-stone-400 hover:text-amber-300 transition" title="Edit entry">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button type="button" class="btn-delete-post p-1 text-stone-500 hover:text-rose-400 transition" title="Delete entry">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <div class="post-body-container">
            ${bodyHtml}
          </div>

          <div class="media-container"></div>

          <div class="flex items-center gap-5 mt-3 pt-2 text-stone-400 border-t border-white/[0.04]">
            <button type="button" class="action-icon-btn btn-like ${isLiked ? 'liked' : ''}" title="Like reflection">
              <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}"></i>
              <span class="text-xs">${isLiked ? '1' : ''}</span>
            </button>
            <button type="button" class="action-icon-btn reflect btn-reflect-post" title="Open 1-on-1 Messenger with this entry">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              <span class="text-xs">Chat with Naseeha</span>
            </button>
            <button type="button" class="action-icon-btn btn-sync-post" title="Drive Sync Status">
              <i data-lucide="repeat" class="w-4 h-4"></i>
              <span class="text-xs">${post.synced ? 'Synced' : 'Local'}</span>
            </button>
            <button type="button" class="action-icon-btn btn-vault-post" title="Private entry">
              <i data-lucide="lock" class="w-3.5 h-3.5 text-stone-500"></i>
            </button>
          </div>

          <!-- Post Comments & Friend Guidance -->
          <div class="post-comments-section post-comments-container space-y-2">
            ${commentsHtml}
          </div>

          <div class="flex items-center gap-1.5 mt-2.5 text-[11px] text-stone-500">
            <span>Encrypted locally in IndexedDB</span>
            <span>•</span>
            <span class="text-amber-500/80">Private</span>
          </div>
        </div>
      </div>
    `;

    function bindReadMore() {
      const readMoreBtn = card.querySelector('.btn-read-more');
      if (readMoreBtn) {
        readMoreBtn.addEventListener('click', () => {
          const excerpt = card.querySelector('.content-excerpt');
          const full = card.querySelector('.content-full');
          const isCollapsed = full.classList.contains('hidden');
          if (isCollapsed) {
            excerpt.classList.add('hidden');
            full.classList.remove('hidden');
            readMoreBtn.textContent = 'See less';
          } else {
            excerpt.classList.remove('hidden');
            full.classList.add('hidden');
            readMoreBtn.textContent = 'See more';
          }
        });
      }
    }
    bindReadMore();

    // Location badge filtering
    const locBadge = card.querySelector('.badge-location');
    if (locBadge && post.location) {
      locBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dom.feedSearchInput) {
          dom.feedSearchInput.value = post.location;
          state.feedSearchQuery = post.location;
          filterAndRenderFeed();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    // Post Editing
    const editBtn = card.querySelector('.btn-edit-post');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const bodyContainer = card.querySelector('.post-body-container');
        if (!bodyContainer || bodyContainer.querySelector('.post-inline-editor')) return;

        const currentContent = post.content || '';
        const currentMood = post.mood || '';
        const currentLocation = post.location || '';

        bodyContainer.innerHTML = `
          <div class="post-inline-editor">
            <textarea class="edit-post-textarea" rows="4" placeholder="Edit your reflection...">${escapeHtml(currentContent)}</textarea>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/[0.08]">
              <div class="flex items-center gap-1.5 glass-inset px-2.5 py-1 text-xs">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-400 flex-shrink-0"></i>
                <input type="text" class="edit-post-location bg-transparent text-stone-100 placeholder-stone-500 focus:outline-none w-full text-xs" placeholder="Add or edit location (e.g. London, UK)..." value="${escapeHtml(currentLocation)}">
              </div>
              <select class="edit-post-mood glass-inset px-2 py-1 text-xs text-stone-200 bg-stone-900 focus:outline-none">
                <option value="" ${!currentMood ? 'selected' : ''}>No Mood</option>
                <option value="🌙 Reflective" ${currentMood === '🌙 Reflective' ? 'selected' : ''}>🌙 Reflective</option>
                <option value="✨ Grateful" ${currentMood === '✨ Grateful' ? 'selected' : ''}>✨ Grateful</option>
                <option value="🌿 Peaceful" ${currentMood === '🌿 Peaceful' ? 'selected' : ''}>🌿 Peaceful</option>
                <option value="🕊️ Seeking Sabr" ${currentMood === '🕊️ Seeking Sabr' ? 'selected' : ''}>🕊️ Seeking Sabr</option>
                <option value="⚡ Stressed" ${currentMood === '⚡ Stressed' ? 'selected' : ''}>⚡ Stressed</option>
                <option value="🧭 Contemplative" ${currentMood === '🧭 Contemplative' ? 'selected' : ''}>🧭 Contemplative</option>
                <option value="🌧️ Heavy Heart" ${currentMood === '🌧️ Heavy Heart' ? 'selected' : ''}>🌧️ Heavy Heart</option>
                <option value="☀️ Optimistic" ${currentMood === '☀️ Optimistic' ? 'selected' : ''}>☀️ Optimistic</option>
              </select>
            </div>
            <div class="flex items-center justify-end gap-2 mt-2">
              <button type="button" class="btn-cancel-edit btn-pill text-xs py-1 px-3">Cancel</button>
              <button type="button" class="btn-save-edit btn-post-primary text-xs py-1 px-3.5">Save Changes</button>
            </div>
          </div>
        `;

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }

        const textarea = bodyContainer.querySelector('.edit-post-textarea');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        bodyContainer.querySelector('.btn-cancel-edit').addEventListener('click', () => {
          bodyContainer.innerHTML = bodyHtml;
          bindReadMore();
        });

        bodyContainer.querySelector('.btn-save-edit').addEventListener('click', async () => {
          const updatedContent = textarea.value.trim();
          const updatedMood = bodyContainer.querySelector('.edit-post-mood').value;
          const updatedLocation = (bodyContainer.querySelector('.edit-post-location')?.value || '').trim();

          post.content = updatedContent;
          post.mood = updatedMood;
          post.location = updatedLocation || null;
          post.isEdited = true;
          post.editedAt = new Date().toISOString();
          post.synced = 0;

          await window.DiaryDB.savePost(post);
          await refreshFeed();

          if (window.DriveSync && window.DriveSync.isAuthenticated()) {
            window.DriveSync.syncPosts().catch(err => console.warn('Sync error after post edit:', err));
          }
        });
      });
    }

    const likeBtn = card.querySelector('.btn-like');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => {
        if (state.likedPosts.has(post.id)) {
          state.likedPosts.delete(post.id);
        } else {
          state.likedPosts.add(post.id);
        }
        filterAndRenderFeed();
      });
    }

    const reflectBtn = card.querySelector('.btn-reflect-post');
    if (reflectBtn) {
      reflectBtn.addEventListener('click', () => {
        openChatDrawer();
        const dateStr = postDate.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const prompt = `Here is a journal entry I wrote on ${dateStr}${post.mood ? ` feeling ${post.mood}` : ''}:\n\n"${post.content}"\n\nPlease offer gentle Islamic reflection, comfort, and practical wisdom for my situation.`;
        window.NaseehaChat.sendMessage(prompt, handleChatMessageAdded);
      });
    }

    const deleteBtn = card.querySelector('.btn-delete-post');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Delete this diary entry? This action cannot be undone.')) {
          await window.DiaryDB.deletePost(post.id);
          card.remove();
          await checkMemories();
          renderSidebarMemories();
          if (window.DriveSync && window.DriveSync.isAuthenticated()) {
            window.DriveSync.syncPosts().catch(e => console.warn('Sync error after post delete:', e));
          }
        }
      });
    }

    // Comment submission handler
    const commentInput = card.querySelector('.post-comment-input');
    const commentSubmitBtn = card.querySelector('.btn-submit-comment');

    const handleAddComment = async () => {
      if (!commentInput) return;
      const text = commentInput.value.trim();
      if (!text) return;

      const userComment = {
        id: 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        authorName: state.profile.name || 'Alcove Resident',
        authorAvatarImage: state.profile.avatarImage || null,
        authorAvatar: state.profile.avatar || '🌙',
        content: text,
        timestamp: new Date().toISOString()
      };

      post.comments = post.comments || [];
      post.comments.push(userComment);
      post.synced = 0;

      await window.DiaryDB.savePost(post);
      await refreshFeed();

      if (window.DriveSync && window.DriveSync.isAuthenticated()) {
        window.DriveSync.syncPosts().catch(err => console.warn('Sync after comment error:', err));
      }
    };

    commentSubmitBtn?.addEventListener('click', handleAddComment);
    commentInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAddComment();
      }
    });

    // Request & Refresh Naseeha friend guide comment
    card.querySelector('.btn-request-guide-comment')?.addEventListener('click', () => {
      generateAndAttachFriendComment(post.id, true);
    });
    card.querySelector('.btn-refresh-guide-comment')?.addEventListener('click', () => {
      generateAndAttachFriendComment(post.id, true);
    });

    const mediaContainer = card.querySelector('.media-container');
    renderPostMedia(mediaContainer, post);

    return card;
  }

  async function renderPostMedia(container, post) {
    if (!post.media || !Array.isArray(post.media) || post.media.length === 0) {
      return;
    }

    const images = [];
    const mediaPlayers = [];

    for (const item of post.media) {
      const isAud = window.MediaPlayer && window.MediaPlayer.isAudio(item);
      const isVid = window.MediaPlayer && window.MediaPlayer.isVideo(item);

      if (isAud || isVid) {
        mediaPlayers.push(item);
      } else {
        images.push(item);
      }
    }

    if (images.length > 0) {
      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'media-grid-container';

      const count = images.length;
      let gridClass = 'media-grid-1';
      if (count === 2) gridClass = 'media-grid-2';
      else if (count === 3) gridClass = 'media-grid-3';
      else if (count >= 4) gridClass = 'media-grid-4';

      gridWrapper.classList.add(gridClass);

      const resolvedUrls = await Promise.all(
        images.map(img => window.MediaPlayer.resolveMediaUrl(img))
      );

      const maxTiles = Math.min(count, 4);
      for (let i = 0; i < maxTiles; i++) {
        const tile = document.createElement('div');
        tile.className = `media-grid-tile grid-item-${i}`;

        const imgEl = document.createElement('img');
        imgEl.loading = 'lazy';
        imgEl.alt = images[i].name || 'Diary photo';
        imgEl.src = resolvedUrls[i] || '';

        tile.appendChild(imgEl);

        if (count > 4 && i === 3) {
          const overlay = document.createElement('div');
          overlay.className = 'media-grid-overlay';
          overlay.textContent = `+${count - 3}`;
          tile.appendChild(overlay);
        }

        tile.addEventListener('click', () => {
          openLightbox(resolvedUrls.filter(Boolean), i);
        });

        gridWrapper.appendChild(tile);
      }

      container.appendChild(gridWrapper);
    }

    if (mediaPlayers.length > 0) {
      const videoGrid = document.createElement('div');
      videoGrid.className = 'multi-video-grid ' + (mediaPlayers.length === 2 ? 'multi-video-grid-2' : '');

      for (let idx = 0; idx < mediaPlayers.length; idx++) {
        const playerItem = mediaPlayers[idx];
        const isVid = window.MediaPlayer && window.MediaPlayer.isVideo(playerItem);
        const playerWrapper = document.createElement('div');
        playerWrapper.className = 'rounded-xl overflow-hidden border border-white/10 bg-black/40';

        if (mediaPlayers.length > 1) {
          const header = document.createElement('div');
          header.className = 'px-3 py-1.5 bg-black/30 border-b border-white/[0.06] text-[11px] text-stone-400 flex items-center justify-between';
          header.innerHTML = `
            <span class="flex items-center gap-1.5 font-medium text-stone-300">
              <i data-lucide="${isVid ? 'video' : 'volume-2'}" class="w-3 h-3 text-amber-400"></i>
              <span>${isVid ? 'Video' : 'Audio'} ${idx + 1} of ${mediaPlayers.length}</span>
            </span>
            <span class="truncate max-w-[160px] text-stone-500">${escapeHtml(playerItem.name || '')}</span>
          `;
          playerWrapper.appendChild(header);
        }

        const mountPoint = document.createElement('div');
        playerWrapper.appendChild(mountPoint);
        videoGrid.appendChild(playerWrapper);
        await window.MediaPlayer.mount(mountPoint, playerItem);
      }

      container.appendChild(videoGrid);
    }
  }

  // Lightbox Operations
  function openLightbox(images, startIndex = 0) {
    if (!images || images.length === 0) return;
    state.lightbox.isOpen = true;
    state.lightbox.images = images;
    state.lightbox.currentIndex = startIndex;
    updateLightboxUI();
    dom.lightboxModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    state.lightbox.isOpen = false;
    dom.lightboxModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function updateLightboxUI() {
    const { images, currentIndex } = state.lightbox;
    if (images.length === 0) return;
    dom.lightboxImg.src = images[currentIndex];
    dom.lightboxCounter.textContent = `${currentIndex + 1} / ${images.length}`;
    dom.lightboxPrevBtn.classList.toggle('hidden', images.length <= 1);
    dom.lightboxNextBtn.classList.toggle('hidden', images.length <= 1);
  }

  function prevLightboxImage() {
    if (state.lightbox.images.length <= 1) return;
    state.lightbox.currentIndex = (state.lightbox.currentIndex - 1 + state.lightbox.images.length) % state.lightbox.images.length;
    updateLightboxUI();
  }

  function nextLightboxImage() {
    if (state.lightbox.images.length <= 1) return;
    state.lightbox.currentIndex = (state.lightbox.currentIndex + 1) % state.lightbox.images.length;
    updateLightboxUI();
  }

  // INLINE COMPOSER (Threads Style)
  function handleInlineFilesSelected(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
      state.selectedInlineFiles.push(file);
    }
    renderInlineFilePreviews();
    dom.inlineComposerFiles.value = '';
  }

  function createFileThumbnailCard(file, onRemove) {
    const isImage = file.type && file.type.startsWith('image/');
    const isVideo = file.type && file.type.startsWith('video/');
    const isAudio = file.type && file.type.startsWith('audio/');

    const card = document.createElement('div');
    card.className = 'composer-media-thumb group relative';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-thumb';
    removeBtn.title = 'Remove item';
    removeBtn.innerHTML = '<i data-lucide="x" class="w-3 h-3"></i>';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove();
    });

    if (isImage) {
      const url = URL.createObjectURL(file);
      card.innerHTML = `
        <img src="${url}" alt="${escapeHtml(file.name)}" loading="lazy">
        <span class="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-stone-300 text-center px-1 truncate pointer-events-none">${formatFileSize(file.size)}</span>
      `;
      card.appendChild(removeBtn);
    } else if (isVideo) {
      card.className += ' flex flex-col items-center justify-center p-1.5 text-center';
      card.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1">
          <i data-lucide="video" class="w-3.5 h-3.5"></i>
        </div>
        <span class="text-[9px] text-stone-200 truncate max-w-full font-medium pointer-events-none">${escapeHtml(file.name)}</span>
        <span class="text-[8px] text-stone-400 pointer-events-none">${formatFileSize(file.size)}</span>
      `;
      card.appendChild(removeBtn);
    } else {
      card.className += ' flex flex-col items-center justify-center p-1.5 text-center';
      card.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center mb-1">
          <i data-lucide="${isAudio ? 'volume-2' : 'file'}" class="w-3.5 h-3.5"></i>
        </div>
        <span class="text-[9px] text-stone-200 truncate max-w-full font-medium pointer-events-none">${escapeHtml(file.name)}</span>
        <span class="text-[8px] text-stone-400 pointer-events-none">${formatFileSize(file.size)}</span>
      `;
      card.appendChild(removeBtn);
    }

    return card;
  }

  function renderInlineFilePreviews() {
    if (!dom.inlineFilePreview) return;
    dom.inlineFilePreview.innerHTML = '';
    if (state.selectedInlineFiles.length === 0) return;

    const photosCount = state.selectedInlineFiles.filter(f => f.type && f.type.startsWith('image/')).length;
    const videosCount = state.selectedInlineFiles.filter(f => f.type && f.type.startsWith('video/')).length;
    const othersCount = state.selectedInlineFiles.length - photosCount - videosCount;

    const parts = [];
    if (photosCount) parts.push(`${photosCount} ${photosCount === 1 ? 'picture' : 'pictures'}`);
    if (videosCount) parts.push(`${videosCount} ${videosCount === 1 ? 'video' : 'videos'}`);
    if (othersCount) parts.push(`${othersCount} other`);

    const summary = document.createElement('div');
    summary.className = 'w-full flex items-center justify-between text-xs text-amber-300/90 pb-1.5 font-medium';
    summary.innerHTML = `
      <span class="flex items-center gap-1.5"><i data-lucide="paperclip" class="w-3.5 h-3.5 text-amber-400"></i> Attached: ${parts.join(', ')}</span>
      <button type="button" class="text-stone-400 hover:text-white underline text-[11px] font-normal">Clear all</button>
    `;
    summary.querySelector('button').addEventListener('click', () => {
      state.selectedInlineFiles = [];
      renderInlineFilePreviews();
    });
    dom.inlineFilePreview.appendChild(summary);

    const strip = document.createElement('div');
    strip.className = 'composer-media-strip';

    state.selectedInlineFiles.forEach((file, index) => {
      const card = createFileThumbnailCard(file, () => {
        state.selectedInlineFiles.splice(index, 1);
        renderInlineFilePreviews();
      });
      strip.appendChild(card);
    });

    dom.inlineFilePreview.appendChild(strip);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  async function submitInlinePost() {
    const content = dom.inlineComposerContent.value.trim();
    const mood = dom.inlineComposerMood.value;
    const location = (dom.inlineLocationInput?.value || '').trim();

    if (!content && state.selectedInlineFiles.length === 0) {
      alert('Please write a message or attach a file to post.');
      return;
    }

    dom.inlineSubmitBtn.disabled = true;
    dom.inlineSubmitBtn.textContent = 'Posting...';

    try {
      const mediaList = [];

      for (const file of state.selectedInlineFiles) {
        const mediaRecord = await window.DiaryDB.saveMediaBlob({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          blob: file
        });
        mediaList.push({
          id: mediaRecord.id,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          driveFileId: null,
          isExternal: false
        });
      }

      const newPost = {
        timestamp: new Date().toISOString(),
        mood,
        location: location || null,
        content,
        tags: [],
        media: mediaList,
        authorAvatarImage: state.profile.avatarImage || null,
        authorAvatar: state.profile.avatar || '🌙',
        authorName: state.profile.name || 'Alcove Resident'
      };

      await window.DiaryDB.savePost(newPost);

      dom.inlineComposerContent.value = '';
      dom.inlineComposerMood.value = '';
      if (dom.inlineLocationInput) {
        dom.inlineLocationInput.value = '';
      }
      if (dom.inlineLocationBar) {
        dom.inlineLocationBar.classList.add('hidden');
      }
      if (dom.inlineAddLocationBtnLabel) {
        dom.inlineAddLocationBtnLabel.textContent = 'Location';
      }
      dom.inlineAddLocationBtn?.classList.remove('text-rose-300');
      state.selectedInlineFiles = [];
      dom.inlineFilePreview.innerHTML = '';

      await refreshFeed();
      await checkMemories();

      // Automatically request friend's guide comment from Naseeha in the background
      generateAndAttachFriendComment(newPost.id).catch(e => console.warn('Auto guide comment error:', e));

      if (window.DriveSync && window.DriveSync.isAuthenticated()) {
        window.DriveSync.syncPosts().catch(err => console.warn('Drive posts sync error:', err));
      }
    } catch (err) {
      console.error('Error creating post:', err);
      alert('Failed to save entry: ' + err.message);
    } finally {
      dom.inlineSubmitBtn.disabled = false;
      dom.inlineSubmitBtn.textContent = 'Post';
    }
  }

  // ADVANCED COMPOSER MODAL
  function openComposer() {
    dom.composerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dom.composerDate.value = now.toISOString().slice(0, 16);

    dom.composerContent.value = dom.inlineComposerContent.value;
    dom.composerMood.value = dom.inlineComposerMood.value;
    if (dom.composerLocation && dom.inlineLocationInput) {
      dom.composerLocation.value = dom.inlineLocationInput.value;
    }
    dom.composerContent.focus();
  }

  function closeComposer() {
    dom.composerModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function handleComposerFilesSelected(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
      state.selectedComposerFiles.push(file);
    }
    renderComposerFilePreviews();
    dom.composerFiles.value = '';
  }

  function renderComposerFilePreviews() {
    if (!dom.composerFilePreview) return;
    dom.composerFilePreview.innerHTML = '';
    if (state.selectedComposerFiles.length === 0) return;

    const photosCount = state.selectedComposerFiles.filter(f => f.type && f.type.startsWith('image/')).length;
    const videosCount = state.selectedComposerFiles.filter(f => f.type && f.type.startsWith('video/')).length;
    const othersCount = state.selectedComposerFiles.length - photosCount - videosCount;

    const parts = [];
    if (photosCount) parts.push(`${photosCount} ${photosCount === 1 ? 'picture' : 'pictures'}`);
    if (videosCount) parts.push(`${videosCount} ${videosCount === 1 ? 'video' : 'videos'}`);
    if (othersCount) parts.push(`${othersCount} other`);

    const summary = document.createElement('div');
    summary.className = 'w-full flex items-center justify-between text-xs text-amber-300/90 pb-1.5 font-medium';
    summary.innerHTML = `
      <span class="flex items-center gap-1.5"><i data-lucide="paperclip" class="w-3.5 h-3.5 text-amber-400"></i> Attached: ${parts.join(', ')}</span>
      <button type="button" class="text-stone-400 hover:text-white underline text-[11px] font-normal">Clear all</button>
    `;
    summary.querySelector('button').addEventListener('click', () => {
      state.selectedComposerFiles = [];
      renderComposerFilePreviews();
    });
    dom.composerFilePreview.appendChild(summary);

    const strip = document.createElement('div');
    strip.className = 'composer-media-strip';

    state.selectedComposerFiles.forEach((file, index) => {
      const card = createFileThumbnailCard(file, () => {
        state.selectedComposerFiles.splice(index, 1);
        renderComposerFilePreviews();
      });
      strip.appendChild(card);
    });

    dom.composerFilePreview.appendChild(strip);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  async function submitAdvancedPost() {
    const content = dom.composerContent.value.trim();
    const mood = dom.composerMood.value;
    const location = (dom.composerLocation?.value || '').trim();
    const dateInput = dom.composerDate.value;
    const externalUrl = dom.composerExternalUrl.value.trim();

    if (!content && state.selectedComposerFiles.length === 0 && !externalUrl) {
      alert('Please enter some text or attach media to create a diary entry.');
      return;
    }

    dom.submitPostBtn.disabled = true;
    dom.submitPostBtn.textContent = 'Saving...';

    try {
      const mediaList = [];

      for (const file of state.selectedComposerFiles) {
        const mediaRecord = await window.DiaryDB.saveMediaBlob({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          blob: file
        });
        mediaList.push({
          id: mediaRecord.id,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          driveFileId: null,
          isExternal: false
        });
      }

      if (externalUrl) {
        let mime = 'video/mp4';
        if (/\.(mp3|m4a|wav|ogg)$/i.test(externalUrl)) {
          mime = 'audio/mp3';
        } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(externalUrl)) {
          mime = 'image/jpeg';
        }
        mediaList.push({
          id: 'ext_' + Date.now(),
          name: 'Web Media',
          mimeType: mime,
          size: 0,
          url: externalUrl,
          isExternal: true
        });
      }

      const timestamp = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();

      const newPost = {
        timestamp,
        mood,
        location: location || null,
        content,
        tags: [],
        media: mediaList,
        authorAvatarImage: state.profile.avatarImage || null,
        authorAvatar: state.profile.avatar || '🌙',
        authorName: state.profile.name || 'Alcove Resident'
      };

      await window.DiaryDB.savePost(newPost);

      closeComposer();
      dom.inlineComposerContent.value = '';
      dom.composerContent.value = '';
      if (dom.composerLocation) dom.composerLocation.value = '';
      if (dom.inlineLocationInput) dom.inlineLocationInput.value = '';
      if (dom.inlineLocationBar) dom.inlineLocationBar.classList.add('hidden');
      if (dom.inlineAddLocationBtnLabel) dom.inlineAddLocationBtnLabel.textContent = 'Location';
      dom.inlineAddLocationBtn?.classList.remove('text-rose-300');
      dom.composerExternalUrl.value = '';
      state.selectedComposerFiles = [];
      dom.composerFilePreview.innerHTML = '';

      await refreshFeed();
      await checkMemories();

      // Automatically request friend's guide comment from Naseeha in the background
      generateAndAttachFriendComment(newPost.id).catch(e => console.warn('Auto guide comment error:', e));

      if (window.DriveSync && window.DriveSync.isAuthenticated()) {
        window.DriveSync.syncPosts().catch(err => console.warn('Drive posts sync error:', err));
      }
    } catch (err) {
      console.error('Error creating post:', err);
      alert('Failed to save entry: ' + err.message);
    } finally {
      dom.submitPostBtn.disabled = false;
      dom.submitPostBtn.textContent = 'Save Entry';
    }
  }

  // VAULT MANAGEMENT
  async function refreshVault() {
    state.vaultFiles = await window.DiaryDB.getVaultFiles();
    renderVault();
  }

  function renderVault() {
    if (!dom.vaultTableBody) return;
    dom.vaultTableBody.innerHTML = '';

    if (state.vaultFiles.length === 0) {
      if (dom.vaultEmptyState) dom.vaultEmptyState.classList.remove('hidden');
      return;
    }

    if (dom.vaultEmptyState) dom.vaultEmptyState.classList.add('hidden');

    for (const file of state.vaultFiles) {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-white/[0.06] hover:bg-white/[0.03] text-sm transition';

      let icon = 'file-text';
      if (file.mimeType?.includes('pdf')) icon = 'file-text';
      else if (file.mimeType?.includes('zip') || file.mimeType?.includes('compressed')) icon = 'archive';
      else if (file.mimeType?.startsWith('image/')) icon = 'image';
      else if (file.mimeType?.startsWith('audio/')) icon = 'music';

      const dateStr = new Date(file.uploadedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      tr.innerHTML = `
        <td class="py-3 px-3 flex items-center gap-2.5">
          <i data-lucide="${icon}" class="w-4 h-4 text-amber-500 flex-shrink-0"></i>
          <span class="font-medium text-stone-200 truncate max-w-xs">${escapeHtml(file.name)}</span>
        </td>
        <td class="py-3 px-3 text-stone-400 text-xs">${formatFileSize(file.size)}</td>
        <td class="py-3 px-3 text-stone-400 text-xs">${dateStr}</td>
        <td class="py-3 px-3 text-xs">
          ${file.driveFileId ? '<span class="text-emerald-400 font-medium">Drive Synced</span>' : '<span class="text-stone-500">Local Only</span>'}
        </td>
        <td class="py-3 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button type="button" class="btn-vault-download p-1.5 rounded-full hover:bg-white/10 text-stone-300" title="Download">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="btn-vault-delete p-1.5 rounded-full hover:bg-white/10 text-stone-500 hover:text-rose-400" title="Delete">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-vault-download').addEventListener('click', async () => {
        let blob = file.blob;
        if (!blob && file.driveFileId && window.DriveSync && window.DriveSync.isAuthenticated()) {
          try {
            blob = await window.DriveSync.downloadFileBlob(file.driveFileId);
          } catch (e) {
            alert('Could not download file from Google Drive: ' + e.message);
            return;
          }
        }
        if (!blob) {
          alert('File content is not cached locally. Connect to Google Drive to download.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      tr.querySelector('.btn-vault-delete').addEventListener('click', async () => {
        if (confirm(`Delete "${file.name}" from your Private Vault?`)) {
          await window.DiaryDB.deleteVaultFile(file.id);
          if (file.driveFileId && window.DriveSync && window.DriveSync.isAuthenticated()) {
            window.DriveSync.deleteDriveFile(file.driveFileId).catch(e => console.warn(e));
          }
          await refreshVault();
        }
      });

      dom.vaultTableBody.appendChild(tr);
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  async function handleVaultFileUpload(files) {
    if (!files || files.length === 0) return;
    for (const file of files) {
      await window.DiaryDB.saveVaultFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        blob: file,
        driveFileId: null
      });
    }
    await refreshVault();

    if (window.DriveSync && window.DriveSync.isAuthenticated()) {
      window.DriveSync.syncVault().catch(err => console.warn('Vault sync error:', err));
    }
  }

  // NASEEHA CHAT DRAWER
  function openChatDrawer() {
    dom.chatDrawer.classList.add('open');
  }

  function closeChatDrawer() {
    dom.chatDrawer.classList.remove('open');
  }

  async function renderChatHistory() {
    if (!dom.chatMessagesContainer) return;
    dom.chatMessagesContainer.innerHTML = '';
    const messages = await window.DiaryDB.getChatHistory(100);

    if (messages.length === 0) {
      const welcome = {
        role: 'model',
        content: `Assalamu Alaykum. I am **Naseeha**, your private spiritual counsel and empathetic companion.\n\nI am here to offer grounded reflections, practical paths from Islamic wisdom, and gentle perspective for whatever you carry in your heart today. Feel free to speak candidly or ask for guidance on patience, family, and emotional balance.`
      };
      appendChatBubble(welcome);
      return;
    }

    for (const msg of messages) {
      appendChatBubble(msg);
    }
    scrollChatToBottom();
  }

  function appendChatBubble(msg) {
    const isUser = msg.role === 'user';
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-3`;

    const parsedContent = window.NaseehaChat ? window.NaseehaChat.formatMarkdown(msg.content) : escapeHtml(msg.content);

    const bubble = document.createElement('div');
    if (isUser) {
      bubble.className = 'max-w-[85%] rounded-2xl px-4 py-2.5 bg-stone-800 border border-white/10 text-stone-100 text-sm shadow-sm leading-relaxed';
      bubble.textContent = msg.content;
    } else {
      bubble.className = 'max-w-[90%] rounded-2xl px-4 py-3 bg-[#1e1a18]/90 text-stone-100 text-sm shadow-sm border border-white/[0.08] chat-markdown leading-relaxed';
      bubble.innerHTML = parsedContent;
    }

    const timePill = document.createElement('span');
    timePill.className = 'text-[11px] text-stone-500 mt-1 px-1';
    timePill.textContent = msg.timestamp ? formatRelativeTime(msg.timestamp) : '';

    bubbleWrapper.appendChild(bubble);
    bubbleWrapper.appendChild(timePill);
    dom.chatMessagesContainer.appendChild(bubbleWrapper);
  }

  function handleChatMessageAdded(msg, isTyping) {
    if (msg) {
      appendChatBubble(msg);
      scrollChatToBottom();
    }
    if (dom.typingIndicator) {
      dom.typingIndicator.classList.toggle('hidden', !isTyping);
      if (isTyping) {
        scrollChatToBottom();
      }
    }
  }

  function scrollChatToBottom() {
    if (dom.chatMessagesContainer) {
      dom.chatMessagesContainer.scrollTop = dom.chatMessagesContainer.scrollHeight;
    }
  }

  async function handleSendChat() {
    const text = dom.chatInput.value.trim();
    if (!text) return;
    dom.chatInput.value = '';

    try {
      await window.NaseehaChat.sendMessage(text, handleChatMessageAdded);
    } catch (err) {
      console.error(err);
    }
  }

  // SETTINGS MODAL
  function openSettings() {
    dom.settingsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    applyProfile();
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function closeSettings() {
    dom.settingsModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function saveSettings() {
    const clientId = dom.clientIdInput.value.trim();
    const geminiKey = dom.geminiKeyInput.value.trim();
    const name = dom.displayNameInput.value.trim() || 'Alcove Resident';
    const avatar = dom.avatarSelect.value || '🌙';

    state.googleClientId = clientId;
    state.geminiApiKey = geminiKey;
    state.profile = {
      name,
      avatar,
      avatarImage: state.profile.avatarImage || null,
      theme: state.profile.theme || 'crystal',
      colorMode: state.profile.colorMode || 'light'
    };

    await window.DiaryDB.saveSetting('google_client_id', clientId);
    await window.DiaryDB.saveSetting('gemini_api_key', geminiKey);
    await window.DiaryDB.saveSetting('profile', state.profile);

    if (window.NaseehaChat) {
      window.NaseehaChat.setApiKey(geminiKey);
    }

    applyProfile();

    if (clientId && window.DriveSync) {
      window.DriveSync.init(clientId, () => {
        updateSyncBadge('connected', 'Google Drive connected.');
      });
    }

    if (window.DriveSync && window.DriveSync.isAuthenticated()) {
      window.DriveSync.syncProfile().catch(e => console.warn('Drive profile sync error:', e));
    }

    closeSettings();
    await refreshFeed();
    alert('Settings saved successfully.');
  }

  // EVENT LISTENERS WIRE-UP
  function setupEventListeners() {
    // Navigation Tabs
    dom.navFeedBtn?.addEventListener('click', () => switchTab('feed'));
    dom.navNotesBtn?.addEventListener('click', () => switchTab('notes'));
    dom.navTasksBtn?.addEventListener('click', () => switchTab('tasks'));
    dom.navVaultBtn?.addEventListener('click', () => switchTab('vault'));
    dom.navMemoriesBtn?.addEventListener('click', () => switchTab('memories'));

    // Floating Glass Dock (Liquid Navigation)
    document.querySelectorAll('.floating-glass-dock .dock-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.dockTab) {
          switchTab(item.dataset.dockTab);
        } else if (item.dataset.dockAction === 'chat') {
          if (dom.chatDrawer && dom.chatDrawer.classList.contains('open')) {
            closeChatDrawer();
          } else {
            openChatDrawer();
          }
        } else if (item.dataset.dockAction === 'themes') {
          openSettings();
          setTimeout(() => {
            dom.themeCardsGrid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        }
      });
    });

    // Global Search
    dom.globalSearchInput?.addEventListener('input', handleSearchInput);
    dom.clearSearchBtn?.addEventListener('click', clearSearch);
    dom.exitSearchBtn?.addEventListener('click', clearSearch);

    // In-Feed Post Search & Timeline Filters
    dom.feedSearchInput?.addEventListener('input', (e) => {
      state.feedSearchQuery = e.target.value;
      filterAndRenderFeed();
    });

    dom.clearFeedSearchBtn?.addEventListener('click', () => {
      state.feedSearchQuery = '';
      if (dom.feedSearchInput) dom.feedSearchInput.value = '';
      filterAndRenderFeed();
    });

    dom.jumpToDateInput?.addEventListener('change', (e) => {
      state.feedDateFilter = e.target.value;
      filterAndRenderFeed();
    });

    dom.feedMoodFilterBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.feedMoodFilterBtns.forEach(b => b.classList.remove('bg-white/15', 'text-stone-100'));
        btn.classList.add('bg-white/15', 'text-stone-100');
        state.feedMoodFilter = btn.dataset.mood || 'all';
        filterAndRenderFeed();
      });
    });

    dom.resetFeedFilterBtn?.addEventListener('click', resetFeedFilters);

    // Search Category Filter Pills
    dom.searchFilterPills?.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.searchFilterPills.forEach(p => p.classList.remove('bg-white/15', 'text-stone-100'));
        pill.classList.add('bg-white/15', 'text-stone-100');
        state.searchCategory = pill.dataset.filter || 'all';
        renderSearchResults();
      });
    });

    // Notes
    dom.saveNoteBtn?.addEventListener('click', handleSaveNote);

    // Tasks
    dom.addTaskBtn?.addEventListener('click', handleAddTask);
    dom.taskFilterBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.taskFilterBtns.forEach(b => b.classList.remove('bg-white/15', 'text-stone-100'));
        btn.classList.add('bg-white/15', 'text-stone-100');
        state.taskFilter = btn.dataset.filter || 'all';
        renderTasks();
      });
    });

    // On This Day Banner shortcut
    dom.memoriesBanner?.addEventListener('click', () => switchTab('memories'));

    // Inline Composer (Threads Style)
    dom.inlineSubmitBtn?.addEventListener('click', submitInlinePost);
    dom.inlineAddPhotosBtn?.addEventListener('click', () => dom.inlineComposerPhotos?.click());
    dom.inlineAddVideosBtn?.addEventListener('click', () => dom.inlineComposerVideos?.click());
    dom.inlineComposerPhotos?.addEventListener('change', handleInlineFilesSelected);
    dom.inlineComposerVideos?.addEventListener('change', handleInlineFilesSelected);
    dom.inlineComposerFiles?.addEventListener('change', handleInlineFilesSelected);

    // Inline Location Controls
    dom.inlineAddLocationBtn?.addEventListener('click', () => {
      if (!dom.inlineLocationBar) return;
      const isHidden = dom.inlineLocationBar.classList.contains('hidden');
      if (isHidden) {
        dom.inlineLocationBar.classList.remove('hidden');
        dom.inlineLocationInput?.focus();
      } else {
        if (!dom.inlineLocationInput?.value.trim()) {
          dom.inlineLocationBar.classList.add('hidden');
        } else {
          dom.inlineLocationInput?.focus();
        }
      }
    });

    dom.inlineClearLocationBtn?.addEventListener('click', () => {
      if (dom.inlineLocationInput) dom.inlineLocationInput.value = '';
      if (dom.inlineLocationBar) dom.inlineLocationBar.classList.add('hidden');
      if (dom.inlineAddLocationBtnLabel) dom.inlineAddLocationBtnLabel.textContent = 'Location';
      dom.inlineAddLocationBtn?.classList.remove('text-rose-300');
    });

    dom.inlineLocationInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        dom.inlineAddLocationBtn?.classList.add('text-rose-300');
        if (dom.inlineAddLocationBtnLabel) {
          dom.inlineAddLocationBtnLabel.textContent = val.length > 14 ? val.slice(0, 14) + '...' : val;
        }
      } else {
        dom.inlineAddLocationBtn?.classList.remove('text-rose-300');
        if (dom.inlineAddLocationBtnLabel) dom.inlineAddLocationBtnLabel.textContent = 'Location';
      }
    });

    dom.inlineDetectLocationBtn?.addEventListener('click', async () => {
      if (!dom.inlineDetectLocationBtn) return;
      const origText = dom.inlineDetectLocationBtn.innerHTML;
      dom.inlineDetectLocationBtn.disabled = true;
      dom.inlineDetectLocationBtn.innerHTML = '<span class="inline-block animate-spin mr-1">⌛</span>Detecting...';
      try {
        const loc = await detectCurrentLocationName();
        if (dom.inlineLocationInput) {
          dom.inlineLocationInput.value = loc;
          dom.inlineLocationInput.dispatchEvent(new Event('input'));
        }
      } catch (err) {
        alert('Could not detect location: ' + (err.message || 'Permission denied'));
      } finally {
        dom.inlineDetectLocationBtn.disabled = false;
        dom.inlineDetectLocationBtn.innerHTML = origText;
      }
    });

    // Drag and Drop on Inline Composer Box
    if (dom.inlineComposerBox) {
      dom.inlineComposerBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.inlineComposerBox.classList.add('composer-dropzone-active');
      });
      dom.inlineComposerBox.addEventListener('dragleave', (e) => {
        if (!dom.inlineComposerBox.contains(e.relatedTarget)) {
          dom.inlineComposerBox.classList.remove('composer-dropzone-active');
        }
      });
      dom.inlineComposerBox.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.inlineComposerBox.classList.remove('composer-dropzone-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (const file of e.dataTransfer.files) {
            state.selectedInlineFiles.push(file);
          }
          renderInlineFilePreviews();
        }
      });
    }

    // Advanced Composer
    dom.composerTrigger?.addEventListener('click', openComposer);
    dom.closeComposerBtn?.addEventListener('click', closeComposer);
    dom.modalAddPhotosBtn?.addEventListener('click', () => dom.composerPhotos?.click());
    dom.modalAddVideosBtn?.addEventListener('click', () => dom.composerVideos?.click());
    dom.modalDetectLocationBtn?.addEventListener('click', async () => {
      if (!dom.modalDetectLocationBtn) return;
      const origText = dom.modalDetectLocationBtn.innerHTML;
      dom.modalDetectLocationBtn.disabled = true;
      dom.modalDetectLocationBtn.innerHTML = '<span class="inline-block animate-spin mr-1">⌛</span>Detecting...';
      try {
        const loc = await detectCurrentLocationName();
        if (dom.composerLocation) {
          dom.composerLocation.value = loc;
        }
      } catch (err) {
        alert('Could not detect location: ' + (err.message || 'Permission denied'));
      } finally {
        dom.modalDetectLocationBtn.disabled = false;
        dom.modalDetectLocationBtn.innerHTML = origText;
      }
    });
    dom.composerPhotos?.addEventListener('change', handleComposerFilesSelected);
    dom.composerVideos?.addEventListener('change', handleComposerFilesSelected);
    dom.composerFiles?.addEventListener('change', handleComposerFilesSelected);
    dom.submitPostBtn?.addEventListener('click', submitAdvancedPost);

    // Chat Drawer
    const handleToggleChat = () => {
      if (dom.chatDrawer.classList.contains('open')) {
        closeChatDrawer();
      } else {
        openChatDrawer();
      }
    };
    dom.toggleChatBtn?.addEventListener('click', handleToggleChat);
    dom.floatingMessengerBtn?.addEventListener('click', handleToggleChat);
    dom.closeChatBtn?.addEventListener('click', closeChatDrawer);
    dom.clearChatBtn?.addEventListener('click', async () => {
      if (confirm('Clear chat history with Naseeha?')) {
        await window.DiaryDB.clearChatHistory();
        await renderChatHistory();
      }
    });

    // Chat Input
    dom.sendChatBtn?.addEventListener('click', handleSendChat);
    dom.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChat();
      }
    });

    // Reflect on Journal
    dom.reflectJournalBtn?.addEventListener('click', () => {
      window.NaseehaChat.reflectOnLatestJournal(handleChatMessageAdded);
    });

    // Quick Action Chips
    dom.quickChips?.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt === '__reflect__') {
          window.NaseehaChat.reflectOnLatestJournal(handleChatMessageAdded);
        } else if (prompt) {
          window.NaseehaChat.sendMessage(prompt, handleChatMessageAdded);
        }
      });
    });

    // Vault Dropzone & Input
    dom.vaultDropzone?.addEventListener('click', () => dom.vaultFileInput.click());
    dom.vaultFileInput?.addEventListener('change', (e) => {
      handleVaultFileUpload(Array.from(e.target.files));
      dom.vaultFileInput.value = '';
    });

    dom.vaultDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.vaultDropzone.classList.add('border-amber-500', 'bg-amber-950/20');
    });
    dom.vaultDropzone?.addEventListener('dragleave', () => {
      dom.vaultDropzone.classList.remove('border-amber-500', 'bg-amber-950/20');
    });
    dom.vaultDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.vaultDropzone.classList.remove('border-amber-500', 'bg-amber-950/20');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleVaultFileUpload(Array.from(e.dataTransfer.files));
      }
    });

    // Lightbox Controls
    dom.lightboxCloseBtn?.addEventListener('click', closeLightbox);
    dom.lightboxPrevBtn?.addEventListener('click', prevLightboxImage);
    dom.lightboxNextBtn?.addEventListener('click', nextLightboxImage);
    dom.lightboxModal?.addEventListener('click', (e) => {
      if (e.target === dom.lightboxModal) closeLightbox();
    });

    // Settings Modal & Profile Picture Controls
    dom.settingsBtn?.addEventListener('click', openSettings);
    dom.quickThemeBtn?.addEventListener('click', () => {
      openSettings();
      setTimeout(() => {
        dom.themeCardsGrid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    });

    dom.modeSelectBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        applyTheme(state.profile.theme || 'acrylic', mode);
      });
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.profile.colorMode === 'system') {
          applyTheme(state.profile.theme || 'acrylic', 'system');
        }
      });
    }

    dom.closeSettingsBtn?.addEventListener('click', closeSettings);
    dom.saveSettingsBtn?.addEventListener('click', saveSettings);
    dom.userAvatarNav?.addEventListener('click', openSettings);

    dom.uploadProfilePicBtn?.addEventListener('click', () => dom.profilePicInput?.click());
    dom.avatarPreviewContainer?.addEventListener('click', () => dom.profilePicInput?.click());

    dom.profilePicInput?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const processedUrl = await processProfileImage(file);
        state.profile.avatarImage = processedUrl;
        applyProfile();
      } catch (err) {
        alert(err.message || 'Failed to process image');
      } finally {
        dom.profilePicInput.value = '';
      }
    });

    dom.removeProfilePicBtn?.addEventListener('click', () => {
      state.profile.avatarImage = null;
      applyProfile();
    });

    dom.avatarSelect?.addEventListener('change', (e) => {
      state.profile.avatar = e.target.value;
      if (!state.profile.avatarImage) {
        applyProfile();
      }
    });

    dom.connectDriveBtn?.addEventListener('click', () => {
      if (!state.googleClientId) {
        alert('Please enter your Google OAuth Client ID first.');
        return;
      }
      try {
        window.DriveSync.requestAuth(true);
      } catch (e) {
        alert(e.message);
      }
    });

    dom.disconnectDriveBtn?.addEventListener('click', () => {
      if (window.DriveSync) {
        window.DriveSync.disconnect();
      }
    });

    dom.manualSyncBtn?.addEventListener('click', async () => {
      if (!window.DriveSync || !window.DriveSync.isAuthenticated()) {
        alert('Please connect to Google Drive first.');
        return;
      }
      try {
        dom.manualSyncBtn.disabled = true;
        dom.manualSyncBtn.textContent = 'Syncing...';
        await window.DriveSync.syncAll();
        await refreshFeed();
        await refreshVault();
        await refreshNotes();
        await refreshTasks();
        alert('Sync completed successfully.');
      } catch (err) {
        alert('Sync failed: ' + err.message);
      } finally {
        dom.manualSyncBtn.disabled = false;
        dom.manualSyncBtn.textContent = 'Sync Now';
      }
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (state.lightbox.isOpen) closeLightbox();
        else if (state.currentTab === 'search') clearSearch();
        else if (!dom.composerModal.classList.contains('hidden')) closeComposer();
        else if (!dom.settingsModal.classList.contains('hidden')) closeSettings();
        else if (dom.chatDrawer.classList.contains('open')) closeChatDrawer();
      } else if (state.lightbox.isOpen) {
        if (e.key === 'ArrowLeft') prevLightboxImage();
        else if (e.key === 'ArrowRight') nextLightboxImage();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Boot on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
