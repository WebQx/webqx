import '@testing-library/jest-dom';

// Jest 29+ uses expect module augmentation for matchers
declare module 'expect' {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toHaveClass(...classNames: string[]): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace?: boolean }): R;
    toHaveValue(value?: any): R;
  }
}