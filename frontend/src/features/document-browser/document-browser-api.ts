// 🔥 MOCK API (temporal mientras backend no está listo)

export type ExplorerDocument = {
  path: string;
  content: string;
};

export type ExplorerDirectory = {
  path: string;
  children: ExplorerNode[];
};

export type ExplorerNode = {
  name: string;
  type: 'file' | 'directory';
};

export const directoryQueryKey = (path: string) => ['directory', path] as const;
export const documentQueryKey = (path: string) => ['document', path] as const;

// 🧪 Fake data
const mockFiles: ExplorerNode[] = [
  { name: 'doc1.txt', type: 'file' },
  { name: 'notes.md', type: 'file' },
  { name: 'projects', type: 'directory' },
];

// 📁 Directory
export async function getDirectory(path: string): Promise<ExplorerDirectory> {
  return {
    path,
    children: mockFiles,
  };
}

export async function createDirectory(path: string) {
  return { path, children: [] };
}

export async function updateDirectory(path: string, newPath: string) {
  return { path: newPath, children: [] };
}

export async function deleteDirectory(path: string, recursive: boolean) {
  console.log('delete directory', path, recursive);
}

// 📄 Document
export async function getDocument(path: string): Promise<ExplorerDocument> {
  return {
    path,
    content: 'Contenido de ejemplo del documento...',
  };
}

export async function createDocument(path: string, content: string) {
  return { path, content };
}

export async function updateDocument(
  path: string,
  options: { content?: string; newPath?: string },
) {
  return {
    path: options.newPath ?? path,
    content: options.content ?? '',
  };
}

export async function deleteDocument(path: string) {
  console.log('delete document', path);
}

// ❌ errores simulados simples
export function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}