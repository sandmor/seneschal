// 🔥 MOCK API (temporal mientras backend no está listo)

export type ExplorerDocument = {
  path: string;
  name: string;
  parent_path: string;
  content: string;
};

export type ExplorerDirectory = {
  path: string;
  name: string;
  children: ExplorerNode[];
  child_directories_count: number;
  child_documents_count: number;
};

export type ExplorerNode =
  | {
      kind: 'directory';
      name: string;
      path: string;
      child_directories_count: number;
      child_documents_count: number;
    }
  | {
      kind: 'document';
      name: string;
      path: string;
      size_bytes: number;
    };

export const directoryQueryKey = (path: string) => ['directory', path] as const;
export const documentQueryKey = (path: string) => ['document', path] as const;

// 🧠 Estado en memoria (simula una base de datos temporal)
const mockStore = {
  directories: new Map<string, { name: string; children: string[] }>([
    ['/', { name: 'Root', children: ['/projects', '/doc1.md', '/notes.md'] }],
    ['/projects', { name: 'projects', children: ['/projects/briefing.md'] }],
  ]),
  documents: new Map<string, string>([
    ['/doc1.md', '# Documento 1\n\nEste es el contenido del documento 1.'],
    ['/notes.md', '# Notas\n\nMis notas aquí.'],
    ['/projects/briefing.md', '# Briefing\n\nContenido del briefing del proyecto.'],
  ]),
};

// 📁 Directory
export async function getDirectory(path: string): Promise<ExplorerDirectory> {
  const dir = mockStore.directories.get(path);
  const childPaths = dir?.children ?? [];

  const children: ExplorerNode[] = childPaths.map((childPath) => {
    const isDir = mockStore.directories.has(childPath);
    const name = childPath.split('/').filter(Boolean).at(-1) ?? childPath;
    if (isDir) {
      const childDir = mockStore.directories.get(childPath)!;
      const grandchildDirs = childDir.children.filter((c) => mockStore.directories.has(c));
      const grandchildDocs = childDir.children.filter((c) => mockStore.documents.has(c));
      return {
        kind: 'directory',
        name,
        path: childPath,
        child_directories_count: grandchildDirs.length,
        child_documents_count: grandchildDocs.length,
      };
    }
    return {
      kind: 'document',
      name,
      path: childPath,
      size_bytes: (mockStore.documents.get(childPath) ?? '').length,
    };
  });

  const dirChildren = children.filter((c) => c.kind === 'directory');
  const docChildren = children.filter((c) => c.kind === 'document');

  return {
    path,
    name: path === '/' ? 'Root' : (path.split('/').filter(Boolean).at(-1) ?? ''),
    children,
    child_directories_count: dirChildren.length,
    child_documents_count: docChildren.length,
  };
}

export async function createDirectory(path: string): Promise<ExplorerDirectory> {
  const name = path.split('/').filter(Boolean).at(-1) ?? '';
  const parent_path = path.split('/').slice(0, -1).join('/') || '/';
  mockStore.directories.set(path, { name, children: [] });
  const parent = mockStore.directories.get(parent_path);
  if (parent && !parent.children.includes(path)) {
    parent.children.push(path);
  }
  return { path, name, children: [], child_directories_count: 0, child_documents_count: 0 };
}

export async function updateDirectory(path: string, newPath: string): Promise<ExplorerDirectory> {
  const dir = mockStore.directories.get(path);
  const name = newPath.split('/').filter(Boolean).at(-1) ?? '';
  mockStore.directories.set(newPath, { name, children: dir?.children ?? [] });
  mockStore.directories.delete(path);
  const parent_path = path.split('/').slice(0, -1).join('/') || '/';
  const parent = mockStore.directories.get(parent_path);
  if (parent) {
    parent.children = parent.children.map((c) => (c === path ? newPath : c));
  }
  return {
    path: newPath,
    name,
    children: [],
    child_directories_count: 0,
    child_documents_count: 0,
  };
}

export async function deleteDirectory(path: string, _recursive: boolean): Promise<void> {
  mockStore.directories.delete(path);
  for (const [, dir] of mockStore.directories) {
    dir.children = dir.children.filter((c) => c !== path);
  }
}

// 📄 Document
export async function getDocument(path: string): Promise<ExplorerDocument> {
  const name = path.split('/').filter(Boolean).at(-1) ?? 'document.md';
  const parent_path = path.split('/').slice(0, -1).join('/') || '/';
  const content = mockStore.documents.get(path) ?? '# Nuevo documento';
  return { path, name, parent_path, content };
}

export async function createDocument(path: string, content: string): Promise<ExplorerDocument> {
  const name = path.split('/').filter(Boolean).at(-1) ?? 'document.md';
  const parent_path = path.split('/').slice(0, -1).join('/') || '/';
  mockStore.documents.set(path, content);
  const parent = mockStore.directories.get(parent_path);
  if (parent && !parent.children.includes(path)) {
    parent.children.push(path);
  }
  return { path, name, parent_path, content };
}

export async function updateDocument(
  path: string,
  options: { content?: string; newPath?: string },
): Promise<ExplorerDocument> {
  const resolvedPath = options.newPath ?? path;
  const content = options.content ?? mockStore.documents.get(path) ?? '';

  if (options.newPath && options.newPath !== path) {
    mockStore.documents.delete(path);
    const parent_path = path.split('/').slice(0, -1).join('/') || '/';
    const parent = mockStore.directories.get(parent_path);
    if (parent) {
      parent.children = parent.children.filter((c) => c !== path);
      parent.children.push(resolvedPath);
    }
  }

  mockStore.documents.set(resolvedPath, content);
  const name = resolvedPath.split('/').filter(Boolean).at(-1) ?? 'document.md';
  const parent_path = resolvedPath.split('/').slice(0, -1).join('/') || '/';
  return { path: resolvedPath, name, parent_path, content };
}

export async function deleteDocument(path: string): Promise<void> {
  mockStore.documents.delete(path);
  for (const [, dir] of mockStore.directories) {
    dir.children = dir.children.filter((c) => c !== path);
  }
}

// ❌ Errores simulados simples
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
