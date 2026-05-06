const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const karaokeSection = document.getElementById('karaoke-section');
const lyricsDisplay = document.getElementById('lyrics-display');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const turnIndicator = document.getElementById('turn-indicator');
const recordBtn = document.getElementById('record-btn');
const searchHistoryDropdown = document.getElementById('search-history-dropdown');
const saveSongBtn = document.getElementById('save-song-btn');
const favoritesBtn = document.getElementById('favorites-btn');
const savedSongsSidebar = document.getElementById('saved-songs-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const clearFavoritesBtn = document.getElementById('clear-favorites-btn');
const savedSongsList = document.getElementById('saved-songs-list');

// ── Web Audio Beat Engine ─────────────────────────────
let audioCtx = null;
let beatTimerId = null;
let currentStep = 0;
let beatVolume = 0.45;
let currentGenre = 'off';

const GENRE_CONFIG = {
    bass:       { bpm: 80  },
    rock:       { bpm: 120 },
    pop:        { bpm: 115 },
    jazz:       { bpm: 95  },
    electronic: { bpm: 130 },
    chill:      { bpm: 70  },
};

const PATTERNS = {
    bass:       { kick:[1,0,1,0,1,0,1,0], snare:[0,0,0,0,1,0,0,0], hihat:[0,0,0,0,0,0,0,0], bass:[1,0,0,1,0,0,1,0], bassFreqs:[55,0,0,55,0,0,73.4,0] },
    rock:       { kick:[1,0,0,0,1,0,0,0], snare:[0,0,1,0,0,0,1,0], hihat:[1,1,1,1,1,1,1,1], bass:[1,0,0,0,1,0,0,1], bassFreqs:[82.4,0,0,0,82.4,0,0,98] },
    pop:        { kick:[1,0,0,1,0,0,1,0], snare:[0,0,1,0,0,0,1,0], hihat:[1,0,1,0,1,0,1,0], bass:[1,0,1,0,0,1,0,0], bassFreqs:[110,0,110,0,0,130.8,0,0] },
    jazz:       { kick:[1,0,0,0,0,0,1,0], snare:[0,0,0,1,0,0,0,1], hihat:[1,0,1,1,0,1,1,0], bass:[1,0,0,1,0,1,0,0], bassFreqs:[65.4,0,0,73.4,0,82.4,0,0] },
    electronic: { kick:[1,0,1,0,1,0,1,0], snare:[0,0,0,1,0,0,0,1], hihat:[1,1,1,1,1,1,1,1], bass:[1,0,0,0,1,0,1,0], bassFreqs:[55,0,0,0,55,0,61.7,0] },
    chill:      { kick:[1,0,0,0,0,0,0,0], snare:[0,0,0,0,1,0,0,0], hihat:[1,0,0,1,0,0,1,0], bass:[1,0,0,0,0,0,1,0], bassFreqs:[65.4,0,0,0,0,0,82.4,0] },
};

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playKick(ctx, t) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(0.001, t + 0.35);
    g.gain.setValueAtTime(beatVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.35);
}

