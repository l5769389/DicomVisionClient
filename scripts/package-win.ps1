param(
  [string]$ServerBundlePath = $env:DICOM_VISION_SERVER_BUNDLE_PATH
)

$ErrorActionPreference = "Stop"

$clientRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$stagedServerBundlePath = Join-Path $clientRoot "dist-server\\DicomVisionServer"

Push-Location $clientRoot
try {
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Client build failed with exit code $LASTEXITCODE"
  }

  if (![string]::IsNullOrWhiteSpace($ServerBundlePath)) {
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "stage-server-bundle.ps1") -BundlePath $ServerBundlePath
    if ($LASTEXITCODE -ne 0) {
      throw "Server bundle staging failed with exit code $LASTEXITCODE"
    }
  }

  if (!(Test-Path $stagedServerBundlePath)) {
    throw "Server bundle not found: $stagedServerBundlePath. Stage it first with scripts/stage-server-bundle.ps1 or set DICOM_VISION_SERVER_BUNDLE_PATH."
  }

  & npx electron-builder --win nsis
  if ($LASTEXITCODE -ne 0) {
    throw "electron-builder failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}
