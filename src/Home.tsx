import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { Callback } from './components/Callback.tsx';
import { App } from './App.tsx';
import { baseUrl, channels, auth0data } from './shared/constants.js';


export const Home: React.FC = () => {
  return (
    <Auth0Provider
      domain={auth0data.domain}
      clientId={auth0data.clientId}
      /* REFRESH TOKEN: This was previously commented out
      //useRefreshTokens={true}
      //cacheLocation="localstorage"
      */
      authorizationParams={{
        /* REFRESH TOKEN: This was previously commented out
        //redirect_uri: `${window.location.origin}/callback`,
        */
        redirect_uri: window.location.origin,
        audience: auth0data.audience,
      }}
    >
      <Routes>
        <Route path="/*" element={<App />} />
      </Routes>
    </Auth0Provider>
  );
};