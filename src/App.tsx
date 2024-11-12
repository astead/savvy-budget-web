import React, { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { baseUrl, channels } from './shared/constants.js';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import './includes/styles.css';
import { HomePage } from './components/homePage.tsx';
import { HomePageMobile } from './components/homePageMobile.tsx';
import { ProfileMobile } from './components/ProfileMobile.tsx';
import { Charts } from './components/Charts.tsx';
import { Transactions } from './components/Transactions.tsx';
import { TransactionsMobile } from './components/TransactionsMobile.tsx';
import { Envelopes } from './components/Envelopes.tsx';
import { EnvelopesMobile } from './components/EnvelopesMobile.tsx';
import { Configure } from './components/Configure.tsx';
import { AccountsMobile } from './components/AccountsMobile.tsx';
import { Callback } from './components/Callback.tsx';
import { AuthTokenProvider } from './context/AuthTokenContext.tsx';
import { isMobile } from'./detectMobile.js';
import PrivateRoute from './components/PrivateRoute.tsx';
import useAxiosInterceptor from './useAxiosInterceptor.tsx';

export const App: React.FC = () => {
  const [auth_token, setAuth_token] = useState<string | null>(null);
  const [config, setConfig] = useState<{ headers: { Authorization: string } } | null>(null);
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  
  useAxiosInterceptor();

  useEffect(() => {
    //console.log("App.tsx useEffect: [isAuthenticated, user, getAccessTokenSilently]");

    if (isMobile()) {
      document.body.classList.add('mobile-body');
    } else {
      document.body.classList.remove('mobile-body');
    }

    const checkOrCreateUser = async () => {
      //console.log("App.tsx checkOrCreateUser");
      if (isAuthenticated && user) {
        //console.log("authenticated and we have a user.");
        const accessToken = await getAccessTokenSilently();
        const config = {
          headers: { Authorization: `Bearer ${accessToken }` }
        };
        setAuth_token(accessToken );
        setConfig({ headers: { Authorization: `Bearer ${accessToken}` } });

        try {
          //console.log("Calling AUTH0_CHECK_CREATE_USER from App.checkOrCreateUser");
          // Check or create user in a single API call
          await axios.post(baseUrl + channels.AUTH0_CHECK_CREATE_USER, 
            { user }, config);
        } catch (error) {
          console.error('Error checking or creating user:', error);
        }
      } else {
        //console.log("isAuthenticated: ", isAuthenticated);
        //console.log("user: ", user);
      }
    };

    checkOrCreateUser();
    //getAccessTokenSilently();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  return (
    
    
      <AuthTokenProvider auth_token={auth_token} config={config}>
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/" element={( isMobile() ) ? <HomePageMobile/> : <HomePage />} />
          <Route path="/ProfileMobile" element={<ProfileMobile />} />
          <Route path="/Transactions-mobile" element={<PrivateRoute element={TransactionsMobile} />} />
          <Route path="/Budget-mobile" element={<PrivateRoute element={EnvelopesMobile} />} />
          <Route path="/Accounts-mobile" element={<PrivateRoute element={AccountsMobile} />} />
          <Route path="/Charts/:in_envID" element={<PrivateRoute element={Charts} />} />
          <Route path="/Transactions/:in_catID/:in_envID/:in_force_date/:in_year/:in_month" element={<PrivateRoute element={Transactions} />} />
          <Route path="/Envelopes" element={<PrivateRoute element={Envelopes} />} />
          <Route path="/Configure" element={<PrivateRoute element={Configure} />} />
        </Routes>
      </AuthTokenProvider>
    
  );
};