#!/usr/bin/env swift

import AppKit
import Foundation

let fileManager = FileManager.default
let rootURL = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let buildURL = rootURL.appendingPathComponent("build")
let publicURL = rootURL.appendingPathComponent("src/renderer/public")
let assetURL = rootURL.appendingPathComponent("src/renderer/src/assets/brand")

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
  NSColor(
    calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
    green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255,
    alpha: alpha
  )
}

func fillRounded(_ rect: CGRect, radius: CGFloat, color fillColor: NSColor, stroke: NSColor? = nil, width: CGFloat = 1) {
  let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
  fillColor.setFill()
  path.fill()
  if let stroke {
    stroke.setStroke()
    path.lineWidth = width
    path.stroke()
  }
}

func drawBrandMark(in rect: CGRect) {
  let size = min(rect.width, rect.height)
  let outer = rect.insetBy(dx: size * 0.045, dy: size * 0.045)
  let path = NSBezierPath(roundedRect: outer, xRadius: size * 0.20, yRadius: size * 0.20)
  NSGradient(starting: color(0x1c3447), ending: color(0x08131d))!.draw(in: path, angle: -48)
  color(0x78c9ed, alpha: 0.66).setStroke()
  path.lineWidth = max(1.5, size * 0.018)
  path.stroke()
  fillRounded(
    outer.insetBy(dx: size * 0.095, dy: size * 0.095),
    radius: size * 0.145,
    color: color(0x0d202d, alpha: 0.62),
    stroke: color(0xa2d9f2, alpha: 0.18),
    width: max(1, size * 0.009)
  )
  let monogram = NSAttributedString(
    string: "DV",
    attributes: [
      .font: NSFont.monospacedSystemFont(ofSize: size * 0.35, weight: .bold),
      .foregroundColor: color(0x9bdfff),
      .kern: size * 0.004
    ]
  )
  let textSize = monogram.size()
  monogram.draw(at: CGPoint(x: rect.midX - textSize.width / 2, y: rect.midY - textSize.height / 2 + size * 0.018))
  fillRounded(
    CGRect(x: rect.midX - size * 0.16, y: rect.minY + size * 0.19, width: size * 0.32, height: max(2, size * 0.022)),
    radius: size * 0.014,
    color: color(0x67c7ee, alpha: 0.82)
  )
}

func drawText(_ text: String, at point: CGPoint, size: CGFloat, color textColor: NSColor, weight: NSFont.Weight = .semibold) {
  NSAttributedString(
    string: text,
    attributes: [
      .font: NSFont.systemFont(ofSize: size, weight: weight),
      .foregroundColor: textColor,
      .kern: max(0, size * 0.015)
    ]
  ).draw(at: point)
}

func writePNG(_ url: URL, width: Int, height: Int, drawing: @escaping () -> Void) throws {
  try writeBitmap(url, width: width, height: height, fileType: .png, drawing: drawing)
}

func writeBitmap(
  _ url: URL,
  width: Int,
  height: Int,
  fileType: NSBitmapImageRep.FileType,
  drawing: @escaping () -> Void
) throws {
  try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  )!
  let context = NSGraphicsContext(bitmapImageRep: bitmap)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.cgContext.setFillColor(NSColor.clear.cgColor)
  context.cgContext.fill(CGRect(x: 0, y: 0, width: width, height: height))
  drawing()
  NSGraphicsContext.restoreGraphicsState()
  guard let data = bitmap.representation(using: fileType, properties: [:]) else {
    throw NSError(domain: "DicomVisionBrand", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to encode image"])
  }
  try data.write(to: url)
}

func writeIconPNG(_ url: URL, size: Int) throws {
  try writePNG(url, width: size, height: size) {
    drawBrandMark(in: CGRect(x: 0, y: 0, width: size, height: size))
  }
}

func writeICO(from pngURL: URL, to iconURL: URL) throws {
  let pngData = try Data(contentsOf: pngURL)
  var data = Data()
  func append<T: FixedWidthInteger>(_ value: T) {
    var littleEndian = value.littleEndian
    withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
  }
  append(UInt16(0)); append(UInt16(1)); append(UInt16(1))
  data.append(0); data.append(0); data.append(0); data.append(0)
  append(UInt16(1)); append(UInt16(32)); append(UInt32(pngData.count)); append(UInt32(22))
  data.append(pngData)
  try data.write(to: iconURL)
}

func buildMacIcon() throws {
  let iconsetURL = buildURL.appendingPathComponent("DicomVision.iconset")
  try? fileManager.removeItem(at: iconsetURL)
  try fileManager.createDirectory(at: iconsetURL, withIntermediateDirectories: true)
  for (name, size) in [
    ("icon_16x16.png", 16), ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32), ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128), ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256), ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512), ("icon_512x512@2x.png", 1024)
  ] {
    try writeIconPNG(iconsetURL.appendingPathComponent(name), size: size)
  }
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
  process.arguments = ["-c", "icns", iconsetURL.path, "-o", buildURL.appendingPathComponent("icon.icns").path]
  try process.run()
  process.waitUntilExit()
  guard process.terminationStatus == 0 else {
    throw NSError(domain: "DicomVisionBrand", code: 2, userInfo: [NSLocalizedDescriptionKey: "iconutil failed"])
  }
  try? fileManager.removeItem(at: iconsetURL)
}

