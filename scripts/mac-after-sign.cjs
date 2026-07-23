const { existsSync } = require('node:fs')
const { join } = require('node:path')

function hasAppleIdCredentials(env) {
  return Boolean(env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)
}

function hasApiKeyCredentials(env) {
  return Boolean(env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER)
}

function resolveNotarizeOptions(appPath, appBundleId) {
  if (hasAppleIdCredentials(process.env)) {
    return {
      appPath,
      appBundleId,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    }
  }

  if (hasApiKeyCredentials(process.env)) {
    return {
      appPath,
      appBundleId,
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER
    }
  }

  return null
}

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const notarizeMode = process.env.DICOM_VISION_MAC_NOTARIZE_MODE || 'auto'
  if (notarizeMode === 'never') {
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = join(context.appOutDir, appName)
  if (!existsSync(appPath)) {
    throw new Error(`Signed app bundle was not found: ${appPath}`)
  }

  const notarizeOptions = resolveNotarizeOptions(appPath, context.packager.appInfo.appId)
  if (!notarizeOptions) {
    if (notarizeMode === 'required') {
      throw new Error(
        'macOS notarization was required, but no Apple credentials were found. Set APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER.'
      )
    }
    return
  }

  const { notarize } = await import('@electron/notarize')
  await notarize(notarizeOptions)
}