function playSnare(ctx, t) {
    const n = Math.floor(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(beatVolume * 0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.start(t); src.stop(t + 0.15);
}

function playHihat(ctx, t) {
    const n = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(beatVolume * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.start(t); src.stop(t + 0.05);
}

function playBassNote(ctx, t, freq, dur) {
    const osc = ctx.createOscillator();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 450;
    const g = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    osc.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(beatVolume * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.85);
    osc.start(t); osc.stop(t + dur);
}

function startBeat(genre) {
    stopBeat();
    currentGenre = genre;
    if (genre === 'off') return;
    const ctx = getAudioCtx();
    const bpm = GENRE_CONFIG[genre].bpm;
    const pattern = PATTERNS[genre];
    const stepDur = 60 / bpm / 2;
    currentStep = 0;
    function tick() {
        const now = ctx.currentTime;
        const s = currentStep % 8;
        if (pattern.kick[s])  playKick(ctx, now);
        if (pattern.snare[s]) playSnare(ctx, now);
        if (pattern.hihat[s]) playHihat(ctx, now);
        if (pattern.bass[s] && pattern.bassFreqs[s]) playBassNote(ctx, now, pattern.bassFreqs[s], stepDur);
        currentStep++;
        beatTimerId = setTimeout(tick, stepDur * 1000);
    }
    tick();
}

function stopBeat() {
    if (beatTimerId) { clearTimeout(beatTimerId); beatTimerId = null; }
    currentStep = 0;
}

let currentLyrics = [];
let currentLineIndex = 0;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let userTurnPending = false;
let scoreHistory = [];

// Toast Notification Logic
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i data-feather="${type === 'success' ? 'check-circle' : 'info'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    feather.replace();
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
}

// Search History Logic
const MAX_HISTORY = 10;
let savedSearchHistory = JSON.parse(localStorage.getItem('karaokeSearchHistory') || '[]');

function saveToHistory(text) {
    if (!text.trim()) return;
    savedSearchHistory = savedSearchHistory.filter(item => item.toLowerCase() !== text.toLowerCase());
    savedSearchHistory.unshift(text);
    if (savedSearchHistory.length > MAX_HISTORY) savedSearchHistory.pop();
    localStorage.setItem('karaokeSearchHistory', JSON.stringify(savedSearchHistory));
    renderSearchHistory();
}

function renderSearchHistory() {
    if (savedSearchHistory.length === 0) {
        searchHistoryDropdown.classList.remove('active');
        return;
    }
    
    let html = `
        <div class="search-history-header">
            <span>Recent Searches</span>
            <button class="clear-history-btn" onclick="clearSearchHistory()">Clear</button>
        </div>
    `;
    
    savedSearchHistory.forEach(item => {
        const safeItem = item.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `
            <div class="search-history-item" onclick="useHistoryItem('${safeItem}')">
                <i data-feather="clock"></i>
                <span>${item}</span>
            </div>
        `;
    });
    
    searchHistoryDropdown.innerHTML = html;
    feather.replace();
}

window.clearSearchHistory = function() {
    savedSearchHistory = [];
    localStorage.removeItem('karaokeSearchHistory');
    renderSearchHistory();
};

window.useHistoryItem = function(text) {
    chatInput.value = text;
    searchHistoryDropdown.classList.remove('active');
    sendMessage(text);
};

// Show history on input focus
chatInput.addEventListener('focus', () => {
    if (savedSearchHistory.length > 0) {
        renderSearchHistory();
        searchHistoryDropdown.classList.add('active');
    }
});

// Hide history when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-input-wrapper')) {
        searchHistoryDropdown.classList.remove('active');
    }
});

// Chat Logic
let conversationHistory = [];

async function sendMessage(text) {
    if (!text.trim()) return;

    saveToHistory(text);
    searchHistoryDropdown.classList.remove('active');

    // Add user message
    addChatMessage('user', text);
    chatInput.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: text,
                history: conversationHistory 
            })
        });
        
        const data = await response.json();
        addChatMessage('ai', data.reply);

        // Update history
        conversationHistory.push({ role: 'user', content: text });
        conversationHistory.push({ role: 'assistant', content: data.reply });
        
        // Keep history manageable
        if (conversationHistory.length > 20) conversationHistory.splice(0, 2);

        if (data.intent === 'choose_song') {
            loadSong(data.action_data.song, data.action_data.artist || 'Unknown');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        addChatMessage('ai', 'Oops, something went wrong connecting to the server.');
    }
}

function addChatMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    
    const icon = sender === 'ai' ? 'music' : 'user';
    
    msgDiv.innerHTML = `
        <div class="avatar"><i data-feather="${icon}"></i></div>
        <div class="bubble">${text}</div>
    `;
    
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    feather.replace();
}

sendBtn.addEventListener('click', () => sendMessage(chatInput.value));
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage(chatInput.value);
});

// Favorites & Sidebar Logic
favoritesBtn.addEventListener('click', () => {
    savedSongsSidebar.classList.add('open');
    favoritesBtn.classList.add('active');
    fetchSavedSongs();
});

closeSidebarBtn.addEventListener('click', () => {
    savedSongsSidebar.classList.remove('open');
    favoritesBtn.classList.remove('active');
});

clearFavoritesBtn.addEventListener('click', async () => {
    if (!confirm('Clear your entire playlist?')) return;
    try {
        const response = await fetch('/api/songs/clear', { method: 'DELETE' });
        const data = await response.json();
        if (data.status === 'success') {
            fetchSavedSongs();
            saveSongBtn.classList.remove('saved');
            showToast('Playlist cleared');
        }
    } catch (error) {
        console.error('Error clearing playlist:', error);
    }
});

