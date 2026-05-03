export function getPathName(path: string) {
  if (path === '/') {
    return '/';
  }

  const segments = path.split('/').filter(Boolean);
  return segments.at(-1) ?? '/';
}

export function getParentPath(path: string) {
  if (path === '/') {
    return '/';
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return '/';
  }

  return `/${segments.slice(0, -1).join('/')}`;
}

export function joinPath(parentPath: string, name: string) {
  const trimmedName = name.trim().replace(/^\/+|\/+$/g, '');

  if (!trimmedName) {
    return parentPath;
  }

  if (parentPath === '/') {
    return `/${trimmedName}`;
  }

  return `${parentPath}/${trimmedName}`;
}

export function stripMarkdownExtension(name: string) {
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

export function ensureMarkdownExtension(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return trimmedName;
  }

  return trimmedName.endsWith('.md') ? trimmedName : `${trimmedName}.md`;
}

export function getBreadcrumbs(path: string) {
  if (path === '/') {
    return [{ label: 'Archive', path: '/' }];
  }

  const segments = path.split('/').filter(Boolean);

  return [
    { label: 'Archive', path: '/' },
    ...segments.map((segment, index) => ({
      label: segment,
      path: `/${segments.slice(0, index + 1).join('/')}`,
    })),
  ];
}
