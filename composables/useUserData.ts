import { ref, computed } from 'vue'
import type { Citation } from '~/lib/types'

// ── Types ──

export type SavedDocument = {
  ecli: string
  title: string
  source: 'HUDOC' | 'Rechtspraak' | string
  savedAt: number
  folderIds: string[]      // which folders this doc belongs to
}

export type Folder = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type RecentDocument = {
  ecli: string
  title: string
  source: 'HUDOC' | 'Rechtspraak' | string
  viewedAt: number
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export type Highlight = {
  id: string
  ecli: string
  startLine: number
  startOffset: number    // character offset within startLine
  endLine: number
  endOffset: number      // character offset within endLine
  text: string           // the actual selected text
  color: HighlightColor
  createdAt: number
}

export type DocComment = {
  id: string
  ecli: string
  text: string
  // If undefined => document-level comment; if set => anchored to lines
  startLine?: number
  endLine?: number
  createdAt: number
  updatedAt: number
}

export type ActivityEntry = {
  id: string
  type: 'search' | 'view_document' | 'save_document' | 'unsave_document' | 'create_folder' | 'delete_folder' | 'add_to_folder' | 'remove_from_folder' | 'add_highlight' | 'remove_highlight' | 'add_comment' | 'edit_comment' | 'remove_comment'
  timestamp: number
  label: string             // human-readable summary
  meta?: Record<string, string>  // ecli, folderName, query, etc.
}

// ── Storage keys ──
const KEYS = {
  savedDocs: 'user-saved-docs',
  folders: 'user-folders',
  recentDocs: 'user-recent-docs',
  activity: 'user-activity',
  highlights: 'user-highlights',
  comments: 'user-comments',
} as const

// ── Limits ──
const MAX_RECENT_DOCS = 30
const MAX_ACTIVITY = 100

// ── Singleton state ──
const savedDocs = ref<SavedDocument[]>([])
const folders = ref<Folder[]>([])
const recentDocs = ref<RecentDocument[]>([])
const activity = ref<ActivityEntry[]>([])
const highlights = ref<Highlight[]>([])
const comments = ref<DocComment[]>([])
let initialized = false

// ── Persistence helpers ──
function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function init() {
  if (initialized) return
  initialized = true
  savedDocs.value = load(KEYS.savedDocs, [])
  folders.value = load(KEYS.folders, [])
  recentDocs.value = load(KEYS.recentDocs, [])
  activity.value = load(KEYS.activity, [])
  highlights.value = load(KEYS.highlights, [])
  comments.value = load(KEYS.comments, [])
}

function persistSaved() { save(KEYS.savedDocs, savedDocs.value) }
function persistFolders() { save(KEYS.folders, folders.value) }
function persistRecent() { save(KEYS.recentDocs, recentDocs.value) }
function persistActivity() { save(KEYS.activity, activity.value) }
function persistHighlights() { save(KEYS.highlights, highlights.value) }
function persistComments() { save(KEYS.comments, comments.value) }

// ── Activity logging ──
function logActivity(type: ActivityEntry['type'], label: string, meta?: Record<string, string>) {
  activity.value = [
    { id: crypto.randomUUID(), type, timestamp: Date.now(), label, meta },
    ...activity.value,
  ].slice(0, MAX_ACTIVITY)
  persistActivity()
}

// ── Saved Documents ──
function isDocSaved(ecli: string): boolean {
  return savedDocs.value.some(d => d.ecli === ecli)
}

function saveDocument(citation: Citation | { ecli: string; title?: string; source?: string }) {
  if (isDocSaved(citation.ecli)) return
  const doc: SavedDocument = {
    ecli: citation.ecli,
    title: (citation as Citation).title || citation.ecli,
    source: (citation as Citation).source || '',
    savedAt: Date.now(),
    folderIds: [],
  }
  savedDocs.value = [doc, ...savedDocs.value]
  persistSaved()
  logActivity('save_document', `Saved ${doc.title || doc.ecli}`, { ecli: doc.ecli })
}

function unsaveDocument(ecli: string) {
  const doc = savedDocs.value.find(d => d.ecli === ecli)
  savedDocs.value = savedDocs.value.filter(d => d.ecli !== ecli)
  persistSaved()
  if (doc) {
    logActivity('unsave_document', `Removed ${doc.title || doc.ecli}`, { ecli })
  }
}

function toggleSaveDocument(citation: Citation | { ecli: string; title?: string; source?: string }) {
  if (isDocSaved(citation.ecli)) {
    unsaveDocument(citation.ecli)
  } else {
    saveDocument(citation)
  }
}

// ── Folders ──
function createFolder(name: string): Folder {
  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  folders.value = [...folders.value, folder]
  persistFolders()
  logActivity('create_folder', `Created folder "${name}"`, { folderId: folder.id })
  return folder
}

function renameFolder(id: string, name: string) {
  const folder = folders.value.find(f => f.id === id)
  if (!folder) return
  folder.name = name
  folder.updatedAt = Date.now()
  persistFolders()
}

function deleteFolder(id: string) {
  const folder = folders.value.find(f => f.id === id)
  // Remove folder reference from all docs
  for (const doc of savedDocs.value) {
    doc.folderIds = doc.folderIds.filter(fid => fid !== id)
  }
  folders.value = folders.value.filter(f => f.id !== id)
  persistFolders()
  persistSaved()
  if (folder) {
    logActivity('delete_folder', `Deleted folder "${folder.name}"`, { folderId: id })
  }
}

function addDocumentToFolder(ecli: string, folderId: string) {
  const doc = savedDocs.value.find(d => d.ecli === ecli)
  const folder = folders.value.find(f => f.id === folderId)
  if (!doc || !folder) return
  if (!doc.folderIds.includes(folderId)) {
    doc.folderIds = [...doc.folderIds, folderId]
    folder.updatedAt = Date.now()
    persistSaved()
    persistFolders()
    logActivity('add_to_folder', `Added to "${folder.name}"`, { ecli, folderId })
  }
}

function removeDocumentFromFolder(ecli: string, folderId: string) {
  const doc = savedDocs.value.find(d => d.ecli === ecli)
  const folder = folders.value.find(f => f.id === folderId)
  if (!doc || !folder) return
  doc.folderIds = doc.folderIds.filter(fid => fid !== folderId)
  folder.updatedAt = Date.now()
  persistSaved()
  persistFolders()
  logActivity('remove_from_folder', `Removed from "${folder.name}"`, { ecli, folderId })
}

function getDocsInFolder(folderId: string): SavedDocument[] {
  return savedDocs.value.filter(d => d.folderIds.includes(folderId))
}

function getUncategorizedDocs(): SavedDocument[] {
  return savedDocs.value.filter(d => d.folderIds.length === 0)
}

// ── Recently Viewed Documents ──
function trackDocumentView(citation: Citation | { ecli: string; title?: string; source?: string }) {
  // Remove existing entry for this ECLI
  recentDocs.value = recentDocs.value.filter(d => d.ecli !== citation.ecli)
  const entry: RecentDocument = {
    ecli: citation.ecli,
    title: (citation as Citation).title || citation.ecli,
    source: (citation as Citation).source || '',
    viewedAt: Date.now(),
  }
  recentDocs.value = [entry, ...recentDocs.value].slice(0, MAX_RECENT_DOCS)
  persistRecent()
  logActivity('view_document', `Viewed ${entry.title || entry.ecli}`, { ecli: entry.ecli })
}

// ── Activity ──
function logSearch(queryText: string) {
  logActivity('search', `Searched "${queryText}"`, { query: queryText })
}

function clearActivity() {
  activity.value = []
  persistActivity()
}

function clearRecentDocs() {
  recentDocs.value = []
  persistRecent()
}

// ── Highlights ──
function addHighlight(
  ecli: string,
  startLine: number, startOffset: number,
  endLine: number, endOffset: number,
  text: string,
  color: HighlightColor,
): Highlight {
  const hl: Highlight = {
    id: crypto.randomUUID(),
    ecli,
    startLine,
    startOffset,
    endLine,
    endOffset,
    text,
    color,
    createdAt: Date.now(),
  }
  highlights.value = [hl, ...highlights.value]
  persistHighlights()
  const truncated = text.length > 40 ? text.slice(0, 40) + '…' : text
  logActivity('add_highlight', `Highlighted "${truncated}"`, { ecli, color })
  return hl
}

function removeHighlight(id: string) {
  const hl = highlights.value.find(h => h.id === id)
  highlights.value = highlights.value.filter(h => h.id !== id)
  persistHighlights()
  if (hl) {
    const truncated = hl.text.length > 40 ? hl.text.slice(0, 40) + '…' : hl.text
    logActivity('remove_highlight', `Removed highlight "${truncated}"`, { ecli: hl.ecli })
  }
}

function updateHighlightColor(id: string, color: HighlightColor) {
  // Replace the array (not mutate in-place) so Vue reactivity triggers recomputation
  highlights.value = highlights.value.map(h =>
    h.id === id ? { ...h, color } : h,
  )
  persistHighlights()
}

function getHighlightsForDoc(ecli: string): Highlight[] {
  return highlights.value.filter(h => h.ecli === ecli)
}

// ── Comments ──
function addComment(ecli: string, text: string, startLine?: number, endLine?: number): DocComment {
  const comment: DocComment = {
    id: crypto.randomUUID(),
    ecli,
    text,
    startLine,
    endLine,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  comments.value = [comment, ...comments.value]
  persistComments()
  const lineInfo = startLine ? ` on L${startLine}${endLine && endLine !== startLine ? `–${endLine}` : ''}` : ''
  logActivity('add_comment', `Comment${lineInfo}`, { ecli })
  return comment
}

function editComment(id: string, text: string) {
  const comment = comments.value.find(c => c.id === id)
  if (!comment) return
  comment.text = text
  comment.updatedAt = Date.now()
  persistComments()
  logActivity('edit_comment', 'Edited comment', { ecli: comment.ecli })
}

function removeComment(id: string) {
  const comment = comments.value.find(c => c.id === id)
  comments.value = comments.value.filter(c => c.id !== id)
  persistComments()
  if (comment) {
    logActivity('remove_comment', 'Deleted comment', { ecli: comment.ecli })
  }
}

function getCommentsForDoc(ecli: string): DocComment[] {
  return comments.value.filter(c => c.ecli === ecli)
}

function getAllAnnotations(): (Highlight | DocComment)[] {
  const all: (Highlight & { _type: 'highlight' } | DocComment & { _type: 'comment' })[] = [
    ...highlights.value.map(h => ({ ...h, _type: 'highlight' as const })),
    ...comments.value.map(c => ({ ...c, _type: 'comment' as const })),
  ]
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

// ── Computed ──
const savedDocsCount = computed(() => savedDocs.value.length)
const foldersCount = computed(() => folders.value.length)
const recentDocsCount = computed(() => recentDocs.value.length)
const highlightsCount = computed(() => highlights.value.length)
const commentsCount = computed(() => comments.value.length)
const annotationsCount = computed(() => highlights.value.length + comments.value.length)

// ── Export ──
export function useUserData() {
  init()
  return {
    // State
    savedDocs,
    folders,
    recentDocs,
    activity,
    highlights,
    comments,

    // Computed
    savedDocsCount,
    foldersCount,
    recentDocsCount,
    highlightsCount,
    commentsCount,
    annotationsCount,

    // Saved documents
    isDocSaved,
    saveDocument,
    unsaveDocument,
    toggleSaveDocument,

    // Folders
    createFolder,
    renameFolder,
    deleteFolder,
    addDocumentToFolder,
    removeDocumentFromFolder,
    getDocsInFolder,
    getUncategorizedDocs,

    // Recently viewed
    trackDocumentView,
    clearRecentDocs,

    // Activity
    logSearch,
    clearActivity,

    // Highlights
    addHighlight,
    removeHighlight,
    updateHighlightColor,
    getHighlightsForDoc,

    // Comments
    addComment,
    editComment,
    removeComment,
    getCommentsForDoc,
    getAllAnnotations,
  }
}
