param(
  [string]$ServerRepoPath = (Join-Path (Join-Path $PSScriptRoot "..") "..\DicomVisionServer"),
  [string]$ServerOutputRoot,
  [string]$BundleName = "DicomVisionServer"
)

$ErrorActionPreference = "Stop"

$clientRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedServerRepoPath = Resolve-Path $ServerRepoPath -ErrorAction Stop
$serverBuildScript = Join-Path $resolvedServerRepoPath "scripts\build-desktop-bundle.ps1"

if (!(Test-Path $serverBuildScript)) {
  throw "Server build script not found: $serverBuildScript"
}

$resolvedServerOutputRoot =
  if ([string]::IsNullOrWhiteSpace($ServerOutputRoot)) {
    Join-Path $resolvedServerRepoPath "dist"
  }
  else {
    [System.IO.Path]::GetFullPath($ServerOutputRoot)
  }

$serverBundlePath = Join-Path $resolvedServerOutputRoot $BundleName

Push-Location $clientRoot
try {
  & powershell -ExecutionPolicy Bypass -File $serverBuildScript `
    -OutputRoot $resolvedServerOutputRoot `
    -BundleName $BundleName

  if ($LASTEXITCODE -ne 0) {
    throw "Server bundle build failed with exit code $LASTEXITCODE"
  }

  if (!(Test-Path (Join-Path $serverBundlePath "$BundleName.exe"))) {
    throw "Built server bundle is missing expected executable: $(Join-Path $serverBundlePath "$BundleName.exe")"
  }

  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "package-win.ps1") -ServerBundlePath $serverBundlePath

  if ($LASTEXITCODE -ne 0) {
    throw "Windows installer packaging failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}
