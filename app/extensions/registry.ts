// The one list of extensions. The Store, Settings → Extensions and root search all read from here.
// Each extension declares its commands and its preferences; Settings builds the form from `prefs`.
import { ITEMS, SERVERS } from '~/data/fixtures'

/** `folders` is a list of folders, one per line. */
export type PrefType = 'text' | 'secret' | 'select' | 'switch' | 'number' | 'folder' | 'folders'

export interface PrefField {
  key: string
  type: PrefType
  label: string
  description?: string
  placeholder?: string
  required?: boolean
  default?: string | number | boolean
  options?: { value: string, label: string }[]
  min?: number
  max?: number
}

export type Prefs = Record<string, string | number | boolean>

export interface ExtCommand {
  /** Command id; for commands that already exist in ITEMS this is that item's id. */
  id: string
  title: string
  /** Preference keys this command can't run without. */
  needs?: string[]
  /** Opens a URL built from the extension's preferences. */
  url?: (p: Prefs) => string
}

export interface ExtensionDef {
  id: string
  name: string
  author: string
  icon: string
  tile: string
  ver: string
  desc: string
  /** Built-in extensions ship with Esky: always installed, not listed in the Store. */
  builtIn?: boolean
  commands: ExtCommand[]
  prefs: PrefField[]
  /** Shown instead of a form when the extension's settings live elsewhere. */
  settingsTab?: string
}

const alias = (example: string): PrefField => ({ key: 'alias', type: 'text', label: 'Alias', description: `Type it in root search to jump to ${example}.`, placeholder: 'e.g. ' + example.split(' ')[0]!.toLowerCase() })

/** Code editors Esky can open a folder in (see EDITORS in useLauncher). */
const EDITOR_OPTIONS = [{ value: 'vscode', label: 'Visual Studio Code' }, { value: 'cursor', label: 'Cursor' }, { value: 'zed', label: 'Zed' }, { value: 'phpstorm', label: 'PhpStorm' }]

