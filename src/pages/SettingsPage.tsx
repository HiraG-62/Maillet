import React from 'react';
import { Bot, Database, Mail, Settings, Sun, Wallet } from 'lucide-react';
import { SyncPanel } from '@/components/common/SyncPanel';
import { BudgetSection } from '@/components/settings/BudgetSection';
import { ApiKeySection } from '@/components/settings/ApiKeySection';
import { ThemeSection } from '@/components/settings/ThemeSection';
import { ExportSection } from '@/components/settings/ExportSection';

function SectionCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="backdrop-blur-sm dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-7 h-7 text-cyan-400" />
        <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-200 to-cyan-400 bg-clip-text text-transparent">
          設定
        </h1>
      </div>

      <SectionCard
        icon={<Mail className="w-4 h-4 text-cyan-400" />}
        label="Gmail 接続"
      >
        <SyncPanel />
      </SectionCard>

      <SectionCard
        icon={<Wallet className="w-4 h-4 text-green-400" />}
        label="予算設定"
      >
        <BudgetSection />
      </SectionCard>

      <SectionCard
        icon={<Bot className="w-4 h-4 text-orange-400" />}
        label="AI 設定"
      >
        <ApiKeySection />
      </SectionCard>

      <SectionCard
        icon={<Sun className="w-4 h-4 text-purple-400" />}
        label="テーマ"
      >
        <ThemeSection />
      </SectionCard>

      <SectionCard
        icon={<Database className="w-4 h-4 text-blue-400" />}
        label="データ管理"
      >
        <ExportSection />
      </SectionCard>
    </div>
  );
}
