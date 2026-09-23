# Rukn: Private Journal, Tasks, Notes and Companion

A zero-installation, portable personal journal application built with a transparent frosted glass aesthetic, featuring an integrated task reminder manager, scratchpad notes, global full-text search across posts and files, and an empathetic, thoughtful personal companion named Sage.

All journal entries, tasks, notes, vault files, and conversation histories are stored entirely client-side within browser IndexedDB and synchronised directly with the user's personal Google Drive account. No external database, Node.js server, or cloud backend is used.

---

## Quick Start

### Windows
Double-click `start-win.bat`. The script opens `http://localhost:8000` in the default browser and runs a local server using Python or a built-in PowerShell fallback.

### macOS
Double-click `start-mac.command` (or run `bash start-mac.command` in Terminal). The script opens `http://localhost:8000` and starts a local Python server.

### Manual
Run any static file server from the project directory:
```bash
python -m http.server 8000
```
Open `http://localhost:8000` in any modern web browser.

---

## Configuration Guide

The application operates fully offline using IndexedDB. To enable cloud backup to Google Drive and activate the Sage companion, enter your credentials in the application Settings modal.

### 1. Google Account & Drive Backup
Google Drive synchronisation uses the official Google Identity Services library with the restricted scope `https://www.googleapis.com/auth/drive.file`, allowing the application access only to files it creates itself.

1. Navigate to the Google Cloud Console at `https://console.cloud.google.com/`.
2. Create a new project or select an existing one.
3. Open **APIs & Services** > **Enabled APIs & Services**, click **Enable APIs and Services**, search for **Google Drive API**, and enable it.
4. Open **APIs & Services** > **OAuth consent screen**:
   - Choose **External** user type and click **Create**.
   - Enter an application name, such as *Rukn*, and a support email.
   - On the **Test users** screen, add your personal Google email address.
5. Open **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Select **Web application** under Application type.
   - Under **Authorised JavaScript origins**, click **Add URI** and enter `http://localhost:8000` (and `https://mehrab1807.github.io`).
   - Click **Create**.
6. Copy the generated **Client ID**.
7. In Rukn, click **Sign in with Google** or the **Settings** gear icon in the top right, enter your Client ID once, and sign in.

### 2. Gemini API Key for Sage Companion
The Sage mindful companion connects directly from the browser to Google's `gemini-2.5-flash` model.

1. Visit Google AI Studio at `https://aistudio.google.com/app/apikey`.
2. Sign in with your Google account and click **Create API Key**.
3. Select your Google Cloud project and generate the key.
4. In Rukn, open the **Settings** modal, paste the key into the **Gemini API Key** field, and click **Save Settings**.

---

## Google Drive Storage Architecture

All data backed up to Google Drive is stored in an isolated root folder within your personal Drive:

- `/Rukn_Data/` (with automatic backward compatibility for existing `/Alcove_Data/` and `/PersonalDiaryApp_Data/` folders)
  - `manifest.json`: User profile settings and post date index.
  - `/posts/`: Yearly collections of entries, such as `posts_2026.json`.
  - `tasks.json`: Task checklist with due dates and completion states.
  - `notes.json`: Scratchpad notes and pinned memos.
  - `/media/`: Uploaded photos, audio files, and video clips.
  - `/vault/`: Confidential documents stashed via the Private Vault tab.
  - `chat_history.json`: Serialised chat transcripts between the user and Sage.

---

## Core Features

- **Global Full-Text Search:** Instant keyword search across diary posts, vault filenames, scratchpad notes, and tasks with live matching counts and keyword highlighting.
- **Task Reminders & Checklist:** Schedule tasks with specific due dates, priority tiers (Normal, High, Urgent), active overdue notification badges, and single-click completion.
- **Private Notes & Scratchpad:** Capture quick ideas, drafts, and reflections with colour tagging (Mocha, Amber, Sage, Indigo), pin-to-top controls, and clipboard copy.
- **Multi-Photo and Multi-Video Publishing:** Select or drop multiple pictures and multiple video clips into entries simultaneously, with dynamic photo collages and responsive video grids.
- **Profile Picture Personalisation:** Custom square photo upload with browser canvas downsampling, curated artwork presets, and automatic Google profile avatar population.
- **Transparent Frosted Glass Design:** See-through frosted acrylic surfaces, subtle background wood panelling diffusion, and ambient atmospheric lighting.
- **Inline Thread Composer:** Embedded directly at the top of the feed with attachment tags and backdating controls.
- **Connected Timeline Stream:** Posts linked by vertical thread lines with like counters, quick Sage reflection triggers, and sync badges.
- **Integrated Plyr Audio and Video:** Built-in responsive media player supporting audio tracks, video clips, and external streaming links with mutual playback pausing.
- **Memories ("On This Day"):** Automatically highlights journal entries written on the current day in earlier years.
- **Private Vault:** A local and cloud file locker for documents, PDFs, voice memos, and archives.
- **Sage Companion:** An empathetic, grounded personal friend and guide offering thoughtful validation, mindful reflection, and gentle perspective for journal entries.
