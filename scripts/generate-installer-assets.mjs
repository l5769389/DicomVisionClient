import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const buildDir = resolve(rootDir, 'build')
const packageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf-8'))
const productName = packageJson.productName ?? 'DicomVision'

const powershellScript = String.raw`
param(
  [Parameter(Mandatory = $true)][string]$BuildDir,
  [Parameter(Mandatory = $true)][string]$ProductName
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-Color {
  param([string]$Hex, [int]$Alpha = 255)

  $value = $Hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb(
    $Alpha,
    [Convert]::ToInt32($value.Substring(0, 2), 16),
    [Convert]::ToInt32($value.Substring(2, 2), 16),
    [Convert]::ToInt32($value.Substring(4, 2), 16)
  )
}

function New-RoundedRectPath {
  param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Use-GraphicsQuality {
  param([System.Drawing.Graphics]$Graphics)

  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
}

function Fill-VerticalGradient {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Rectangle]$Rect,
    [System.Drawing.Color]$Top,
    [System.Drawing.Color]$Bottom
  )

  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $Rect,
    $Top,
    $Bottom,
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  try {
    $Graphics.FillRectangle($brush, $Rect)
  } finally {
    $brush.Dispose()
  }
}

function Draw-Grid {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height,
    [int]$Spacing,
    [System.Drawing.Color]$Color
  )

  $pen = [System.Drawing.Pen]::new($Color, 1)
  try {
    for ($x = 0; $x -lt $Width; $x += $Spacing) {
      $Graphics.DrawLine($pen, $x, 0, $x, $Height)
    }
    for ($y = 0; $y -lt $Height; $y += $Spacing) {
      $Graphics.DrawLine($pen, 0, $y, $Width, $y)
    }
  } finally {
    $pen.Dispose()
  }
}

function Draw-DvMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $path = New-RoundedRectPath $X $Y $Size $Size ($Size * 0.24)
  $bgRect = [System.Drawing.Rectangle]::new([int]$X, [int]$Y, [int]$Size, [int]$Size)
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bgRect,
    (New-Color "164E69"),
    (New-Color "07111B"),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $edgePen = [System.Drawing.Pen]::new((New-Color "FFFFFF" 30), [Math]::Max(1, $Size * 0.018))
  $arcPen = [System.Drawing.Pen]::new((New-Color "EAFBFF" 235), [Math]::Max(2, $Size * 0.07))
  $arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $cyanBrush = [System.Drawing.SolidBrush]::new((New-Color "8AE6FF"))
  $amberBrush = [System.Drawing.SolidBrush]::new((New-Color "FFB45F"))
  $whiteBrush = [System.Drawing.SolidBrush]::new((New-Color "EAFBFF" 235))
  $fontD = [System.Drawing.Font]::new("Segoe UI", $Size * 0.36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fontV = [System.Drawing.Font]::new("Segoe UI", $Size * 0.36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::GenericTypographic

  try {
    $Graphics.FillPath($bgBrush, $path)
    $Graphics.DrawPath($edgePen, $path)
    $Graphics.DrawArc($arcPen, $X + $Size * 0.13, $Y + $Size * 0.13, $Size * 0.74, $Size * 0.74, 128, 285)
    $Graphics.FillEllipse($whiteBrush, $X + $Size * 0.77, $Y + $Size * 0.20, $Size * 0.09, $Size * 0.09)
    $Graphics.DrawString("D", $fontD, $cyanBrush, $X + $Size * 0.22, $Y + $Size * 0.35, $format)
    $Graphics.DrawString("V", $fontV, $amberBrush, $X + $Size * 0.51, $Y + $Size * 0.35, $format)
  } finally {
    $path.Dispose()
    $bgBrush.Dispose()
    $edgePen.Dispose()
    $arcPen.Dispose()
    $cyanBrush.Dispose()
    $amberBrush.Dispose()
    $whiteBrush.Dispose()
    $fontD.Dispose()
    $fontV.Dispose()
  }
}

function Draw-Text {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [string]$FontName,
    [float]$Size,
    [System.Drawing.FontStyle]$Style,
    [System.Drawing.Color]$Color,
    [float]$X,
    [float]$Y
  )

  $font = [System.Drawing.Font]::new($FontName, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $format = [System.Drawing.StringFormat]::GenericTypographic
  try {
    $Graphics.DrawString($Text, $font, $brush, $X, $Y, $format)
  } finally {
    $font.Dispose()
    $brush.Dispose()
  }
}

function Save-Bmp {
  param([System.Drawing.Bitmap]$Bitmap, [string]$Path)

  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
}

function New-BitmapFromSource {
  param(
    [string]$SourcePath,
    [int]$Width,
    [int]$Height
  )

  if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "Installer asset source image not found: $SourcePath"
  }

  $source = [System.Drawing.Image]::FromFile($SourcePath)
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Use-GraphicsQuality $graphics

  try {
    $targetRatio = [double]$Width / [double]$Height
    $sourceRatio = [double]$source.Width / [double]$source.Height

    if ($sourceRatio -gt $targetRatio) {
      $cropHeight = [double]$source.Height
      $cropWidth = $cropHeight * $targetRatio
      $cropX = ([double]$source.Width - $cropWidth) / 2
      $cropY = 0
    } else {
      $cropWidth = [double]$source.Width
      $cropHeight = $cropWidth / $targetRatio
      $cropX = 0
      $cropY = ([double]$source.Height - $cropHeight) / 2
    }

    $sourceRect = [System.Drawing.Rectangle]::new(
      [int][Math]::Round($cropX),
      [int][Math]::Round($cropY),
      [int][Math]::Round($cropWidth),
      [int][Math]::Round($cropHeight)
    )
    $targetRect = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
    $graphics.DrawImage($source, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  } finally {
    $graphics.Dispose()
    $source.Dispose()
  }

  return $bitmap
}

function New-HeaderBitmap {
  return New-BitmapFromSource (Join-Path $BuildDir "installerHeaderSource.png") 150 57
}

function New-SidebarBitmap {
  param([bool]$Uninstall)
  return New-BitmapFromSource (Join-Path $BuildDir "installerSidebarSource.png") 164 314
}

$header = New-HeaderBitmap
$sidebar = New-SidebarBitmap $false
$uninstallerSidebar = New-SidebarBitmap $true

try {
  Save-Bmp $header (Join-Path $BuildDir "installerHeader.bmp")
  Save-Bmp $sidebar (Join-Path $BuildDir "installerSidebar.bmp")
  Save-Bmp $uninstallerSidebar (Join-Path $BuildDir "uninstallerSidebar.bmp")
} finally {
  $header.Dispose()
  $sidebar.Dispose()
  $uninstallerSidebar.Dispose()
}
`

await mkdir(buildDir, { recursive: true })
const tempScript = resolve(tmpdir(), `dicomvision-installer-assets-${randomUUID()}.ps1`)

try {
  await writeFile(tempScript, powershellScript, 'utf-8')
  const powershell = process.env.SystemRoot
    ? resolve(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell'
  const result = spawnSync(
    powershell,
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      tempScript,
      '-BuildDir',
      buildDir,
      '-ProductName',
      productName
    ],
    { stdio: 'inherit' }
  )

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`installer asset generation failed with exit code ${result.status}`)
  }
} finally {
  await rm(tempScript, { force: true })
}

console.log(`Generated installer assets for ${productName}`)
