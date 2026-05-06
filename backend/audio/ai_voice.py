import os
import asyncio
import edge_tts

# We will use a nice female voice for Aria
VOICE = "en-US-AriaNeural"

async def generate_ai_voice_async(text: str, output_path: str):
    """
    Generates TTS audio using edge-tts (100% Free, no API keys).
    """
    if not text.strip():
        return False
        
    try:
        communicate = edge_tts.Communicate(text, VOICE)
        await communicate.save(output_path)
        return True
    except Exception as e:
        print(f"Edge-TTS generation error: {e}")
        return False

