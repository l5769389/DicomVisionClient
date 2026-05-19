import type { DicomTagItem } from '../../types/viewer'

export type DicomTagVrInputKind = 'text' | 'textarea' | 'number' | 'date' | 'time'

export interface DicomTagVrEditSpec {
  kind: DicomTagVrInputKind
  inputType: string
  step?: string
  hint: string
}

const INTEGER_VRS = new Set(['IS', 'SL', 'SS', 'UL', 'US', 'SV', 'UV'])
const DECIMAL_VRS = new Set(['DS', 'FL', 'FD'])
const TEXTAREA_VRS = new Set(['LT', 'ST', 'UT'])
const MAX_TEXT_LENGTH_BY_VR: Record<string, number> = {
  AE: 16,
  AS: 4,
  CS: 16,
  DA: 8,
  DT: 26,
  LO: 64,
  PN: 64,
  SH: 16,
  TM: 16,
  UI: 64
}

function splitDicomValues(value: string): string[] {
  return value.split('\\').map((item) => item.trim())
}

function hasMultipleValues(value: string): boolean {
  return value.includes('\\')
}

export function getDicomTagVrEditSpec(vr: string, isZh: boolean, value = ''): DicomTagVrEditSpec {
  const normalizedVr = vr.toUpperCase()
  if (normalizedVr === 'DA' && !hasMultipleValues(value)) {
    return {
      kind: 'date',
      inputType: 'date',
      hint: isZh ? '日期会保存为 DICOM DA 格式 YYYYMMDD。' : 'Date is saved as DICOM DA format YYYYMMDD.'
    }
  }
  if (normalizedVr === 'TM' && !hasMultipleValues(value)) {
    return {
      kind: 'time',
      inputType: 'time',
      step: '1',
      hint: isZh ? '时间会保存为 DICOM TM 格式 HHMMSS。' : 'Time is saved as DICOM TM format HHMMSS.'
    }
  }
  if ((INTEGER_VRS.has(normalizedVr) || DECIMAL_VRS.has(normalizedVr)) && !hasMultipleValues(value)) {
    return {
      kind: 'number',
      inputType: 'number',
      step: INTEGER_VRS.has(normalizedVr) ? '1' : 'any',
      hint: isZh ? '该 VR 需要数值；多值可用反斜杠分隔。' : 'This VR expects numeric values; use backslashes for multi-value input.'
    }
  }
  if (TEXTAREA_VRS.has(normalizedVr) || value.length > 80 || hasMultipleValues(value)) {
    return {
      kind: 'textarea',
      inputType: 'text',
      hint: isZh ? '多值字段请使用反斜杠 \\ 分隔。' : 'Use backslashes \\ to separate multiple values.'
    }
  }
  return {
    kind: 'text',
    inputType: 'text',
    hint: isZh ? getChineseVrHint(normalizedVr) : getEnglishVrHint(normalizedVr)
  }
}

export function createDicomTagEditInputValue(item: DicomTagItem): string {
  const value = item.value ?? ''
  const vr = item.vr.toUpperCase()
  if (vr === 'DA') {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/)
    return match ? `${match[1]}-${match[2]}-${match[3]}` : value
  }
  if (vr === 'TM') {
    const match = value.match(/^(\d{2})(\d{2})?(\d{2})?(?:\.\d+)?$/)
    if (!match) {
      return value
    }
    return [match[1], match[2] ?? '00', match[3] ?? '00'].join(':')
  }
  return value
}

export function serializeDicomTagEditValue(vr: string, value: string): string {
  const normalizedVr = vr.toUpperCase()
  const trimmedValue = value.trim()
  if (normalizedVr === 'DA') {
    return trimmedValue.replaceAll('-', '')
  }
  if (normalizedVr === 'TM') {
    return trimmedValue.replaceAll(':', '')
  }
  if (normalizedVr === 'CS') {
    return trimmedValue.toUpperCase()
  }
  return trimmedValue
}

export function validateDicomTagEditValue(item: DicomTagItem, value: string, isZh: boolean): string {
  const vr = item.vr.toUpperCase()
  const serializedValue = serializeDicomTagEditValue(vr, value)
  const values = splitDicomValues(serializedValue)
  const invalidMessage = getInvalidValueMessage(vr, isZh)
  const maxLength = MAX_TEXT_LENGTH_BY_VR[vr]

  if (maxLength && values.some((part) => part.length > maxLength)) {
    return isZh ? `${vr} 单个值最长 ${maxLength} 个字符。` : `${vr} values must be at most ${maxLength} characters.`
  }

  if (INTEGER_VRS.has(vr) && values.some((part) => part !== '' && !/^[+-]?\d+$/.test(part))) {
    return invalidMessage
  }
  if (DECIMAL_VRS.has(vr) && values.some((part) => part !== '' && !Number.isFinite(Number(part)))) {
    return invalidMessage
  }
  if (vr === 'DA' && values.some((part) => part !== '' && !isValidDicomDate(part))) {
    return invalidMessage
  }
  if (vr === 'TM' && values.some((part) => part !== '' && !isValidDicomTime(part))) {
    return invalidMessage
  }
  if (vr === 'AS' && values.some((part) => part !== '' && !/^\d{3}[DWMY]$/.test(part.toUpperCase()))) {
    return invalidMessage
  }
  if (vr === 'CS' && values.some((part) => !/^[A-Z0-9_ ]*$/.test(part.toUpperCase()))) {
    return invalidMessage
  }
  if (vr === 'UI' && values.some((part) => part !== '' && !/^[0-9]+(?:\.[0-9]+)*$/.test(part))) {
    return invalidMessage
  }

  return ''
}

function isValidDicomDate(value: string): boolean {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (!match) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isValidDicomTime(value: string): boolean {
  const match = value.match(/^(\d{2})(\d{2})?(\d{2})?(?:\.\d{1,6})?$/)
  if (!match) {
    return false
  }
  const hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  const second = Number(match[3] ?? '0')
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
}

function getInvalidValueMessage(vr: string, isZh: boolean): string {
  if (isZh) {
    return `${vr} 的值格式不符合 DICOM VR 要求。`
  }
  return `${vr} value does not match the DICOM VR format.`
}

function getChineseVrHint(vr: string): string {
  if (vr === 'CS') {
    return 'Code String 会自动转为大写；仅允许大写字母、数字、空格和下划线。'
  }
  if (vr === 'UI') {
    return 'UID 仅允许数字和点号。'
  }
  if (vr === 'AS') {
    return 'Age String 格式为 3 位数字 + D/W/M/Y，例如 045Y。'
  }
  return '普通文本字段；多值请使用反斜杠 \\ 分隔。'
}

function getEnglishVrHint(vr: string): string {
  if (vr === 'CS') {
    return 'Code String is uppercased; only uppercase letters, digits, spaces, and underscores are allowed.'
  }
  if (vr === 'UI') {
    return 'UID allows digits and dots only.'
  }
  if (vr === 'AS') {
    return 'Age String uses 3 digits plus D/W/M/Y, for example 045Y.'
  }
  return 'Text value. Use backslashes \\ for multi-value input.'
}