func drawInstallerHeader() {
  let canvas = CGRect(x: 0, y: 0, width: 1518, height: 1036)
  color(0x0b141d).setFill(); canvas.fill()
  NSGradient(starting: color(0x102c3d), ending: color(0x08111a))!.draw(in: canvas, angle: -24)
  drawBrandMark(in: CGRect(x: 250, y: 352, width: 330, height: 330))
  drawText("DICOM Vision", at: CGPoint(x: 650, y: 544), size: 82, color: color(0xe8f5fb), weight: .bold)
  drawText("Medical imaging workspace", at: CGPoint(x: 654, y: 445), size: 34, color: color(0x8fb6c8), weight: .medium)
}

func drawInstallerSidebar() {
  let canvas = CGRect(x: 0, y: 0, width: 879, height: 1789)
  color(0x0a131c).setFill(); canvas.fill()
  NSGradient(starting: color(0x133348), ending: color(0x071019))!.draw(in: canvas, angle: -38)
  drawBrandMark(in: CGRect(x: 212, y: 1118, width: 455, height: 455))
  drawText("DICOM Vision", at: CGPoint(x: 145, y: 985), size: 58, color: color(0xeaf6fb), weight: .bold)
  drawText("Medical imaging workspace", at: CGPoint(x: 160, y: 910), size: 27, color: color(0x93bbce), weight: .medium)
}

func drawInstallerHeaderCompact() {
  let canvas = CGRect(x: 0, y: 0, width: 150, height: 57)
  color(0x0b141d).setFill(); canvas.fill()
  NSGradient(starting: color(0x102c3d), ending: color(0x08111a))!.draw(in: canvas, angle: -24)
  drawBrandMark(in: CGRect(x: 7, y: 8, width: 40, height: 40))
  drawText("DICOM Vision", at: CGPoint(x: 53, y: 29), size: 10.5, color: color(0xe8f5fb), weight: .bold)
  drawText("Medical viewer", at: CGPoint(x: 53, y: 16), size: 5.2, color: color(0x8fb6c8), weight: .medium)
}

func drawInstallerSidebarCompact() {
  let canvas = CGRect(x: 0, y: 0, width: 164, height: 314)
  color(0x0a131c).setFill(); canvas.fill()
  NSGradient(starting: color(0x133348), ending: color(0x071019))!.draw(in: canvas, angle: -38)
  drawBrandMark(in: CGRect(x: 38, y: 188, width: 88, height: 88))
  drawText("DICOM Vision", at: CGPoint(x: 34, y: 168), size: 15, color: color(0xeaf6fb), weight: .bold)
  drawText("Medical imaging", at: CGPoint(x: 43, y: 149), size: 7.5, color: color(0x93bbce), weight: .medium)
}

do {
  try fileManager.createDirectory(at: buildURL, withIntermediateDirectories: true)
  try writeIconPNG(buildURL.appendingPathComponent("icon.png"), size: 512)
  try writeIconPNG(publicURL.appendingPathComponent("app-icon.png"), size: 512)
  try writeIconPNG(publicURL.appendingPathComponent("icons/app-icon-192.png"), size: 192)
  try writeIconPNG(assetURL.appendingPathComponent("dicomvision-mark.png"), size: 512)
  try writeICO(from: buildURL.appendingPathComponent("icon.png"), to: buildURL.appendingPathComponent("icon.ico"))
  try buildMacIcon()
  try writePNG(buildURL.appendingPathComponent("installerHeaderSource.png"), width: 1518, height: 1036, drawing: drawInstallerHeader)
  try writePNG(buildURL.appendingPathComponent("installerSidebarSource.png"), width: 879, height: 1789, drawing: drawInstallerSidebar)
  try writeBitmap(buildURL.appendingPathComponent("installerHeader.bmp"), width: 150, height: 57, fileType: .bmp, drawing: drawInstallerHeaderCompact)
  try writeBitmap(buildURL.appendingPathComponent("installerSidebar.bmp"), width: 164, height: 314, fileType: .bmp, drawing: drawInstallerSidebarCompact)
  try writeBitmap(buildURL.appendingPathComponent("uninstallerSidebar.bmp"), width: 164, height: 314, fileType: .bmp, drawing: drawInstallerSidebarCompact)
  print("Generated DicomVision brand assets.")
} catch {
  fputs("Unable to generate DicomVision brand assets: \(error.localizedDescription)\n", stderr)
  exit(1)
}
