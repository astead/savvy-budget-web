import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { baseUrl, channels, auth0data } from './shared/constants.js';
import { Auth0Provider } from '@auth0/auth0-react';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import './includes/styles.css';
import Loading from './helpers/loading.js';
import { HomePage } from './components/homePage.tsx';
import { Charts } from './components/Charts.tsx';
import { Transactions } from './components/Transactions.tsx';
import { Envelopes } from './components/Envelopes.tsx';
import { Configure } from './components/Configure.tsx';
import { Callback } from './components/Callback.tsx';
import { AuthTokenProvider } from './context/AuthTokenContext.tsx';


export const App: React.FC = () => {
  console.log("App");

  const [auth_token, setAuth_token] = useState<string | null>(null);
  const [config, setConfig] = useState<{ headers: { Authorization: string } } | null>(null);

  const { isLoading, user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  
  useEffect(() => {
    console.log("App.tsx useEffect: [isAuthenticated, user, getAccessTokenSilently]");

    const checkOrCreateUser = async () => {
      console.log("App.tsx checkOrCreateUser");
      if (isAuthenticated && user) {
        console.log("authenticated and we have a user.");
        const accessToken = await getAccessTokenSilently();
        const config = {
          headers: { Authorization: `Bearer ${accessToken }` }
        };
        setAuth_token(accessToken );
        setConfig({ headers: { Authorization: `Bearer ${accessToken}` } });

        try {
          console.log("Calling AUTH0_CHECK_CREATE_USER from App.checkOrCreateUser");
          // Check or create user in a single API call
          await axios.post(baseUrl + channels.AUTH0_CHECK_CREATE_USER, 
            { user, refreshToken: accessToken }, config);
        } catch (error) {
          console.error('Error checking or creating user:', error);
        }
      } else {
        console.log("isAuthenticated: ", isAuthenticated);
        console.log("user: ", user);
      }
    };

    checkOrCreateUser();
    //getAccessTokenSilently();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  return (
    
    
      <AuthTokenProvider auth_token={auth_token} config={config}>
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/Charts/:in_envID" element={<Charts />} />
          <Route path="/Transactions/:in_catID/:in_envID/:in_force_date/:in_year/:in_month" element={<Transactions />} />
          <Route path="/Envelopes" element={<Envelopes />} />
          <Route path="/Configure" element={<Configure />} />
        </Routes>
      </AuthTokenProvider>
    
  );
};