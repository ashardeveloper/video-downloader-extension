# Video Saver

Chrome extension and local FFmpeg helper for saving detected browser video streams as MP4.

Video Saver is a practical download workflow for course videos and selected social video pages. It detects MP4, HLS and DASH streams exposed to the browser, shows them in a simple Chrome extension popup, and saves the selected stream locally through a native FFmpeg helper.

## Case Study

### Problem

I was enrolled in a course, but because of studies and a busy schedule it was difficult to complete every lecture before the access deadline. Since the course access was going to expire, the practical option was to download the videos and continue learning later.

Chrome already has video downloader extensions, but the free versions often allow only a few downloads before adding a time limit, or they require a paid premium version for unlimited downloads. Instead of depending on those limits, I decided to build my own Chrome extension for downloading the videos I could already access in the browser.

### Solution

Video Saver focuses on a local, repeatable workflow:

1. Detect video streams while the user plays a video in Chrome.
2. Show the detected video in a popup with title, format and quality options.
3. Use a local native host to pass the selected stream to FFmpeg.
4. Save the result as an MP4 file in the user's Downloads folder.
5. Preserve useful filenames and avoid duplicate sidecar files.

### Engineering Focus

The project is structured like a real browser extension rather than a one-off script.

- Chrome MV3 service worker coordinates stream detection, state and native messaging.
- Content scripts read the current course/social video context without modifying the player.
- Site-specific detectors handle Wistia, Udemy, Facebook, Instagram and TikTok stream shapes.
- The native C# helper isolates filesystem access and FFmpeg execution from the extension.
- Tests simulate stream detection, social-media edge cases, title handling and helper version checks.

![Video Downloader Extension](docs/screenshot/video-downloader-extension.png)

## Project Highlights

- Chrome MV3 extension with local native messaging helper
- One-click MP4 downloads through FFmpeg
- Course video detection for the online course platform I originally built this extension for (don't want to mention their name)
- Course video detection for Udemy
- Social video detection for Facebook, Instagram and TikTok browser media streams
- Facebook and Instagram DASH audio/video pairing
- Active-video matching for Instagram and TikTok to reduce wrong preloaded-video downloads
- Filename handling based on the selected video or course lesson title
- Download progress shown as percentage
- Private duplicate tracking without `.source` files beside downloaded videos
- Local-only workflow with no external backend
- Test scripts for detector and worker behavior

## Tech Stack

- Chrome Extension Manifest V3
- JavaScript service worker and content scripts
- C# native messaging host
- FFmpeg for media download/remuxing
- PowerShell setup/build scripts
- Node.js test scripts

## Scope

This project is for downloading videos that are already available to the user in their own browser session.

It does not bypass DRM, paid-access systems, encryption, private authorization, or platform-specific protection. If a site only exposes protected media or a non-downloadable player source, the extension may show no downloadable item.

## Features

- Course video detection for the online course platform I originally built this extension for (don't want to mention their name)
- Course video detection for Udemy
- Detect MP4, HLS and DASH streams exposed to the browser
- Detect Facebook video streams and pair separate audio/video DASH tracks
- Detect Instagram browser media streams and pair matching audio by asset id
- Detect TikTok browser media streams with active-video matching
- Ignore tiny init/partial MP4 responses that would produce broken 1 KB files
- Normalize byte-range URLs before download where needed
- Show download progress as a percentage
- Rename videos before download
- Open the output folder from the popup
- Track duplicate downloads privately in local app data

## Local Setup

### 1. Install FFmpeg

Install FFmpeg and confirm it is available from PowerShell:

```powershell
ffmpeg -version
```

### 2. Load The Extension

Open Chrome:

```text
chrome://extensions
```

Then:

1. Enable Developer mode.
2. Click `Load unpacked`.
3. Select the `extension` folder from this repository.

### 3. Register The Native Helper

From the repository root, run:

```powershell
.\SETUP.cmd
```

This builds/registers the local native messaging helper for the current extension ID.

### 4. Download A Video

1. Open a supported video page.
2. Refresh the page after installing/updating the extension.
3. Play the target video for a few seconds.
4. Open the Video Saver extension popup.
5. Select the detected format/quality.
6. Click `Download`.

Videos are saved to:

```text
Downloads / Lecture Videos
```

## Build

Build the native host manually:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1
```

## Verification

Run the local verification suite:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test.ps1
```

This runs:

```text
JavaScript syntax checks
Udemy detector tests
Social detector tests
Worker/helper compatibility tests
Title handling tests
C# native host compile check
```

## Project Structure

```text
extension/       Chrome extension source
native-host/     C# native messaging host
scripts/         Build and test scripts
tests/           Local detector and worker simulations
SETUP.cmd        One-click Windows setup entry point
```

## Limitations

- DRM-protected streams are not supported.
- Some social platforms preload multiple videos; the extension tries to match the active visible video, but platform behavior can change.
- Social media support depends on normal browser media streams being exposed.
- The helper currently targets Windows because it uses PowerShell setup and a Windows native messaging registration path.