saveSongBtn.addEventListener('click', async () => {
    const song = songTitle.textContent.trim();
    const artist = songArtist.textContent.trim();
    const isSaved = saveSongBtn.classList.contains('saved');
    const endpoint = isSaved ? '/api/songs/unsave' : '/api/songs/save';
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: Date.now().toString(),
                title: song,
                artist: artist,
                timestamp: Date.now() / 1000
            })
        });
        const data = await response.json();
        if (data.status === 'success' || data.status === 'already_saved') {
            if (isSaved) {
                saveSongBtn.classList.remove('saved');
                showToast('Removed from playlist');
            } else {
                saveSongBtn.classList.add('saved');
                showToast('Added to playlist!', 'success');
            }
            feather.replace();
            if (savedSongsSidebar.classList.contains('open')) fetchSavedSongs();
        } else {
            showToast(data.message || 'Error updating playlist', 'error');
        }
    } catch (error) {
        console.error('Error toggling song save state:', error);
    }
});

async function fetchSavedSongs() {
    try {
        const response = await fetch('/api/songs/saved');
        const songs = await response.json();
        renderSavedSongs(songs);
    } catch (error) {
        console.error('Error fetching saved songs:', error);
    }
}

function renderSavedSongs(songs) {
    if (songs.length === 0) {
        savedSongsList.innerHTML = `
            <div class="empty-state">
                <i data-feather="music"></i>
                <p>Your playlist is empty.</p>
            </div>
        `;
        feather.replace();
        return;
    }
    savedSongsList.innerHTML = '';
    songs.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'saved-song-item';
        item.innerHTML = `
            <div class="song-details" onclick="loadSong('${song.title.replace(/'/g, "\\'")}', '${song.artist.replace(/'/g, "\\'")}')">
                <div class="song-index">${index + 1}</div>
                <div class="song-meta">
                    <span class="title">${song.title}</span>
                    <span class="artist">${song.artist}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-item-play" onclick="loadSong('${song.title.replace(/'/g, "\\'")}', '${song.artist.replace(/'/g, "\\'")}')">
                    <i data-feather="play"></i>
                </button>
                <button class="btn-delete" onclick="event.stopPropagation(); deleteSavedSong('${song.id}')">
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        `;
        savedSongsList.appendChild(item);
    });
    feather.replace();
}

