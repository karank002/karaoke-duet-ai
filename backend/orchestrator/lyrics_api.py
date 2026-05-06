import requests
import re
from typing import List, Dict

def fetch_lyrics(song: str, artist: str) -> List[Dict]:
    """
    Fetches synchronized lyrics from LRCLIB and parses them.
    Assigns lines to User, AI, or Both alternatingly for a duet feel.
    """
    try:
        url = "https://lrclib.net/api/search"
        params = {"q": f"{song} {artist}"}
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        if not data or len(data) == 0:
            return generate_fallback_lyrics()
            
        first_track = data[0]
        synced_lyrics = first_track.get("syncedLyrics")
        
        if not synced_lyrics:
            return generate_fallback_lyrics()
            
        return parse_lrc(synced_lyrics)
    except Exception as e:
        print(f"Error fetching lyrics from LRCLIB: {e}")
        return generate_fallback_lyrics()

def parse_lrc(lrc_text: str) -> List[Dict]:
    lines = lrc_text.strip().split('\n')
    parsed_parts = []
    
    # Regex to match [mm:ss.xx]
    time_pattern = re.compile(r'\[(\d{2}):(\d{2}\.\d{2})\]')
    
    current_time_sec = 0.0
    
    speakers = ["AI", "User", "Both"]
    speaker_idx = 0
    
    for i, line in enumerate(lines):
        match = time_pattern.search(line)
        if not match:
            continue
            
        minutes = int(match.group(1))
        seconds = float(match.group(2))
        time_sec = minutes * 60 + seconds
        
        text = time_pattern.sub('', line).strip()
        if not text:
            continue
            
        # Determine duration by looking at next line's time
        duration = 3.0 # Default fallback duration
        if i + 1 < len(lines):
            next_match = time_pattern.search(lines[i+1])
            if next_match:
                next_min = int(next_match.group(1))
                next_sec = float(next_match.group(2))
                next_time_sec = next_min * 60 + next_sec
                duration = max(1.0, next_time_sec - time_sec)
        
        # Determine speaker
        speaker = speakers[speaker_idx % len(speakers)]
        speaker_idx += 1
        
        parsed_parts.append({
            "speaker": speaker,
            "text": text,
            "duration": duration,
            "start_time": time_sec
        })
        
    return parsed_parts

def generate_fallback_lyrics() -> List[Dict]:
    return [
        {"speaker": "AI", "text": "I couldn't find the lyrics for this song.", "duration": 4.0, "start_time": 0.0},
        {"speaker": "User", "text": "Let's try another one?", "duration": 4.0, "start_time": 4.0}
    ]

def fetch_song_preview(song: str, artist: str) -> str:
    """
    Fetches a 30-second audio preview URL from the iTunes Search API.
    """
    try:
        url = "https://itunes.apple.com/search"
        params = {
            "term": f"{song} {artist}",
            "media": "music",
            "limit": 1
        }
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        
        data = response.json()
        if data.get("resultCount", 0) > 0:
            return data["results"][0].get("previewUrl")
    except Exception as e:
        print(f"Error fetching song preview from iTunes: {e}")
        
    return None
