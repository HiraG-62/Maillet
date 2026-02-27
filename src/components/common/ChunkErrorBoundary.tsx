import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

const RELOAD_KEY = 'maillet-chunk-reload';
const RELOAD_COOLDOWN_MS = 10000; // 10秒以内の再リロード防止

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    const isChunkError = isChunkLoadError(error);
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) {
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      // 前回リロードから10秒以上経過している場合のみ自動リロード
      if (!lastReload || now - Number(lastReload) > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(now));
        window.location.reload();
        return;
      }
      // 10秒以内 → 無限ループ防止、手動リロードボタンを表示
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px',
            fontFamily: 'system-ui, sans-serif',
            color: '#64748b',
            background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
          }}
        >
          <div style={{ fontSize: '48px' }}>🔄</div>
          <h2 style={{ margin: 0, color: '#334155' }}>
            {this.state.isChunkError
              ? 'アプリが更新されました'
              : '予期しないエラーが発生しました'}
          </h2>
          <p style={{ margin: 0, textAlign: 'center', maxWidth: '400px' }}>
            {this.state.isChunkError
              ? '新しいバージョンが利用可能です。ページを更新してください。'
              : 'お手数ですが、ページを更新してお試しください。'}
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem(RELOAD_KEY);
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--color-primary, #0d9488)',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ページを更新
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message ?? '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    (error.name === 'TypeError' && msg.includes('fetch'))
  );
}
