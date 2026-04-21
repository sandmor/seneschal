import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { createRouter } from './router';

import './index.css';

const router = createRouter();

hydrateRoot(
  document.getElementById('root')!,
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
