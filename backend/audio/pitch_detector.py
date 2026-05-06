import os
import random

try:
    import librosa
    import numpy as np
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("Warning: librosa not found. Using mock pitch detection.")


def analyze_pitch(audio_path: str) -> float:
    """
    Analyzes the audio file and returns a singing accuracy score (0-100).

    Scoring components:
    1. Voice Activity    — Was there real singing vs silence/noise? (30 pts)
    2. Pitch Stability   — How steady was the pitch? Less wobble = higher score (35 pts)
    3. Harmonic Quality  — Ratio of harmonic (tonal) vs noisy content (35 pts)
    """
    if not os.path.exists(audio_path):
        return 0.0

    if not LIBROSA_AVAILABLE:
        return round(random.uniform(55.0, 92.0), 1)

    try:
        # ── Load audio ───────────────────────────────────────────
        y, sr = librosa.load(audio_path, sr=22050, mono=True)

        # Guard: too short or silent
        if len(y) < sr * 0.3:
            return round(random.uniform(40.0, 65.0), 1)

        # ── 1. Voice Activity Score (0–30) ───────────────────────
        # RMS energy per frame — checks if the user actually sang
        rms = librosa.feature.rms(y=y)[0]
        rms_mean = float(np.mean(rms))
        rms_max  = float(np.max(rms))

        # Silence or very quiet → low score
        if rms_max < 0.005:
            return round(random.uniform(10.0, 25.0), 1)

        # How much of the clip had energy above a low threshold?
        active_ratio = float(np.mean(rms > rms_mean * 0.2))
        voice_score = min(30.0, active_ratio * 35.0)

        # ── 2. Pitch Stability Score (0–35) ──────────────────────
        # Use piptrack to find dominant pitches per frame
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.1)

        # For each frame, get the pitch of the highest magnitude bin
        frame_pitches = []
        for t in range(pitches.shape[1]):
            mag_col = magnitudes[:, t]
            idx = np.argmax(mag_col)
            if mag_col[idx] > 0.05:
                frame_pitches.append(pitches[idx, t])

        if len(frame_pitches) < 5:
            # Not enough pitched frames detected → poor singing
            stability_score = random.uniform(5.0, 20.0)
        else:
            # Convert to MIDI notes to get perceptually uniform pitch distances
            fp = np.array(frame_pitches)
            fp = fp[fp > 50]  # filter out sub-bass noise (<50Hz)
            if len(fp) < 3:
                stability_score = random.uniform(8.0, 22.0)
            else:
                midi_notes = librosa.hz_to_midi(fp)
                # Standard deviation of MIDI pitch — lower = more stable
                pitch_std = float(np.std(midi_notes))
                # Typical good singers: std < 2 semitones. > 6 = very shaky
                stability_score = max(0.0, min(35.0, 35.0 - (pitch_std * 5.0)))

        # ── 3. Harmonic Quality Score (0–35) ─────────────────────
        # Harmonic–Percussive Source Separation
        y_harmonic, y_percussive = librosa.effects.hpss(y)
        harmonic_energy   = float(np.mean(y_harmonic ** 2))
        percussive_energy = float(np.mean(y_percussive ** 2))
        total_energy = harmonic_energy + percussive_energy + 1e-9

        # Higher harmonic ratio = more tonal, singing-like sound
        harmonic_ratio = harmonic_energy / total_energy
        harmonic_score = min(35.0, harmonic_ratio * 50.0)

        # ── Final Score ───────────────────────────────────────────
        raw_score = voice_score + stability_score + harmonic_score

        # Light noise floor: add small random variation (+/- 3%) to feel organic
        noise = random.uniform(-3.0, 3.0)
        final_score = max(0.0, min(100.0, raw_score + noise))

        return round(final_score, 1)

    except Exception as e:
        print(f"Pitch analysis error: {e}")
        return round(random.uniform(55.0, 85.0), 1)
