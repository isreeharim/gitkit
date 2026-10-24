import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('combines simple class names', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary');
  });

  it('handles conditional classes properly', () => {
    const isError = true;
    const isSuccess = false;
    expect(cn('base', isError && 'text-red-500', isSuccess && 'text-green-500')).toBe(
      'base text-red-500'
    );
  });

  it('merges conflicting Tailwind utility classes deterministically', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
