import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import { baseUrl, channels } from './shared/constants.js';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import './includes/styles.css';
import Loading from './helpers/loading.js';
import { HomePage } from './components/homePage.tsx';
import { Charts } from './components/Charts.tsx';
import { Transactions } from './components/Transactions.tsx';
import { Envelopes } from './components/Envelopes.tsx';
import { Configure } from './components/Configure.tsx';
import { AuthTokenProvider } from './context/AuthTokenContext.tsx';


export const App: React.FC = () => {

  const [auth_token, setAuth_token] = useState<string | null>(null);
  const [config, setConfig] = useState<{ headers: { Authorization: string } } | null>(null);

  const { isLoading, user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const checkOrCreateUser = async () => {
      if (isAuthenticated && user) {
        const token = await getAccessTokenSilently();
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        setAuth_token(token);
        setConfig({ headers: { Authorization: `Bearer ${token}` } });

        try {
          // Check or create user in a single API call
          await axios.post(baseUrl + channels.AUTH0_CHECK_CREATE_USER, { user }, config);
        } catch (error) {
          console.error('Error checking or creating user:', error);
        }
      }
    };

    checkOrCreateUser();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  if (isLoading) {
    return <Loading />;
  }
  
  return (
    <AuthTokenProvider auth_token={auth_token} config={config}>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/Charts/:in_envID" element={<Charts />} />
          <Route path="/Transactions/:in_catID/:in_envID/:in_force_date/:in_year/:in_month" element={<Transactions />} />
          <Route path="/Envelopes" element={<Envelopes />} />
          <Route path="/Configure" element={<Configure />} />
        </Routes>
      </Router>
    </AuthTokenProvider>
  );
};