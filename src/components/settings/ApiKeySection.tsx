import { useState, useEffect } from 'react';
import { LLMProvider } from '@/types/llm';
import { saveKey, deleteKey, hasKey } from '@/services/llm/key-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google', 'openrouter'];
const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
};

export function ApiKeySection() {
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [userPin, setUserPin] = useState('');
  const [keyExists, setKeyExists] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Check if key exists for current provider
  useEffect(() => {
    const checkKey = async () => {
      try {
        const exists = await hasKey(selectedProvider);
        setKeyExists(exists);
      } catch (err) {
        console.error('Error checking key:', err);
      }
    };
    checkKey();
    setApiKey('');
    setUserPin('');
    setShowForm(false);
    setError('');
    setMessage('');
  }, [selectedProvider]);

  const handleSave = async () => {
    setError('');
    setMessage('');

    if (!apiKey.trim()) {
      setError('APIキーを入力してください');
      return;
    }

    if (!userPin.trim()) {
      setError('PINを入力してください');
      return;
    }

    if (userPin.length < 4) {
      setError('PINは4文字以上である必要があります');
      return;
    }

    setLoading(true);
    try {
      await saveKey(selectedProvider, apiKey, userPin);
      setMessage('✅ APIキーを保存しました');
      setApiKey('');
      setUserPin('');
      setShowForm(false);
      setKeyExists(true);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'エラーが発生しました'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('このプロバイダーのAPIキーを削除しますか？')) {
      return;
    }

    setLoading(true);
    try {
      await deleteKey(selectedProvider);
      setMessage('✅ APIキーを削除しました');
      setKeyExists(false);
      setShowForm(false);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'エラーが発生しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#12121a]/80 p-4 mb-4">
      <h3 className="text-slate-200 font-semibold mb-3">APIキー管理（BYOK）</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            プロバイダー
          </label>
          <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as LLMProvider)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {PROVIDER_LABELS[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
          <span className="text-sm text-slate-300">
            {keyExists ? '✅ 設定済み' : '手動分類モード（APIキー未設定）'}
          </span>
          {keyExists && (
            <Button
              onClick={() => setShowForm(!showForm)}
              variant="ghost"
              size="sm"
            >
              {showForm ? '閉じる' : '変更/削除'}
            </Button>
          )}
          {!keyExists && (
            <Button
              onClick={() => setShowForm(!showForm)}
              variant="ghost"
              size="sm"
            >
              {showForm ? '閉じる' : '設定'}
            </Button>
          )}
        </div>

        {showForm && (
          <div className="space-y-3 p-3 bg-slate-700/20 rounded">
            <Input
              type="password"
              placeholder="APIキー"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
            />
            <Input
              type="password"
              placeholder="PIN（4文字以上）"
              value={userPin}
              onChange={(e) => setUserPin(e.target.value)}
              disabled={loading}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {message && <p className="text-green-500 text-sm">{message}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                variant="default"
                disabled={loading}
              >
                {loading ? '処理中...' : '保存'}
              </Button>
              {keyExists && (
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  disabled={loading}
                >
                  削除
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
