interface TagBadgeProps {
  tag: string;
  onRemove?: () => void;
}

export function TagBadge({ tag, onRemove }: TagBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="relative leading-none hover:opacity-70 transition-opacity before:content-[''] before:absolute before:-inset-4"
          aria-label={`タグ「${tag}」を削除`}
        >
          ×
        </button>
      )}
    </span>
  );
}
