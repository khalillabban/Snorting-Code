import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from '../App';

describe('App', () => {
  it('renders correctly', () => {
    render(<App />);
    // Add your assertions based on your App component
    // Example: expect(screen.getByText('Welcome')).toBeTruthy();
  });
});
