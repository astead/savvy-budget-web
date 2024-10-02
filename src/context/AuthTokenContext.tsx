import React, { createContext, useContext, ReactNode } from 'react';

interface AuthTokenProviderProps {
  auth_token: string | null;
  config: { headers: { Authorization: string } } | null;
  children: ReactNode;
}

const AuthTokenContext = createContext<{ auth_token: string | null; config: { headers: { Authorization: string } } | null }>({ auth_token: null, config: null });

export const useAuthToken = () => useContext(AuthTokenContext);

export const AuthTokenProvider: React.FC<AuthTokenProviderProps> = ({ auth_token, config, children }) => {
    return (
      <AuthTokenContext.Provider value={{ auth_token, config }}>
        {children}
      </AuthTokenContext.Provider>
    );
  };
