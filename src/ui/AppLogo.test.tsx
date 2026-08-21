import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppLogo, Icon } from '../ui';

describe('AppLogo & Logo Icon', () => {
  it('renders the logo icon with correct SVG markup', () => {
    const { container } = render(<Icon name="logo" className="test-logo" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.classList.contains('test-logo')).toBe(true);
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('renders the AppLogo component in different sizes', () => {
    const { rerender, container } = render(<AppLogo size="sm" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('w-6')).toBe(true);
    expect(el.classList.contains('h-6')).toBe(true);

    rerender(<AppLogo size="md" />);
    const elMd = container.firstChild as HTMLElement;
    expect(elMd.classList.contains('w-8')).toBe(true);
    expect(elMd.classList.contains('h-8')).toBe(true);

    rerender(<AppLogo size="lg" />);
    const elLg = container.firstChild as HTMLElement;
    expect(elLg.classList.contains('w-12')).toBe(true);
    expect(elLg.classList.contains('h-12')).toBe(true);

    rerender(<AppLogo size="xl" />);
    const elXl = container.firstChild as HTMLElement;
    expect(elXl.classList.contains('w-16')).toBe(true);
    expect(elXl.classList.contains('h-16')).toBe(true);
  });
});
