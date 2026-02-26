export type ThemeColorId = 'teal' | 'blue' | 'violet' | 'rose' | 'orange' | 'emerald' | 'indigo';

export interface ThemeColor {
  id: ThemeColorId;
  name: string;
  light: {
    primary: string;
    primaryHover: string;
    primaryForeground: string;
    primaryLight: string;
    gradientFrom: string;
    gradientMid: string;
    gradientTo: string;
    cardBorder: string;
  };
  dark: {
    primary: string;
    primaryHover: string;
    primaryForeground: string;
    primaryLight: string;
    gradientFrom: string;
    gradientMid: string;
    gradientTo: string;
    cardBorder: string;
  };
}

export const THEME_COLORS: ThemeColor[] = [
  {
    id: 'teal',
    name: 'Teal',
    light: {
      primary: '#0d9488',
      primaryHover: '#0f766e',
      primaryForeground: '#ffffff',
      primaryLight: '#ccfbf1',
      gradientFrom: '#ffffff',
      gradientMid: '#f0fdfa',
      gradientTo: '#ccfbf1',
      cardBorder: '#0d9488',
    },
    dark: {
      primary: '#2dd4bf',
      primaryHover: '#14b8a6',
      primaryForeground: '#042f2e',
      primaryLight: '#134e4a',
      gradientFrom: '#042f2e',
      gradientMid: '#063b38',
      gradientTo: '#0d4f48',
      cardBorder: '#2dd4bf',
    },
  },
  {
    id: 'blue',
    name: 'Blue',
    light: {
      primary: '#1976D2',
      primaryHover: '#1565C0',
      primaryForeground: '#ffffff',
      primaryLight: '#BBDEFB',
      gradientFrom: '#ffffff',
      gradientMid: '#EFF6FF',
      gradientTo: '#DBEAFE',
      cardBorder: '#1976D2',
    },
    dark: {
      primary: '#42A5F5',
      primaryHover: '#64B5F6',
      primaryForeground: '#0D1B2E',
      primaryLight: '#1E3A5F',
      gradientFrom: '#0D1B2E',
      gradientMid: '#0F2744',
      gradientTo: '#1A3A5C',
      cardBorder: '#42A5F5',
    },
  },
  {
    id: 'violet',
    name: 'Violet',
    light: {
      primary: '#7C3AED',
      primaryHover: '#6D28D9',
      primaryForeground: '#ffffff',
      primaryLight: '#EDE9FE',
      gradientFrom: '#ffffff',
      gradientMid: '#F5F3FF',
      gradientTo: '#EDE9FE',
      cardBorder: '#7C3AED',
    },
    dark: {
      primary: '#A78BFA',
      primaryHover: '#8B5CF6',
      primaryForeground: '#1E0A3C',
      primaryLight: '#2E1065',
      gradientFrom: '#0C0A09',
      gradientMid: '#1A0A2E',
      gradientTo: '#2E1065',
      cardBorder: '#A78BFA',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    light: {
      primary: '#E11D48',
      primaryHover: '#BE123C',
      primaryForeground: '#ffffff',
      primaryLight: '#FFE4E6',
      gradientFrom: '#ffffff',
      gradientMid: '#FFF1F2',
      gradientTo: '#FFE4E6',
      cardBorder: '#E11D48',
    },
    dark: {
      primary: '#FB7185',
      primaryHover: '#F43F5E',
      primaryForeground: '#2D0A15',
      primaryLight: '#4C0519',
      gradientFrom: '#1A0008',
      gradientMid: '#2D0A15',
      gradientTo: '#4C0519',
      cardBorder: '#FB7185',
    },
  },
  {
    id: 'orange',
    name: 'Orange',
    light: {
      primary: '#EA580C',
      primaryHover: '#C2410C',
      primaryForeground: '#ffffff',
      primaryLight: '#FFEDD5',
      gradientFrom: '#ffffff',
      gradientMid: '#FFF7ED',
      gradientTo: '#FFEDD5',
      cardBorder: '#EA580C',
    },
    dark: {
      primary: '#FB923C',
      primaryHover: '#F97316',
      primaryForeground: '#2C0D00',
      primaryLight: '#4A1500',
      gradientFrom: '#1A0800',
      gradientMid: '#2C1000',
      gradientTo: '#3D1500',
      cardBorder: '#FB923C',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    light: {
      primary: '#059669',
      primaryHover: '#047857',
      primaryForeground: '#ffffff',
      primaryLight: '#D1FAE5',
      gradientFrom: '#ffffff',
      gradientMid: '#ECFDF5',
      gradientTo: '#D1FAE5',
      cardBorder: '#059669',
    },
    dark: {
      primary: '#34D399',
      primaryHover: '#10B981',
      primaryForeground: '#022C22',
      primaryLight: '#064E3B',
      gradientFrom: '#011A14',
      gradientMid: '#022C22',
      gradientTo: '#064E3B',
      cardBorder: '#34D399',
    },
  },
  {
    id: 'indigo',
    name: 'Indigo',
    light: {
      primary: '#4338CA',
      primaryHover: '#3730A3',
      primaryForeground: '#ffffff',
      primaryLight: '#E0E7FF',
      gradientFrom: '#ffffff',
      gradientMid: '#EEF2FF',
      gradientTo: '#E0E7FF',
      cardBorder: '#4338CA',
    },
    dark: {
      primary: '#818CF8',
      primaryHover: '#6366F1',
      primaryForeground: '#0F0F3D',
      primaryLight: '#1E1B4B',
      gradientFrom: '#0A0A2E',
      gradientMid: '#0F0F3D',
      gradientTo: '#1E1B4B',
      cardBorder: '#818CF8',
    },
  },
];

export const DEFAULT_THEME_COLOR: ThemeColorId = 'teal';
export const STORAGE_KEY = 'maillet-theme-color';
