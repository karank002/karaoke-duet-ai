# 🎤 Karaoke AI - Virtual Karaoke Partner

A cyber-futuristic karaoke application where you can sing along with an AI partner. The app features synchronized lyrics, pitch detection, and an AI duet partner powered by Groq and Edge-TTS.

## 🚀 Deployment Guide

This application consists of a **FastAPI** backend and a static **Vanilla JS** frontend. The best way to deploy it is using a platform that supports Python, such as **Render**, **Railway**, or **Heroku**.

### Option 1: Deploy to Render (Recommended)

1. **Push your code to GitHub**:
   - Create a new repository on GitHub.
   - Initialize git in your local folder: `git init`
   - Add files and commit: `git add . && git commit -m "Initial commit"`
   - Push to GitHub: `git remote add origin <your-repo-url> && git push -u origin main`

2. **Connect to Render**:
   - Log in to [Render.com](https://render.com).
   - Click **New +** and select **Web Service**.
   - Connect your GitHub repository.

3. **Configure Service**:
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

4. **Environment Variables**:
   - Go to the **Environment** tab and add:
     - `GROQ_API_KEY`: Your Groq API key.

---

## 🛠️ Local Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Variables**:
   - Create a `.env` file in the `backend/` directory.
   - Add your keys:
     ```env
     GROQ_API_KEY=your_key_here
     ```

3. **Run the App**:
   ```bash
   python backend/main.py
   ```
   *The app will be available at `http://localhost:8000`*

## ✨ Features
- **AI Duet Partner**: Sings alternating lines with you.
- **Pitch Detection**: Analyzes your singing accuracy in real-time.
- **Synchronized Lyrics**: Fetches real-time lyrics for almost any song.
- **Cyberpunk UI**: Glassmorphic design with neon accents.
