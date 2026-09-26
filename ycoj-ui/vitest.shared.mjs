import react from '@vitejs/plugin-react';

// Vitest only defaults NODE_ENV to 'test' when it is unset, so an ambient
// NODE_ENV=production reaches Vite's dependency optimizer, which inlines
// React's production build into the test bundle. React 19's production build
// has no `act` export, so @testing-library/react falls back to
// react-dom/test-utils, whose `act` delegates back to React.act and throws
// "React.act is not a function". Test runs always use NODE_ENV=test, which
// loads the development build that exports `act`.
process.env.NODE_ENV = 'test';

// Shared vite options for the node and browser vitest configs. The alias
// stubs the Next.js 'server-only' marker so server modules load in tests.
export const sharedResolve = {
  alias: {
    'server-only': 'next/dist/compiled/server-only/empty.js',
  },
  tsconfigPaths: true,
};

export const sharedPlugins = [react()];
