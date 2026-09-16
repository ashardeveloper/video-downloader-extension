$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node --check extension/worker.js
  node --check extension/udemy-detector.js
  node --check extension/social-detector.js
  node --check extension/social-active-video.js
  node --check extension/popup.js
  node tests/test-udemy.js
  node tests/test-social.js
  node tests/v400-test-v307.js
  node tests/v400-test-title-v307.js
  Add-Type -Path native-host/Host.cs -ReferencedAssemblies System.Web.Extensions
  Write-Host 'All tests passed.'
} finally {
  Pop-Location
}
