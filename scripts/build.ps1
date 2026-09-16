$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$hostSource = Join-Path $root 'native-host\Host.cs'
$hostExe = Join-Path $root 'native-host\LectureHost.exe'
Add-Type -Path $hostSource -ReferencedAssemblies System.Web.Extensions -OutputAssembly $hostExe -OutputType ConsoleApplication
Write-Host "Built native host: $hostExe"
