import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { Callback } from './components/Callback.tsx';
import { App } from './App.tsx';
import { baseUrl, channels, auth0data } from './shared/constants.js';


export const Home: React.FC = () => {
  console.log("Home");

  return (
    <Auth0Provider
      domain={auth0data.domain}
      clientId={auth0data.clientId}
      //useRefreshTokens={true}
      //cacheLocation="localstorage"
      authorizationParams={{
        //redirect_uri: `${window.location.origin}/callback`,
        audience: auth0data.audience,
      }}
    >
      <Routes>
        <Route path="/*" element={<App />} />
      </Routes>
    </Auth0Provider>
  );
};