/**
 * player.js - Integrated audio and video player using Plyr.
 * Supports streaming from Google Drive blobs and direct web links.
 */

(function () {
  'use strict';

  const activePlayers = new Map();
  const activeObjectUrls = new Set();

  function trackUrl(url) {
    if (url && url.startsWith('blob:')) {
      activeObjectUrls.add(url);
    }
    return url;
  }

  function revokeAllUrls() {
    for (const url of activeObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore revocation errors
      }
    }
    activeObjectUrls.clear();
  }

  const MediaPlayer = {
    /**
     * Resolves a media item to a playable URL.
     * Looks up local IndexedDB cache, downloads from Drive if required,
     * or uses direct URL.
     */
    async resolveMediaUrl(mediaItem) {
      if (!mediaItem) return null;

      // 1. External direct link
      if (mediaItem.isExternal && mediaItem.url) {
        return mediaItem.url;
      }

      // 2. Local IndexedDB cache by ID
      if (mediaItem.id && window.DiaryDB) {
        const cached = await window.DiaryDB.getMediaBlob(mediaItem.id);
        if (cached && cached.blob) {
          const blobUrl = URL.createObjectURL(cached.blob);
          return trackUrl(blobUrl);
        }
      }

      // 3. Drive file download via OAuth access token
      if (mediaItem.driveFileId && window.DriveSync && window.DriveSync.isAuthenticated()) {
        try {
          const blob = await window.DriveSync.downloadFileBlob(mediaItem.driveFileId);
          // Cache locally in Dexie for fast offline replay
          if (window.DiaryDB && mediaItem.id) {
            await window.DiaryDB.saveMediaBlob({
              id: mediaItem.id,
              name: mediaItem.name,
              mimeType: mediaItem.mimeType,
              size: mediaItem.size,
              blob: blob,
              driveFileId: mediaItem.driveFileId
            });
          }
          const blobUrl = URL.createObjectURL(blob);
          return trackUrl(blobUrl);
        } catch (err) {
          console.error('Failed to stream Drive media file:', mediaItem.driveFileId, err);
          return null;
        }
      }

      // Fallback URL if present
      if (mediaItem.url) {
        return mediaItem.url;
      }

      return null;
    },

    /**
     * Determines whether a media item is audio or video.
     */
    isAudio(mediaItem) {
      const mime = (mediaItem.mimeType || '').toLowerCase();
      const name = (mediaItem.name || mediaItem.url || '').toLowerCase();
      return mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(name);
    },

    isVideo(mediaItem) {
      const mime = (mediaItem.mimeType || '').toLowerCase();
      const name = (mediaItem.name || mediaItem.url || '').toLowerCase();
      return mime.startsWith('video/') || /\.(mp4|webm|ogv|mov|mkv)$/i.test(name);
    },

    /**
     * Initialises a Plyr instance inside the target DOM element.
     */
    async mount(container, mediaItem, playerId = null) {
      if (!container || !mediaItem) return null;

      const id = playerId || 'player_' + Math.random().toString(36).substring(2, 9);

      // Clean up any existing player on this container
      if (activePlayers.has(id)) {
        this.destroy(id);
      }

      // Placeholder / loading state
      container.innerHTML = `
        <div class="flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 text-sm">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading media...
        </div>
      `;

      const src = await this.resolveMediaUrl(mediaItem);
      if (!src) {
        container.innerHTML = `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-800 dark:text-amber-200 text-xs">
            Media could not be loaded. Connect to Google Drive or verify link.
          </div>
        `;
        return null;
      }

      container.innerHTML = '';
      const isAud = this.isAudio(mediaItem);
      const mediaEl = document.createElement(isAud ? 'audio' : 'video');
      mediaEl.controls = true;
      mediaEl.playsInline = true;
      mediaEl.className = 'w-full rounded-lg overflow-hidden';
      mediaEl.src = src;

      container.appendChild(mediaEl);

      let plyrInstance = null;
      if (typeof Plyr !== 'undefined') {
        plyrInstance = new Plyr(mediaEl, {
          controls: isAud
            ? ['play', 'progress', 'current-time', 'duration', 'mute', 'volume']
            : ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
          ratio: isAud ? undefined : '16:9'
        });

        // Pause other active players when this player begins playback
        plyrInstance.on('play', () => {
          for (const [otherId, item] of activePlayers.entries()) {
            if (otherId !== id && item.plyr && typeof item.plyr.pause === 'function') {
              try { item.plyr.pause(); } catch (e) {}
            }
          }
        });
      }

      activePlayers.set(id, {
        plyr: plyrInstance,
        element: mediaEl,
        container: container,
        src: src
      });

      return plyrInstance;
    },

    destroy(id) {
      if (activePlayers.has(id)) {
        const item = activePlayers.get(id);
        if (item.plyr) {
          try {
            item.plyr.destroy();
          } catch (e) {
            // Plyr cleanup
          }
        }
        if (item.src && item.src.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(item.src);
            activeObjectUrls.delete(item.src);
          } catch (e) {
            // Ignore
          }
        }
        activePlayers.delete(id);
      }
    },

    destroyAll() {
      for (const [id, item] of activePlayers.entries()) {
        if (item.plyr) {
          try {
            item.plyr.destroy();
          } catch (e) {}
        }
      }
      activePlayers.clear();
      revokeAllUrls();
    }
  };

  window.MediaPlayer = MediaPlayer;
})();
