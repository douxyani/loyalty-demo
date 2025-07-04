import { ColorValue } from 'react-native';

export const theme = {
  colors: {
    gradient: ['#4c669f', '#3b5998', '#192f6a'] as [string, string, string],
    primary: '#4c669f' as ColorValue,
    accent: '#3b5998' as ColorValue,
    text: {
      primary: '#333',
      secondary: '#666',
      light: '#999',
    },
    background: {
      light: '#fff',
      grey: '#f5f5f5',
    },
    border: '#ddd',
  },
};

export type Theme = typeof theme;