export const EXTENSIONS: ExtensionDef[] = [
  {
    id: 'forge',
    name: 'Laravel Forge',
    author: 'Community',
    icon: 'i-lucide-hammer',
    tile: '#EA580C',
    ver: '1.4.0',
    desc: 'Browse servers, open sites and trigger deployments without leaving the keyboard.',
    commands: [{ id: 'forgeSearch', title: 'Search Servers' }, { id: 'forgeDeploy', title: 'Deploy Site' }],
    prefs: [
      { key: 'token', type: 'secret', label: 'API token', required: true, description: 'Create one at forge.laravel.com → Account → API Tokens.' },
      { key: 'server', type: 'select', label: 'Default server', description: 'Preselected in Deploy Site.', default: SERVERS[0]!.name, options: SERVERS.map(s => ({ value: s.name, label: s.name })) },
      alias('Search Servers')
    ]
  },
  {
    id: 'herd',
    name: 'Laravel Herd',
    author: 'Esky',
    icon: 'i-lucide-feather',
    tile: '#E11D48',
    ver: '1.0.0',
    desc: 'Open, reveal and copy the sites Laravel Herd serves on this PC.',
    commands: [{ id: 'herdSites', title: 'Herd Sites' }],
    prefs: [
      { key: 'configDir', type: 'folder', label: 'Herd config folder', description: 'Leave empty for the default, ~\\.config\\herd.', placeholder: '~\\.config\\herd' },
      { key: 'editor', type: 'select', label: 'Open sites with', default: 'vscode', options: EDITOR_OPTIONS },
      { key: 'showAll', type: 'switch', label: 'Show non-Laravel sites', description: 'Folders without an artisan file.', default: true },
      alias('Herd Sites')
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    author: 'Esky',
    icon: 'i-lucide-github',
    tile: '#1E293B',
    ver: '2.1.0',
    desc: 'Search repositories, review pull requests and check workflow runs.',
    commands: [
      { id: 'repos', title: 'Search Repositories', url: p => p.org ? `https://github.com/orgs/${p.org}/repositories` : 'https://github.com/search?type=repositories' },
      { id: 'prs', title: 'My Pull Requests', url: () => 'https://github.com/pulls' },
      { id: 'runs', title: 'Workflow Runs', needs: ['org'], url: p => `https://github.com/${p.org}` }
    ],
    prefs: [
      { key: 'token', type: 'secret', label: 'Personal access token', description: 'Fine-grained token with read access to the repos you want to search.' },
      { key: 'org', type: 'text', label: 'Default organisation', placeholder: 'e.g. acme' }
    ]
  },
  {
    id: 'docs',
    name: 'Laravel Docs',
    author: 'Community',
    icon: 'i-lucide-book-open',
    tile: '#B91C1C',
    ver: '1.1.0',
    desc: 'Jump to any page of the Laravel documentation.',
    commands: [{ id: 'open', title: 'Open Laravel Docs', url: p => `https://laravel.com/docs/${p.version}` }],
    prefs: [
      { key: 'version', type: 'select', label: 'Docs version', description: 'Also used by the “ld” quicklink.', default: '12.x', options: ['12.x', '11.x', '10.x', 'master'].map(v => ({ value: v, label: v })) }
    ]
  },
  {
    id: 'colour',
    name: 'Colour Picker',
    author: 'Esky',
    icon: 'i-lucide-pipette',
    tile: '#DB2777',
    ver: '1.3.1',
    desc: 'Pick any colour on screen and copy it as HEX, RGB or HSL.',
    commands: [{ id: 'pick', title: 'Pick Colour' }, { id: 'saved', title: 'Saved Colours' }],
    prefs: [
      { key: 'format', type: 'select', label: 'Copy as', default: 'hex', options: [{ value: 'hex', label: 'HEX' }, { value: 'rgb', label: 'RGB' }, { value: 'hsl', label: 'HSL' }] },
      { key: 'upper', type: 'switch', label: 'Uppercase HEX', default: true }
    ]
  },
  {
    id: 'spotify',
    name: 'Media Controls',
    author: 'Community',
    icon: 'i-lucide-music',
    tile: '#15803D',
    ver: '0.6.0',
    desc: 'Play, pause and skip tracks in the app that is playing.',
    commands: [{ id: 'toggle', title: 'Play / Pause' }, { id: 'next', title: 'Next Track' }, { id: 'prev', title: 'Previous Track' }],
    prefs: [
      { key: 'player', type: 'select', label: 'Control', default: 'system', options: [{ value: 'system', label: 'Whatever is playing' }, { value: 'spotify', label: 'Spotify only' }] }
    ]
  },
  {
    id: 'jira',
    name: 'Jira',
    author: 'Esky',
    icon: 'i-lucide-ticket',
    tile: '#2563EB',
    ver: '1.8.2',
    desc: 'Find issues, log work and move tickets between columns.',
    commands: [
      { id: 'search', title: 'Search Issues', needs: ['site'], url: p => `https://${p.site}/issues/` },
      { id: 'mine', title: 'My Open Issues', needs: ['site'], url: p => `https://${p.site}/issues/?jql=${encodeURIComponent('assignee = currentUser() AND resolution = Unresolved')}` },
      { id: 'work', title: 'Log Work', needs: ['site'], url: p => `https://${p.site}/jira/your-work` }
    ],
    prefs: [
      { key: 'site', type: 'text', label: 'Site', required: true, placeholder: 'acme.atlassian.net' },
      { key: 'email', type: 'text', label: 'Email', placeholder: 'you@company.com' },
      { key: 'token', type: 'secret', label: 'API token', description: 'Create one at id.atlassian.com → Security → API tokens.' }
    ]
  },
  {
    id: 'docker',
    name: 'Docker',
    author: 'Community',
    icon: 'i-lucide-container',
    tile: '#0284C7',
    ver: '0.9.4',
    desc: 'List containers, tail logs and start or stop compose projects.',
    commands: [{ id: 'containers', title: 'Containers' }, { id: 'compose', title: 'Compose Projects' }, { id: 'images', title: 'Images' }],
    prefs: [
      { key: 'host', type: 'text', label: 'Docker host', default: 'npipe:////./pipe/docker_engine' },
      { key: 'stopped', type: 'switch', label: 'Show stopped containers', default: false }
    ]
  },
  {
    id: 'sentry',
    name: 'Sentry',
    author: 'Community',
    icon: 'i-lucide-bug',
    tile: '#7C3AED',
    ver: '1.2.0',
    desc: 'See unresolved issues and recent releases for each project.',
    commands: [
      { id: 'issues', title: 'Unresolved Issues', needs: ['org'], url: p => `https://${p.org}.sentry.io/issues/?query=is%3Aunresolved` },
      { id: 'releases', title: 'Releases', needs: ['org'], url: p => `https://${p.org}.sentry.io/releases/` }
    ],
    prefs: [
      { key: 'org', type: 'text', label: 'Organisation slug', required: true, placeholder: 'acme' },
      { key: 'token', type: 'secret', label: 'Auth token' }
    ]
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS Docs',
    author: 'Community',
    icon: 'i-lucide-wind',
    tile: '#0891B2',
    ver: '1.0.3',
    desc: 'Search utility classes and copy them straight from the launcher.',
    commands: [{ id: 'search', title: 'Search Classes', url: p => p.version === 'v3' ? 'https://v3.tailwindcss.com/docs' : 'https://tailwindcss.com/docs' }],
    prefs: [
      { key: 'version', type: 'select', label: 'Tailwind version', default: 'v4', options: [{ value: 'v4', label: 'v4' }, { value: 'v3', label: 'v3' }] }
    ]
  },
  {
    id: 'clip',
    name: 'Clipboard History',
    author: 'Built-in',
    icon: 'i-lucide-clipboard-list',
    tile: '#0D9488',
    ver: '',
    desc: 'Everything you copy, searchable.',
    builtIn: true,
    commands: [{ id: 'clip', title: 'Clipboard History' }],
    prefs: [],
    settingsTab: 'clipboard'
  },
  {
    id: 'git',
    name: 'Git',
    author: 'Built-in',
    icon: 'i-lucide-git-branch',
    tile: '#F05032',
    ver: '',
    desc: 'Find repos with uncommitted changes or commits you haven’t pushed.',
    builtIn: true,
    commands: [{ id: 'gitChanges', title: 'Uncommitted Changes' }],
    prefs: [
      { key: 'folders', type: 'folders', label: 'Folders to check', description: 'One per line. Esky checks each folder and the folders directly inside it.', default: '~\\Herd\n~\\Frontend', placeholder: '~\\Projects' },
      { key: 'unpushed', type: 'switch', label: 'Include unpushed commits', description: 'Also list repos with commits that aren’t on the remote yet.', default: true },
      { key: 'editor', type: 'select', label: 'Open repos with', default: 'vscode', options: EDITOR_OPTIONS },
      alias('Uncommitted Changes')
    ]
  },
  {
    id: 'files',
    name: 'File Search',
    author: 'Built-in',
    icon: 'i-lucide-file-search',
    tile: '#CA8A04',
    ver: '',
    desc: 'Find files by name in the folders you choose, and see the files you opened recently.',
    builtIn: true,
    commands: [{ id: 'fileCmd', title: 'Search Files' }],
    prefs: [
      { key: 'folders', type: 'folders', label: 'Folders to search', description: 'One per line, searched with everything inside them. node_modules, vendor, .git and build folders are skipped.', default: '~\\Desktop\n~\\Documents\n~\\Downloads', placeholder: '~\\Projects' },
      { key: 'inSearch', type: 'switch', label: 'Show files in root search', description: 'The best few matches appear under Files when you type three or more letters.', default: true },
      alias('Search Files')
    ]
  },
  {
    id: 'password',
    name: 'Password Generator',
    author: 'Built-in',
    icon: 'i-lucide-key-round',
    tile: '#175DDC',
    ver: '',
    desc: 'Random passwords and passphrases, with the same options as Bitwarden.',
    builtIn: true,
    commands: [{ id: 'pwGen', title: 'Generate Password' }],
    prefs: [alias('Generate Password')]
  },
  {
    id: 'calc',
    name: 'Calculator & Units',
    author: 'Built-in',
    icon: 'i-lucide-calculator',
    tile: '#475569',
    ver: '',
    desc: 'Maths, unit and currency conversion straight from root search.',
    builtIn: true,
    commands: [],
    prefs: [
      { key: 'decimals', type: 'number', label: 'Decimal places', description: 'For calculator results.', default: 6, min: 0, max: 10 },
      { key: 'separators', type: 'switch', label: 'Thousands separators', description: 'Show 1,375 rather than 1375.', default: true }
    ]
  }
]

export const extById = (id: string) => EXTENSIONS.find(x => x.id === id)

/** Installed when Esky first runs. */
export const DEFAULT_INSTALLED = ['forge', 'herd', 'github', 'docs', 'colour', 'spotify']

/** ITEMS id for an extension command: existing items keep their id, new ones are namespaced. */
export const commandItemId = (ext: ExtensionDef, cmd: ExtCommand) => ITEMS[cmd.id] ? cmd.id : `x_${ext.id}_${cmd.id}`

// Register every extension command as a search item.
for (const ext of EXTENSIONS) {
  for (const cmd of ext.commands) {
    const id = commandItemId(ext, cmd)
    if (ITEMS[id]) ITEMS[id]!.ext = ext.id
    else ITEMS[id] = { title: cmd.title, sub: ext.name, icon: ext.icon, tile: ext.tile, kind: 'cmd', ext: ext.id }
  }
}

/** Find the extension and command behind a search item. */
export function commandFor(itemId: string): { ext: ExtensionDef, cmd: ExtCommand } | null {
  for (const ext of EXTENSIONS) {
    for (const cmd of ext.commands) if (commandItemId(ext, cmd) === itemId) return { ext, cmd }
  }
  return null
}

/** Preference values with defaults filled in. */
export function withDefaults(ext: ExtensionDef, saved: Prefs | undefined): Prefs {
  const out: Prefs = {}
  for (const f of ext.prefs) {
    if (f.type === 'secret') continue
    const v = saved?.[f.key]
    out[f.key] = v !== undefined && v !== '' ? v : (f.default ?? (f.type === 'switch' ? false : ''))
  }
  return out
}
