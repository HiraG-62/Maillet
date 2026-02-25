import { BudgetSection } from '@/components/settings/BudgetSection';
import { ApiKeySection } from '@/components/settings/ApiKeySection';
import { ThemeSection } from '@/components/settings/ThemeSection';
import { ExportSection } from '@/components/settings/ExportSection';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6">設定</h1>

      <BudgetSection />
      <ApiKeySection />
      <ThemeSection />
      <ExportSection />
    </div>
  );
}
