import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';
import { getUnclassifiedCount } from '@/services/classification';

export function CategoryHealthBadge() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    getUnclassifiedCount().then(setCount).catch(() => {});
  }, []);

  if (count === 0) return null;

  return (
    <button
      onClick={() => navigate('/settings')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 bg-amber-500/10 border border-amber-500/30
                 text-amber-400 text-xs font-medium
                 hover:bg-amber-500/20 transition-colors"
    >
      <Sparkles className="w-3.5 h-3.5" />
      未分類 {count}件 — AIで整理
    </button>
  );
}
