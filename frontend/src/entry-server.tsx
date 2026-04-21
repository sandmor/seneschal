import React from 'react';
import { renderToString } from 'react-dom/server';
import { RouterProvider, AnyRouter } from '@tanstack/react-router';

export { createRouter } from './router';

export async function render(router: AnyRouter) {
  return renderToString(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}
