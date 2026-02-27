import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'));
const SummaryPage = lazy(() => import('@/pages/SummaryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

const Fallback = () => (
  <div className="flex h-screen items-center justify-center text-[var(--color-primary)]">読み込み中...</div>
);

export const routes: RouteObject[] = [
  { path: '/', element: <Suspense fallback={<Fallback />}><DashboardPage /></Suspense> },
  { path: '/transactions', element: <Suspense fallback={<Fallback />}><TransactionsPage /></Suspense> },
  { path: '/summary', element: <Suspense fallback={<Fallback />}><SummaryPage /></Suspense> },
  { path: '/settings', element: <Suspense fallback={<Fallback />}><SettingsPage /></Suspense> },
];
