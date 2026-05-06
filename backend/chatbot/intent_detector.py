import re
import os
import json
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class IntentResult(BaseModel):
    intent: str
    confidence: float
    data: dict
    reply: Optional[str] = None

def detect_intent_llm(user_text: str, history: Optional[list] = None) -> Optional[IntentResult]:
    """
    Uses Groq LLM to detect intent and extract entities, with conversation context.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key == "your_groq_api_key_here":
        return None
        
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        
        system_prompt = """
        You are an expert intent detector and conversational partner for a Karaoke AI application.
        Extract the user's intent, relevant data, and provide a helpful, friendly response.
        
        Available Intents:
        1. choose_song: User wants to sing a specific song. Extract 'song' and 'artist'.
        2. feedback: User is asking for their performance score or feedback.
        3. change_style: User wants to change the musical style (e.g., rock, jazz, pop). Extract 'style'.
        4. start_duet: User is ready to begin singing.
        5. unknown: Any other message.
        
        Respond ONLY with a JSON object in this format:
        {
            "intent": "choose_song",
            "confidence": 0.95,
            "data": { "song": "Bohemian Rhapsody", "artist": "Queen" },
            "reply": "Excellent choice! Queen is legendary. I'm getting the lyrics ready for Bohemian Rhapsody."
        }
        
        Context is key! Use the provided conversation history to understand references like 'him' or 'that song'.
        """
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history (limit to last 5 messages for brevity)
        if history:
            for msg in history[-5:]:
                role = "user" if msg.get("role") == "user" else "assistant"
                messages.append({"role": role, "content": msg.get("content")})
        
        # Add current message
        messages.append({"role": "user", "content": user_text})
        
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"}
        )
        
        content = completion.choices[0].message.content
        res_data = json.loads(content)
        
        return IntentResult(
            intent=res_data.get("intent", "unknown"),
            confidence=res_data.get("confidence", 0.0),
            data=res_data.get("data", {}),
            reply=res_data.get("reply")
        )
    except Exception as e:
        print(f"LLM Intent Detection Error: {e}")
        return None

def detect_intent(user_text: str, history: Optional[list] = None) -> IntentResult:
    """
    Hybrid intent detector: LLM-powered with local Regex fallback.
    """
    # 1. Try LLM first for better NLP
    llm_res = detect_intent_llm(user_text, history)
    if llm_res:
        return llm_res
        
    # 2. Local Regex-based fallback
    text_lower = user_text.lower()
    
    # Choose Song Intent
    song_match = re.search(r'(?:sing|play|karaoke|song)\s+(.+?)(?:\s+by\s+(.+))?$', text_lower)
    if song_match:
        song = song_match.group(1).strip()
        artist = song_match.group(2).strip() if song_match.group(2) else ""
        if song.startswith("the song "):
            song = song.replace("the song ", "")
            
        return IntentResult(
            intent="choose_song",
            confidence=0.8,
            data={"song": song, "artist": artist}
        )
        
    # Feedback Intent
    if any(phrase in text_lower for phrase in ["how did i do", "my score", "feedback", "was i good"]):
        return IntentResult(
            intent="feedback",
            confidence=0.8,
            data={}
        )
        
    # Change Style Intent
    style_match = re.search(r'(?:style|genre) (?:to )?([a-z]+)', text_lower)
    if style_match:
        return IntentResult(
            intent="change_style",
            confidence=0.7,
            data={"style": style_match.group(1)}
        )
        
    # Start Duet Intent
    if any(word in text_lower for word in ["start", "duet", "begin", "ready"]):
        return IntentResult(
            intent="start_duet",
            confidence=0.7,
            data={}
        )
        
    return IntentResult(
        intent="unknown",
        confidence=1.0,
        data={}
    )

