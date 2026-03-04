import { useState } from 'react';
import { CircleHelp } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
}

export function HelpTooltip({ content }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        aria-label="説明を表示"
      >
        <CircleHelp size={13} />
      </button>
      {visible && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5
                      w-48 rounded-md bg-gray-800 border border-gray-600
                      px-2.5 py-2 text-xs text-gray-200 shadow-lg"
        >
          {content}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2
                        border-4 border-transparent border-t-gray-800"
          />
        </div>
      )}
    </div>
  );
}
