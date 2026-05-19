import type { FolderSeriesItem } from '../../types/viewer'

type SeriesGroupLocale = 'zh-CN' | 'en-US' | string

interface SeriesStudyMetadata {
  accessionNumber?: string | null
  patientName?: string | null
  studyDate?: string | null
  studyDescription?: string | null
}

type GroupableSeriesItem = FolderSeriesItem & SeriesStudyMetadata

export interface SeriesTreeStudyGroup {
  key: string
  title: string
  subtitle: string
  count: number
  order: number
  sortDate: string
  series: FolderSeriesItem[]
}

export interface SeriesTreePatientGroup {
  key: string
  title: string
  subtitle: string
  count: number
  order: number
  studies: SeriesTreeStudyGroup[]
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim()
}

function formatPatientName(value: string | null | undefined): string {
  const text = cleanText(value)
  const formatted = text.split('^').map((part) => part.trim()).filter(Boolean).join(' ')
  return formatted || text
}

function isZh(locale: SeriesGroupLocale): boolean {
  return locale === 'zh-CN'
}

function unknownPatientLabel(locale: SeriesGroupLocale): string {
  return isZh(locale) ? '未知患者' : 'Unknown Patient'
}

function unknownStudyLabel(locale: SeriesGroupLocale): string {
  return isZh(locale) ? '未知检查' : 'Unknown Study'
}

function formatDicomDate(value: string | null | undefined): string {
  const text = cleanText(value)
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : text
}

function getPatientKey(series: GroupableSeriesItem): string {
  const patientId = cleanText(series.patientId)
  if (patientId) return `patient:${patientId}`

  const patientName = cleanText(series.patientName)
  if (patientName) return `patient-name:${patientName}`

  return 'patient:unknown'
}

function getPatientTitle(series: GroupableSeriesItem, locale: SeriesGroupLocale): string {
  return formatPatientName(series.patientName) || cleanText(series.patientId) || unknownPatientLabel(locale)
}

function getPatientSubtitle(series: GroupableSeriesItem): string {
  void series
  return ''
}

function getStudyKey(series: GroupableSeriesItem): string {
  const studyInstanceUid = cleanText(series.studyInstanceUid)
  if (studyInstanceUid) return `study:${studyInstanceUid}`

  const studyDate = cleanText(series.studyDate)
  const studyDescription = cleanText(series.studyDescription)
  if (studyDate || studyDescription) {
    return `study-meta:${studyDate}:${studyDescription}`
  }

  return `study:unknown:${getPatientKey(series)}`
}

function getStudyTitle(series: GroupableSeriesItem, locale: SeriesGroupLocale): string {
  return formatDicomDate(series.studyDate) || cleanText(series.studyDescription) || unknownStudyLabel(locale)
}

function getStudySubtitle(series: GroupableSeriesItem): string {
  const parts = [
    cleanText(series.studyDate) ? cleanText(series.studyDescription) : '',
    cleanText(series.accessionNumber) ? `ACC ${cleanText(series.accessionNumber)}` : ''
  ].filter(Boolean)

  return parts.join(' · ')
}

function compareStudyGroups(a: SeriesTreeStudyGroup, b: SeriesTreeStudyGroup): number {
  if (a.sortDate && b.sortDate && a.sortDate !== b.sortDate) {
    return b.sortDate.localeCompare(a.sortDate)
  }

  if (a.sortDate && !b.sortDate) return -1
  if (!a.sortDate && b.sortDate) return 1
  return a.order - b.order
}

export function buildSeriesTreeGroups(seriesList: FolderSeriesItem[], locale: SeriesGroupLocale): SeriesTreePatientGroup[] {
  const patientGroups = new Map<string, SeriesTreePatientGroup>()
  const studyGroupsByPatient = new Map<string, Map<string, SeriesTreeStudyGroup>>()

  seriesList.forEach((series, index) => {
    const groupableSeries = series as GroupableSeriesItem
    const patientKey = getPatientKey(groupableSeries)
    let patientGroup = patientGroups.get(patientKey)

    if (!patientGroup) {
      patientGroup = {
        key: patientKey,
        title: getPatientTitle(groupableSeries, locale),
        subtitle: getPatientSubtitle(groupableSeries),
        count: 0,
        order: index,
        studies: []
      }
      patientGroups.set(patientKey, patientGroup)
      studyGroupsByPatient.set(patientKey, new Map())
    }

    const studyKey = getStudyKey(groupableSeries)
    const patientStudyGroups = studyGroupsByPatient.get(patientKey)!
    let studyGroup = patientStudyGroups.get(studyKey)

    if (!studyGroup) {
      studyGroup = {
        key: `${patientKey}:${studyKey}`,
        title: getStudyTitle(groupableSeries, locale),
        subtitle: getStudySubtitle(groupableSeries),
        count: 0,
        order: index,
        sortDate: cleanText(groupableSeries.studyDate),
        series: []
      }
      patientStudyGroups.set(studyKey, studyGroup)
      patientGroup.studies.push(studyGroup)
    }

    studyGroup.series.push(series)
    studyGroup.count += 1
    patientGroup.count += 1
  })

  return [...patientGroups.values()]
    .sort((a, b) => a.order - b.order)
    .map((patientGroup) => ({
      ...patientGroup,
      studies: [...patientGroup.studies].sort(compareStudyGroups)
    }))
}
