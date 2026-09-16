$ErrorActionPreference = 'Stop'
try {
  $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\extension\manifest.json') -Raw | ConvertFrom-Json
  $localExe = Join-Path $PSScriptRoot 'LectureHost.exe'
  if(!(Test-Path -LiteralPath $localExe)) {
    Add-Type -Path (Join-Path $PSScriptRoot 'Host.cs') -ReferencedAssemblies System.Web.Extensions -OutputAssembly $localExe -OutputType ConsoleApplication
  }
  $digest = [Security.Cryptography.SHA256]::Create().ComputeHash([Convert]::FromBase64String($manifest.key))
  $extensionId = -join ($digest[0..15] | ForEach-Object { [char](97 + ($_ -shr 4)); [char](97 + ($_ -band 15)) })
  $installFolder = Join-Path $env:LOCALAPPDATA 'LectureSaver\Helper'
  New-Item -ItemType Directory -Force -Path $installFolder | Out-Null
  $installedExe = Join-Path $installFolder 'LectureHost.exe'
  Copy-Item -LiteralPath $localExe -Destination $installedExe -Force
  $hostManifest = Join-Path $installFolder 'com.lecture_saver.host.json'
  $config = @{name='com.lecture_saver.host'; description='Video Saver FFmpeg helper'; path=$installedExe; type='stdio'; allowed_origins=@("chrome-extension://$extensionId/")}
  [IO.File]::WriteAllText($hostManifest, ($config | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
  $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Software\Google\Chrome\NativeMessagingHosts\com.lecture_saver.host')
  $key.SetValue('', $hostManifest); $key.Close()
  Write-Host 'Downloader 4.0.8 installed. Enable/reload Video Saver and refresh your video tabs.' -ForegroundColor Green
  Write-Host ('Installed helper: ' + $installedExe)
  Write-Host 'Keep your unpacked extension folder in place.'
} catch {
  Write-Host 'Setup failed. Finish downloads, disable Lecture Saver, then run SETUP.cmd again.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
}
Read-Host 'Press Enter to close'
