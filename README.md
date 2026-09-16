# Video Saver

Chrome extension plus native FFmpeg helper for saving detected videos as MP4.

The extension detects supported MP4/HLS/DASH streams from course pages and selected social video pages, then asks the local native helper to download with FFmpeg.

## Supported Sites

- Apna College / Wistia course videos
- Udemy MP4, HLS and DASH streams when exposed to the browser
- Facebook videos with separate DASH video/audio track pairing
- Instagram and TikTok direct browser media streams where a matchable playable stream is exposed

Protected DRM streams, private streams that require platform-specific decryption, and videos that never expose a normal browser media URL are not supported.

## Install For Local Testing

1. Install FFmpeg and make sure `ffmpeg -version` works in PowerShell.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Load unpacked and select the `extension` folder.
5. Run `SETUP.cmd` once. It builds/registers the native host for the extension ID.
6. Refresh the target video page, play the video for a few seconds, then open Video Saver.

Downloaded videos are saved under `Downloads / Lecture Videos`.

## Build Native Host

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1
```

## Run Tests

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test.ps1
```

## Project Layout

- `extension/` - Chrome MV3 extension source.
- `native-host/` - C# native messaging host used to run FFmpeg.
- `scripts/` - Build and test scripts.
- `tests/` - Local simulation tests for detector and worker behavior.

## Notes

This project is intended for downloading videos that you are allowed to access and save. It does not bypass DRM or platform encryption.