window.deleteSavedSong = async function(songId) {
    try {
        const response = await fetch(`/api/songs/saved/${songId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.status === 'success') {
            fetchSavedSongs();
            showToast('Song removed');
            saveSongBtn.classList.remove('saved');
        }
    } catch (error) {
        console.error('Error deleting song:', error);
    }
};// ── Beat Controls ──────────────────────────────────────
document.querySelectorAll('.tune-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tune-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const genre = btn.dataset.genre;
        startBeat(genre);
    });
});

document.getElementById('tune-volume').addEventListener('input', function() {
    beatVolume = parseFloat(this.value);
});

document.getElementById('mute-btn').addEventListener('click', function() {
    if (currentGenre === 'off') return;
    if (beatTimerId) {
        stopBeat();
        currentGenre = '__paused';
        this.innerHTML = '<i data-feather="volume-x"></i>';
    } else {
        const lastGenre = document.querySelector('.tune-btn.active')?.dataset.genre || 'rock';
        if (lastGenre !== 'off') startBeat(lastGenre);
        this.innerHTML = '<i data-feather="volume-2"></i>';
    }
    feather.replace();
});

// Karaoke Logic
window.loadSong = async function(song, artist) {
    try {
        const response = await fetch(`/api/song/lyrics?song=${encodeURIComponent(song)}&artist=${encodeURIComponent(artist)}`);
        const data = await response.json();
        
        songTitle.textContent = data.song;
        songArtist.textContent = data.artist;
        currentLyrics = data.parts;
        currentLineIndex = 0;
        scoreHistory = [];
        resetAccuracyPanel();
        
        renderLyrics();
        karaokeSection.classList.remove('hidden');

        // Update save button state
        if (data.is_saved) {
            saveSongBtn.classList.add('saved');
        } else {
            saveSongBtn.classList.remove('saved');
        }

        // Start the selected background beat if any
        const activeGenre = document.querySelector('.tune-btn.active')?.dataset.genre || 'off';
        if (activeGenre !== 'off') startBeat(activeGenre);

        // Start playing mock sequence after a delay
        setTimeout(() => {
            playNextLine();
        }, 2000);
    } catch (error) {
        console.error('Error loading song:', error);
    }
}

function renderLyrics() {
    lyricsDisplay.innerHTML = '';
    currentLyrics.forEach((line, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = `lyric-line speaker-${line.speaker}`;
        lineDiv.id = `lyric-${index}`;
        lineDiv.textContent = line.text;
        lyricsDisplay.appendChild(lineDiv);
    });
}

async function playNextLine() {
    if (currentLineIndex >= currentLyrics.length) {
        addChatMessage('ai', 'That was fun! Do you want to sing another one?');
        karaokeSection.classList.add('hidden');
        stopBeat();
        return;
    }

    const prevLine = document.getElementById(`lyric-${currentLineIndex - 1}`);
    if (prevLine) prevLine.classList.remove('active');

    const lineData = currentLyrics[currentLineIndex];
    const lineEl = document.getElementById(`lyric-${currentLineIndex}`);
    lineEl.classList.add('active');

    // Scroll lyrics
    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Update turn indicator
    updateTurnIndicator(lineData.speaker);

    if (lineData.speaker === 'AI') {
        // --- AI TURN: fetch TTS and play it ---
        recordBtn.disabled = true;
        recordBtn.innerHTML = '<i data-feather="music"></i> Karaoke AI is singing...';
        feather.replace();
        try {
            const res = await fetch(`/api/audio/tts?text=${encodeURIComponent(lineData.text)}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const ttsAudio = new Audio(url);
            ttsAudio.onended = () => {
                URL.revokeObjectURL(url);
                currentLineIndex++;
                playNextLine();
            };
            ttsAudio.onerror = () => {
                // Fallback: advance after duration if TTS fails
                setTimeout(() => { currentLineIndex++; playNextLine(); }, lineData.duration * 1000);
            };
            ttsAudio.play();
        } catch (e) {
            console.error('TTS fetch failed:', e);
            setTimeout(() => { currentLineIndex++; playNextLine(); }, lineData.duration * 1000);
        }
    } else {
        // --- USER TURN: enable mic, wait for them to record ---
        userTurnPending = true;
        recordBtn.disabled = false;
        recordBtn.innerHTML = '<i data-feather="mic"></i> Sing Your Part';
        feather.replace();
        // Pulse the button to draw attention
        recordBtn.classList.add('pulse');
    }
}

function updateTurnIndicator(speaker) {
    const badge = turnIndicator.querySelector('.badge');
    badge.className = `badge`;
    
    if (speaker === 'AI') {
        badge.classList.add('ai-turn');
        badge.textContent = "AI's Turn";
    } else if (speaker === 'User') {
        badge.classList.add('user-turn');
        badge.textContent = "Your Turn (Sing!)";
    } else {
        badge.classList.add('user-turn');
        badge.textContent = "Sing Together!";
    }
}

