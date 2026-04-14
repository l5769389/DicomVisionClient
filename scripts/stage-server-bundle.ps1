param(
  [string]$BundlePath = $env:DICOM_VISION_SERVER_BUNDLE_PATH
)

$ErrorActionPreference = "Stop"

function Resolve-ServerBundlePath([string]$CandidatePath) {
  if ([string]::IsNullOrWhiteSpace($CandidatePath)) {
    throw "Server bundle path is required. Pass -BundlePath or set DICOM_VISION_SERVER_BUNDLE_PATH."
  }

  $resolvedPath = Resolve-Path $CandidatePath -ErrorAction Stop
  $item = Get-Item -LiteralPath $resolvedPath

  if ($item.PSIsContainer) {
    $directExecutable = Join-Path $item.FullName "DicomVisionServer.exe"
    if (Test-Path $directExecutable) {
      return $item.FullName
    }

    $nestedBundle = Join-Path $item.FullName "DicomVisionServer"
    $nestedExecutable = Join-Path $nestedBundle "DicomVisionServer.exe"
    if (Test-Path $nestedExecutable) {
      return $nestedBundle
    }
  }

  throw "Server bundle directory is invalid: $($item.FullName). Expected a folder containing DicomVisionServer.exe."
}

$clientRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$stagingRoot = Join-Path $clientRoot "dist-server"
$targetBundlePath = Join-Path $stagingRoot "DicomVisionServer"
$sourceBundlePath = Resolve-ServerBundlePath $BundlePath

if (Test-Path $targetBundlePath) {
  Remove-Item -LiteralPath $targetBundlePath -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
Copy-Item -LiteralPath $sourceBundlePath -Destination $targetBundlePath -Recurse

Write-Output "Staged server bundle: $sourceBundlePath -> $targetBundlePath"
