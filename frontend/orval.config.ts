import { defineConfig } from 'orval';
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../.env') });

const backendPort = process.env.BACKEND_PORT || '8000';
const openApiUrl = process.env.OPENAPI_URL || `http://127.0.0.1:${backendPort}/openapi.json`;

export default defineConfig({
  api: {
    input: openApiUrl,
    output: {
      mode: 'split',
      target: 'src/api/endpoints/api.ts',
      schemas: 'src/api/models',
      client: 'react-query',
      override: {
        mutator: {
          path: 'src/lib/orval-client.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
