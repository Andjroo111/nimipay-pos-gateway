import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPaymentResult(): R;
    }
  }
}

// Add any other global test setup here
