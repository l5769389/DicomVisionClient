param(
  [string]$Configuration = "Release",
  [ValidateSet("x64", "x86")]
  [string]$Platform = "x64"
)

$ErrorActionPreference = "Stop"

$clientRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourcePath = Join-Path $clientRoot "shell-extension\DicomVisionShellExtension.cs"
$outputDir = Join-Path $clientRoot "build\shell-extension"
$outputPath = Join-Path $outputDir "DicomVisionShellExtension.dll"
$frameworkDir =
  if ($Platform -eq "x64") {
    "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319"
  }
  else {
    "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319"
  }
$cscPath = Join-Path $frameworkDir "csc.exe"

if (!(Test-Path $sourcePath)) {
  throw "Shell extension source not found: $sourcePath"
}

if (!(Test-Path $cscPath)) {
  throw ".NET Framework C# compiler not found: $cscPath"
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

& $cscPath `
  /nologo `
  /target:library `
  "/platform:$Platform" `
  /optimize+ `
  "/out:$outputPath" `
  /reference:System.dll `
  /reference:System.Core.dll `
  /reference:System.Drawing.dll `
  /reference:System.Windows.Forms.dll `
  $sourcePath

if ($LASTEXITCODE -ne 0) {
  throw "Shell extension build failed with exit code $LASTEXITCODE"
}

if (!(Test-Path $outputPath)) {
  throw "Shell extension output was not created: $outputPath"
}

Write-Host "Built shell extension: $outputPath"
