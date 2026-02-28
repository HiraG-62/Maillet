// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('タイトルと値を表示する', () => {
    render(<StatCard title="総支出" value="¥5,000" />);
    expect(screen.getByText('総支出')).toBeInTheDocument();
    expect(screen.getByText('¥5,000')).toBeInTheDocument();
  });

  it('isLoading=true ではアニメーション要素を表示する', () => {
    const { container } = render(<StatCard title="総支出" value="¥5,000" isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('isLoading=true では値を表示しない', () => {
    render(<StatCard title="総支出" value="¥5,000" isLoading />);
    expect(screen.queryByText('¥5,000')).not.toBeInTheDocument();
  });

  it('isLoading=false では値を表示する', () => {
    render(<StatCard title="総支出" value="¥5,000" isLoading={false} />);
    expect(screen.getByText('¥5,000')).toBeInTheDocument();
  });

  it('unit を表示する', () => {
    render(<StatCard title="取引数" value="15" unit="件" />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('件')).toBeInTheDocument();
  });

  it('subtext を表示する', () => {
    render(<StatCard title="総支出" value="¥5,000" subtext="先月比 +10%" />);
    expect(screen.getByText('先月比 +10%')).toBeInTheDocument();
  });

  it('subtext が未指定の場合は表示しない', () => {
    render(<StatCard title="総支出" value="¥5,000" />);
    expect(screen.queryByText('先月比')).not.toBeInTheDocument();
  });

  it('各 variant でクラッシュせずレンダリングできる', () => {
    const variants = [
      'default', 'warning', 'danger', 'success',
      'cyan', 'purple', 'orange', 'green',
    ] as const;
    for (const variant of variants) {
      const { container } = render(
        <StatCard title="テスト" value="100" variant={variant} />
      );
      expect(container.firstChild).toBeInTheDocument();
    }
  });

  it('icon を表示できる', () => {
    render(
      <StatCard title="総支出" value="100" icon={<span data-testid="test-icon">★</span>} />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
