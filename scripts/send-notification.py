#!/usr/bin/env python3
"""
Script per mandare notifiche di prova via Supabase
Uso: python3 scripts/send-notification.py
"""

import requests
import json
import os
from datetime import datetime

SUPABASE_URL = "https://ihhuagtiyqidlsvwgkkf.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloaHVhZ3RpeXFpZGxzdndna2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxNzc0NjUsImV4cCI6MjA1MTc1MzQ2NX0.y-FP9hjL_xB0H52tD0VKMKXpUW8gTfH8KnHJnW3PuZk"

def send_notification():
    """Manda una notifica di prova"""
    
    url = f"{SUPABASE_URL}/rest/v1/push_notifications"
    
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    
    data = {
        "title": "🔔 Test Notifica",
        "body": "Questa è una notifica di prova da Python!",
        "notification_type": "test",
        "target_all": True,
        "status": "pending"
    }
    
    try:
        print("📤 Mandando notifica...")
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code == 201:
            result = response.json()
            print("✅ Notifica mandato con successo!")
            print(f"🆔 ID: {result[0]['id']}")
            print(f"⏰ Creato: {result[0]['created_at']}")
        else:
            print(f"❌ Errore {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Errore: {str(e)}")

if __name__ == "__main__":
    send_notification()