function updateAccuracyPanel(score, subScores = null) {
    score = parseFloat(score) || 0;
    scoreHistory.push(score);

    // --- Color & Grade ---
    let color, grade, rating;
    if (score >= 90) {
        color = '#00ff88'; grade = 'S'; rating = '🔥 Flawless!';
    } else if (score >= 80) {
        color = '#00d2ff'; grade = 'A'; rating = '⭐ Excellent!';
    } else if (score >= 70) {
        color = '#a78bfa'; grade = 'B'; rating = '👏 Great Job!';
    } else if (score >= 55) {
        color = '#f7c59f'; grade = 'C'; rating = '👍 Good Effort';
    } else {
        color = '#ff4d6d'; grade = 'D'; rating = '😅 Keep Trying!';
    }

    // --- Circular SVG Ring ---
    const ring = document.getElementById('ring-fill');
    const circumference = 2 * Math.PI * 42; // r=42
    ring.style.stroke = color;
    ring.style.filter = `drop-shadow(0 0 8px ${color})`;
    const offset = circumference - (score / 100) * circumference;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference; // reset
    requestAnimationFrame(() => {
        setTimeout(() => { ring.style.strokeDashoffset = offset; }, 50);
    });

    // --- Score number (count up animation) ---
    const valueEl = document.getElementById('accuracy-value');
    valueEl.style.color = color;
    let current = 0;
    const step = score / 30;
    const counter = setInterval(() => {
        current = Math.min(current + step, score);
        valueEl.textContent = Math.round(current);
        if (current >= score) clearInterval(counter);
    }, 30);

    // --- Grade badge ---
    const gradeBadge = document.getElementById('grade-badge');
    gradeBadge.textContent = grade;
    gradeBadge.style.background = `${color}22`;
    gradeBadge.style.borderColor = color;
    gradeBadge.style.color = color;
    gradeBadge.style.boxShadow = `0 0 12px ${color}66`;

    // --- Rating text ---
    document.getElementById('accuracy-rating').textContent = rating;

    // --- Running average ---
    const avg = scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length;
    const avgEl = document.getElementById('accuracy-avg');
    avgEl.textContent = `Session Avg: ${avg.toFixed(1)}%`;
    avgEl.style.color = color;

    // --- Sub-metrics: use real backend values if available ---
    const pitchScore   = subScores ? subScores.pitch   : Math.min(100, score + (Math.random() * 10 - 5));
    const timingScore  = subScores ? subScores.timing  : Math.min(100, score + (Math.random() * 14 - 7));
    const clarityScore = subScores ? subScores.clarity : Math.min(100, score + (Math.random() * 8 - 4));
    animateMetricBar('pitch-bar',   pitchScore,   color);
    animateMetricBar('timing-bar',  timingScore,  color);
    animateMetricBar('clarity-bar', clarityScore, color);

    // --- Score History bars ---
    const historyEl = document.getElementById('score-history');
    const bar = document.createElement('div');
    bar.className = 'score-bar';
    bar.style.setProperty('--bar-h', `${score}%`);
    bar.style.background = color;
    bar.style.boxShadow = `0 0 6px ${color}`;
    bar.title = `${score.toFixed(1)}%`;
    historyEl.appendChild(bar);
    historyEl.scrollLeft = historyEl.scrollWidth;
}

function animateMetricBar(id, value, color) {
    const el = document.getElementById(id);
    el.style.width = '0%';
    el.style.background = color;
    el.style.boxShadow = `0 0 6px ${color}`;
    requestAnimationFrame(() => {
        setTimeout(() => { el.style.width = `${Math.max(0, value)}%`; }, 80);
    });
}

function resetAccuracyPanel() {
    // Reset ring
    const ring = document.getElementById('ring-fill');
    const circumference = 2 * Math.PI * 42;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference;
    ring.style.stroke = 'rgba(255,255,255,0.1)';
    // Reset text
    document.getElementById('accuracy-value').textContent = '--';
    document.getElementById('accuracy-value').style.color = 'var(--text-secondary)';
    document.getElementById('accuracy-rating').textContent = 'Waiting for your voice...';
    document.getElementById('accuracy-avg').textContent = '';
    document.getElementById('grade-badge').textContent = '🎤 Sing!';
    document.getElementById('grade-badge').style.cssText = '';
    // Reset bars
    ['pitch-bar','timing-bar','clarity-bar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.width = '0%'; el.style.background = ''; }
    });
    document.getElementById('score-history').innerHTML = '';
}

// Audio Recording (Mock / Setup)
recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');
                
                try {
                    const res = await fetch('/api/audio/process', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    updateAccuracyPanel(data.pitch_score, data.sub_scores);
                } catch (err) {
                    console.error('Error uploading audio', err);
                }

                // If we were waiting for user to finish their turn, advance to next line
                if (userTurnPending) {
                    userTurnPending = false;
                    recordBtn.classList.remove('pulse');
                    recordBtn.disabled = true;
                    setTimeout(() => {
                        currentLineIndex++;
                        playNextLine();
                    }, 1200); // brief pause so user can see their score
                }
            };
            
            mediaRecorder.start();
            isRecording = true;
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '<i data-feather="mic-off"></i> Stop Recording';
            feather.replace();
            
        } catch (err) {
            console.error('Error accessing microphone', err);
            alert('Could not access microphone. Please allow permissions.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '<i data-feather="mic"></i> Sing Your Part';
        feather.replace();
    }
});

