import {
  createDirectoryApiDirectoriesPost,
  createDocumentApiDocumentsPost,
  deleteDirectoryApiDirectoriesDelete,
  deleteDocumentApiDocumentsDelete,
  getDirectoryApiDirectoriesGet,
  getDocumentApiDocumentsGet,
  updateDirectoryApiDirectoriesPatch,
  updateDocumentApiDocumentsPatch,
} from '@/api/endpoints/api';
import type { DirectoryResponse, DocumentResponse } from '@/api/models';
import { ApiError } from '@/lib/orval-client';

export type ExplorerDirectory = DirectoryResponse;
export type ExplorerNode = DirectoryResponse['children'][number];
export type ExplorerDocument = DocumentResponse;

export const directoryQueryKey = (path: string) => ['directory', path] as const;
export const documentQueryKey = (path: string) => ['document', path] as const;

export async function getDirectory(path: string) {
  const response = await getDirectoryApiDirectoriesGet({ path });
  return response.data as ExplorerDirectory;
}

export async function createDirectory(path: string) {
  const response = await createDirectoryApiDirectoriesPost({ path });
  return response.data as ExplorerDirectory;
}

export async function updateDirectory(path: string, newPath: string) {
  const response = await updateDirectoryApiDirectoriesPatch({ new_path: newPath }, { path });
  return response.data as ExplorerDirectory;
}

export async function deleteDirectory(path: string, recursive: boolean) {
  await deleteDirectoryApiDirectoriesDelete({ path, recursive });
}

export async function getDocument(path: string) {
  const response = await getDocumentApiDocumentsGet({ path });
  return response.data as ExplorerDocument;
}

export async function createDocument(path: string, content: string) {
  const response = await createDocumentApiDocumentsPost({ path, content });
  return response.data as ExplorerDocument;
}

export async function updateDocument(
  path: string,
  options: { content?: string; newPath?: string },
) {
  const response = await updateDocumentApiDocumentsPatch(
    {
      content: options.content ?? null,
      new_path: options.newPath ?? null,
    },
    { path },
  );

  return response.data as ExplorerDocument;
}

export async function deleteDocument(path: string) {
  await deleteDocumentApiDocumentsDelete({ path });
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
