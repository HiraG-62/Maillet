import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from '@/components/common/Layout';
import { ChunkErrorBoundary } from '@/components/common/ChunkErrorBoundary';
import { routes } from './routes';

const routesWithLayout = routes.map((route) => ({
  ...route,
  element: <Layout>{route.element}</Layout>,
}));

const router = createBrowserRouter(routesWithLayout, {
  basename: import.meta.env.BASE_URL,
});

export function App() {
  return (
    <ChunkErrorBoundary>
      <RouterProvider router={router} />
    </ChunkErrorBoundary>
  );
}
