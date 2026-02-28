// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CurrencyDisplay } from '../CurrencyDisplay';

describe('CurrencyDisplay', () => {
  it('正の金額を¥記号と共に表示する', () => {
    const { container } = render(<CurrencyDisplay amount={1500} />);
    expect(container.textContent).toContain('¥');
    expect(container.textContent).toContain('1,500');
  });

  it('0円を正しく表示する', () => {
    const { container } = render(<CurrencyDisplay amount={0} />);
    expect(container.textContent).toContain('0');
  });

  it('負の金額にマイナス記号を付ける', () => {
    const { container } = render(<CurrencyDisplay amount={-1000} />);
    expect(container.textContent).toContain('-');
    expect(container.textContent).toContain('1,000');
  });

  it('大きな金額を正しくフォーマットする', () => {
    const { container } = render(<CurrencyDisplay amount={999999999} />);
    expect(container.textContent).toContain('999,999,999');
  });

  it('size=sm でレンダリングできる', () => {
    const { container } = render(<CurrencyDisplay amount={1000} size="sm" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('size=md でレンダリングできる（デフォルト）', () => {
    const { container } = render(<CurrencyDisplay amount={1000} size="md" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('size=lg でレンダリングできる', () => {
    const { container } = render(<CurrencyDisplay amount={1000} size="lg" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('variant=positive を適用できる', () => {
    const { container } = render(<CurrencyDisplay amount={1000} variant="positive" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('variant=negative を適用できる', () => {
    const { container } = render(<CurrencyDisplay amount={1000} variant="negative" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('variant=muted を適用できる', () => {
    const { container } = render(<CurrencyDisplay amount={1000} variant="muted" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('className を追加できる', () => {
    const { container } = render(<CurrencyDisplay amount={1000} className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('負の金額は絶対値で表示する', () => {
    const { container } = render(<CurrencyDisplay amount={-2500} />);
    expect(container.textContent).toContain('2,500');
    expect(container.textContent).not.toContain('-2,500');
  });
});
