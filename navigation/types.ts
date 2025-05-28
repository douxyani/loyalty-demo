export type NavigationItem = {
    id: string;
    label: string;
    path: string;
    icon?: string; // Optional icon for the navigation item
    children?: NavigationItem[]; // Optional nested navigation items
};

export type NavigationConfig = {
    items: NavigationItem[];
    defaultPath?: string; // Optional default path for the navigation
};

export type RootStackParamList = {
  AuthScreen: undefined;
  VerifyEmailScreen: undefined;
  MainTabs: {
    screen?: keyof TabStackParamList;
    isAdmin: boolean;
    userId: string;
    email: string;
  };
  QRScannerScreen: {
    action: ActionType;
    adminUser: {
      userId: string;
      email: string;
    };
  };
  AdminResultScreen: {
    success: boolean;
    message: string;
    adminUser: {
      userId: string;
      email: string;
    };
  };
  ProfileScreen: {
    email: string;
  };
  RewardSettingsScreen: undefined;
};

export type TabStackParamList = {
  Home: {
    userId: string;
    email: string;
    isAdmin: boolean;
  };
  ProfileScreen: {
    email: string;
  };
  AdminScreen: {
    userId: string;
    email: string;
  };
};

export type ActionType = 'purchase1' | 'purchase2' | 'claim';