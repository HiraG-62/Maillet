import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-4">
      <div className="text-8xl font-black text-[var(--color-primary)] opacity-20 select-none">
        404
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          ページが見つかりません
        </h1>
        <p className="text-[var(--color-text-muted)]">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
      </div>
      <Link
        to="/"
        className="px-6 py-2.5 rounded-full bg-[var(--color-primary)] text-white font-medium hover:opacity-90 active:scale-95 transition-all"
      >
        ホームへ戻る
      </Link>
    </div>
  );
}
