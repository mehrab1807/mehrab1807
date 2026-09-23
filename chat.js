/**
 * chat.js - Naseeha (Sincere Counsel) Islamic Ethical Companion.
 * Connects directly to the Gemini API (gemini-2.5-flash) client-side.
 */

(function () {
  'use strict';

  const SYSTEM_PROMPT = `You are "Naseeha" (Sincere Counsel), an empathetic, grounded Islamic spiritual companion integrated into a personal private diary. The app language is English.

CORE PHILOSOPHY:
- Autonomy & Gentleness: You guide, suggest, and offer perspectives; you NEVER command, force, guilt-trip, or demand. True change comes from the user's sincere intention (Niyyah) and personal agency (Quran 88:21-22).
- Situational Empathy: Understand the user's specific context, emotional state, and constraints first. Tailor your reflections to where they currently are in life, not an idealized standard.
- Solution-Oriented Framework: Instead of telling the user "you must do this," outline 2 to 3 practical, gentle options rooted in Islamic wisdom (e.g., spiritual action, practical communication, mindset shift).
- Invitational Tone: Use phrases like "Depending on how you feel right now, here are a few gentle paths you might consider...", "One practical approach could be...", "Take whatever resonates with you and leave the rest."
- Grounding: Draw insights from the Quran, authentic Sunnah (Bukhari, Muslim), patience (Sabr), trust in Allah (Tawakkul), compassion (Rahmah), and moderation (Wasatiyyah). Provide the clear English translation alongside transliterated Arabic terms.
- Boundaries: You are NOT a Mufti. Never issue binding legal rulings (Fatwas) or take definitive stances on contentious Fiqh disputes. For severe emotional distress or danger, encourage professional mental health care alongside spiritual reminders.`;

  const MODEL_NAME = 'gemini-2.5-flash';
  let isSending = false;

  const NaseehaChat = {
    getApiKey() {
      const stored = localStorage.getItem('diary_gemini_api_key');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          return stored;
        }
      }
      return '';
    },

    setApiKey(key) {
      localStorage.setItem('diary_gemini_api_key', JSON.stringify(key.trim()));
    },

    async getRecentContext(windowSize = 8) {
      if (!window.DiaryDB) return [];
      const history = await window.DiaryDB.getChatHistory(windowSize);
      return history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    },

    async sendMessage(userText, onMessageAdded = null) {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error('Please configure your Gemini API Key in Settings to speak with Naseeha.');
      }

      if (isSending) {
        return;
      }

      const text = userText.trim();
      if (!text) return;

      isSending = true;

      // 1. Save user message locally
      const userMessage = {
        role: 'user',
        content: text,
        timestamp: new Date().toISOString()
      };
      await window.DiaryDB.saveChatMessage(userMessage);

      if (typeof onMessageAdded === 'function') {
        onMessageAdded(userMessage, true); // true = isTyping true for bot response
      }

      try {
        // 2. Build conversation context (last 6-8 messages)
        const contents = await this.getRecentContext(8);

        const requestBody = {
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        };

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || `API error ${response.status}: ${response.statusText}`;
          throw new Error(errMsg);
        }

        const data = await response.json();
        let replyText = '';
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts) {
          replyText = data.candidates[0].content.parts.map(p => p.text).join('\n').trim();
        }

        if (!replyText) {
          replyText = 'I am listening with care, though I was unable to formulate a response just now. Please feel free to share again.';
        }

        // 3. Save assistant reply
        const botMessage = {
          role: 'model',
          content: replyText,
          timestamp: new Date().toISOString()
        };
        await window.DiaryDB.saveChatMessage(botMessage);

        if (typeof onMessageAdded === 'function') {
          onMessageAdded(botMessage, false);
        }

        // Trigger background sync to Google Drive
        if (window.DriveSync && window.DriveSync.isAuthenticated()) {
          window.DriveSync.syncChat().catch(err => console.warn('Background chat sync error:', err));
        }

        return botMessage;
      } catch (err) {
        console.error('Naseeha chat error:', err);
        const errorBotMessage = {
          role: 'model',
          content: `*A gentle notice:* ${err.message}`,
          timestamp: new Date().toISOString()
        };
        if (typeof onMessageAdded === 'function') {
          onMessageAdded(errorBotMessage, false);
        }
        throw err;
      } finally {
        isSending = false;
      }
    },

    async reflectOnLatestJournal(onMessageAdded = null) {
      if (!window.DiaryDB) return;
      const posts = await window.DiaryDB.getAllPosts();
      if (!posts || posts.length === 0) {
        const notice = {
          role: 'model',
          content: 'You have not written any diary entries yet. When you compose your first entry, click here and I will gladly offer a gentle reflection.',
          timestamp: new Date().toISOString()
        };
        if (typeof onMessageAdded === 'function') {
          onMessageAdded(notice, false);
        }
        return;
      }

      const latest = posts[0];
      const dateStr = new Date(latest.timestamp).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const moodText = latest.mood ? ` feeling ${latest.mood}` : '';

      const prompt = `Here is my most recent personal journal entry from ${dateStr}${moodText}:\n\n"${latest.content}"\n\nPlease provide gentle Islamic perspective, comfort, and practical steps to reflect on what I experienced.`;

      await this.sendMessage(prompt, onMessageAdded);
    },

    async generateFriendPostComment(postContent, postMood = '', postLocation = '') {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error('Gemini API Key is not configured. Please add it in Settings.');
      }

      const moodClause = postMood ? ` (Mood: ${postMood})` : '';
      const locationClause = postLocation ? ` (Location: ${postLocation})` : '';
      const prompt = `Here is a journal entry written by my close friend${moodClause}${locationClause}:\n\n"${postContent}"\n\nPlease comment directly under their post as their supportive, loving, and wise friend and guide. Offer 2 to 4 sentences of warmth, validation, and a gentle reminder or actionable solace rooted in Islamic wisdom and everyday peace. Speak directly to them like a trusted companion.`;

      const requestBody = {
        system_instruction: {
          parts: [{
            text: 'You are Naseeha, commenting directly as a warm, affectionate, grounded, and wise Muslim friend and spiritual guide under your close friend\'s private journal post. Speak naturally and empathetically as a loving companion (for example: "Assalamu alaykum my dear friend...", "I hear how heavy that feels..."). Provide 2 to 4 sentences of genuine validation, gentle perspective, and uplifting solace or practical guidance rooted in Islamic wisdom and patience. Never sound like an automated lecture, bulleted list, or formal advisor; be a comforting, thoughtful presence.'
          }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 350
        }
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || `API error ${response.status}: ${response.statusText}`;
        throw new Error(errMsg);
      }

      const data = await response.json();
      let replyText = '';
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts) {
        replyText = data.candidates[0].content.parts.map(p => p.text).join('\n').trim();
      }

      return replyText || 'May Allah bless your heart with tranquility, ease your burdens, and grant you deep clarity in every step you take.';
    },

    formatMarkdown(text) {
      if (typeof marked !== 'undefined' && marked.parse) {
        try {
          return marked.parse(text, { breaks: true, gfm: true });
        } catch (e) {
          return text;
        }
      }
      return text.replace(/\n/g, '<br>');
    }
  };

  window.NaseehaChat = NaseehaChat;
})();
