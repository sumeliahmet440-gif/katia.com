# Katia AI v3 (LekoStudio)

## GitHub + Render
1. Tüm dosyaları reponun köküne yükle (server.js ve index.html aynı klasörde).
2. Render > New > Web Service > repoyu seç. Build: `npm install` · Start: `node server.js`
3. Environment: `GROQ_API_KEY` = senin Groq anahtarın (https://console.groq.com/keys). Anahtar sadece sunucuda durur, sayfa koduna girmez.
4. Katia, Ayaz ve Horror modları bu anahtarı otomatik kullanır. Diğer modlar için Ayarlar > API Anahtarları (Xiaomi MiMo dahil).

## APK (Capacitor)
- `config.js` içine Render adresini yaz: `window.KATIA_SERVER='https://katia-al-byww.onrender.com';`
- `mkdir www && cp index.html app.css extras.css app.js extras.js config.js sw.js manifest.json icon* reklam*.jpg www/`
- `npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor-community/speech-recognition @capacitor/browser`
- Android izinleri: INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, CAMERA, ACCESS_FINE_LOCATION
- iOS Info.plist: NSMicrophoneUsageDescription, NSSpeechRecognitionUsageDescription, NSCameraUsageDescription, NSLocationWhenInUseUsageDescription
- Sunucuda `ALLOWED_ORIGINS` gerekmez; `https://localhost` ve `capacitor://localhost` zaten tanımlı.

## Mikrofon
Capacitor eklentisi varsa onu, iOS Safari ve WebView'de MediaRecorder + sunucu (Whisper), masaüstü/Android Chrome'da tarayıcının ses tanımasını kullanır.
