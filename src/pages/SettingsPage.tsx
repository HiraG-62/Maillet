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
    <div className="float-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-7 h-7 text-[var(--color-primary)]" />
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">
          設定
        </h1>
      </div>

      <SectionCard
        icon={<Mail className="w-4 h-4 text-[var(--color-primary)]" />}
        label="Gmail 接続"
      >
        <SyncPanel />
      </SectionCard>

      <SectionCard
        icon={<Wallet className="w-4 h-4 text-[var(--color-primary)]" />}
        label="使用枠設定"
      >
        <BudgetSection />
      </SectionCard>

      <SectionCard
        icon={<Bot className="w-4 h-4 text-[var(--color-primary)]" />}
        label="AI 設定"
      >
        <ApiKeySection />
      </SectionCard>

      <SectionCard
        icon={<Sun className="w-4 h-4 text-[var(--color-primary)]" />}
        label="テーマ"
      >
        <ThemeSection />
      </SectionCard>

      <SectionCard
        icon={<Database className="w-4 h-4 text-[var(--color-primary)]" />}
        label="データ管理"
      >
        <ExportSection />
      </SectionCard>
    </div>
  );
}
