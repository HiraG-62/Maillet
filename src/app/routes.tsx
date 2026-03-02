import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router';
import { RouteErrorElement } from '@/components/common/ChunkErrorBoundary';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'));
const SummaryPage = lazy(() => import('@/pages/SummaryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

const Fallback = () => (
  <div className="flex h-screen items-center justify-center text-[var(--color-primary)]">読み込み中...</div>
);

export const routes: RouteObject[] = [
  { path: '/', element: <Suspense fallback={<Fallback />}><DashboardPage /></Suspense>, errorElement: <RouteErrorElement /> },
  { path: '/transactions', element: <Suspense fallback={<Fallback />}><TransactionsPage /></Suspense>, errorElement: <RouteErrorElement /> },
  { path: '/summary', element: <Suspense fallback={<Fallback />}><SummaryPage /></Suspense>, errorElement: <RouteErrorElement /> },
  { path: '/settings', element: <Suspense fallback={<Fallback />}><SettingsPage /></Suspense>, errorElement: <RouteErrorElement /> },
];
