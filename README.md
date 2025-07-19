# Clubotel Scraper & Android App

## FastAPI Scraper (Docker)

### Build the Docker Image
```sh
docker build -t clubotel-scraper .
```

### Run the Scraper API in Docker
```sh
docker run --rm -p 8000:8000 clubotel-scraper
```
- The API will be available at: `http://localhost:8000/`
- Endpoints:
  - `/lowest_two_prices` — Download the latest CSV
  - `/lowest_two_prices_json` — Get the latest data as JSON

#### To persist output files to your host, add a volume:
```sh
docker run --rm -p 8000:8000 -v $(pwd):/app clubotel-scraper
```

---

## Android App (WSL Build)

### Prerequisites
- WSL (Ubuntu recommended)
- Java JDK 11: `sudo apt install openjdk-11-jdk -y`
- Android SDK (see below)

### 1. Install Android SDK (first time only)
```sh
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip
mv cmdline-tools latest
export ANDROID_HOME=$HOME/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
sdkmanager --sdk_root=$ANDROID_HOME --licenses
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### 2. Build the APK
```sh
cd /mnt/d/temp/clubotel_scraper/ClubotelAndroidApp
./gradlew assembleDebug
```
- The APK will be at: `app/build/outputs/apk/debug/app-debug.apk`

### 3. Install the APK on your device
```sh
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## Android App Usage
- Enter your FastAPI server's IP and port (e.g., `192.168.1.100:8000`)
- Tap "Run" to fetch and display the table from `/lowest_two_prices_json`

---

## Notes
- For production, use HTTPS and secure your endpoints.
- The Android app allows HTTP for development only (see `network_security_config.xml`).
- If you have issues, check your server logs, firewall, and network connectivity. 