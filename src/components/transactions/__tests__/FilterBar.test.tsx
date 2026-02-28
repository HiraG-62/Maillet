// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterBar } from '../FilterBar';

const defaultProps = {
  selectedMonth: 'all',
  selectedCard: 'all',
  searchQuery: '',
  categories: ['食費', 'ショッピング', '交通'],
  selectedCategory: '',
  onMonthChange: vi.fn(),
  onCardChange: vi.fn(),
  onSearchChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onReset: vi.fn(),
};

describe('FilterBar', () => {
  it('検索フィールドが表示される', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('加盟店・説明で検索...')).toBeInTheDocument();
  });

  it('フィルタが全てデフォルトの場合リセットボタンは表示されない', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.queryByText('リセット')).not.toBeInTheDocument();
  });

  it('検索クエリがある場合リセットボタンが表示される', () => {
    render(<FilterBar {...defaultProps} searchQuery="テスト" />);
    expect(screen.getByText('リセット')).toBeInTheDocument();
  });

  it('月フィルタが有効な場合リセットボタンが表示される', () => {
    render(<FilterBar {...defaultProps} selectedMonth="2026-03" />);
    expect(screen.getByText('リセット')).toBeInTheDocument();
  });

  it('カードフィルタが有効な場合リセットボタンが表示される', () => {
    render(<FilterBar {...defaultProps} selectedCard="SMBC" />);
    expect(screen.getByText('リセット')).toBeInTheDocument();
  });

  it('カテゴリフィルタが有効な場合リセットボタンが表示される', () => {
    render(<FilterBar {...defaultProps} selectedCategory="食費" />);
    expect(screen.getByText('リセット')).toBeInTheDocument();
  });

  it('onReset が undefined の場合リセットボタンは表示されない', () => {
    render(<FilterBar {...defaultProps} searchQuery="テスト" onReset={undefined} />);
    expect(screen.queryByText('リセット')).not.toBeInTheDocument();
  });

  it('検索入力で onSearchChange が呼ばれる', () => {
    const onSearchChange = vi.fn();
    render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText('加盟店・説明で検索...');
    fireEvent.change(input, { target: { value: '東京' } });
    expect(onSearchChange).toHaveBeenCalledWith('東京');
  });

  it('リセットボタンクリックで onReset が呼ばれる', () => {
    const onReset = vi.fn();
    render(<FilterBar {...defaultProps} searchQuery="テスト" onReset={onReset} />);
    fireEvent.click(screen.getByText('リセット'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('空の categories 配列でもクラッシュしない', () => {
    expect(() =>
      render(<FilterBar {...defaultProps} categories={[]} />)
    ).not.toThrow();
  });

  it('searchQuery を入力に反映する', () => {
    render(<FilterBar {...defaultProps} searchQuery="既存クエリ" />);
    const input = screen.getByPlaceholderText('加盟店・説明で検索...') as HTMLInputElement;
    expect(input.value).toBe('既存クエリ');
  });
});
