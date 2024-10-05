import React, { useEffect, useRef } from 'react';
//import { useAuth0 } from '@auth0/auth0-react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { baseUrl, channels } from '../shared/constants.js';



// Function to base64 URL-encode a string
const base64URLEncode = (str) => {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Function to generate the code challenge from the code verifier
const generateCodeChallenge = async (verifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(digest);
};

export const Callback = () => {
  console.log("Callback");
  //const { handleRedirectCallback, user, getAccessTokenSilently } = useAuth0();
  const location = useLocation();
  const navigate = useNavigate();
	const shouldRedirect = useRef(true);

  useEffect(() => {
    console.log("Callback useEffect: [isAuthenticated, user, getAccessTokenSilently]");
    const handleAuth = async () => {
      try {
        if (shouldRedirect.current) {
          shouldRedirect.current = false;
  /*
          console.log("Callback component mounted");
          await handleRedirectCallback();
          console.log("handleRedirectCallback DONE");
  */
          const params = new URLSearchParams(location.search);
          console.log("params: ", params);
          const authorizationCode = params.get('code');
          console.log("authorizationCode: ", authorizationCode);
          
          if (authorizationCode) {
  /*
            console.log("calling getAccessTokenSilently to get access token");
            const accessToken = await getAccessTokenSilently();
            console.log("accessToken: ", accessToken);
            const config = {
              headers: { Authorization: `Bearer ${accessToken }` }
            };
  */
            // Retrieve code_verifier from session storage
            const codeVerifier = sessionStorage.getItem('code_verifier');
            sessionStorage.removeItem('code_verifier');

            const codeChallenge = await generateCodeChallenge(codeVerifier);
            console.log('Code Verifier:', codeVerifier);
            console.log('Expected Code Challenge:', codeChallenge);
           



            console.log("Calling AUTH0_GET_TOKENS from Callback");
            const response = await axios.post(baseUrl + channels.AUTH0_GET_TOKENS, 
              { authorizationCode: authorizationCode, codeVerifier: codeVerifier });

            console.log("We're back. Response is: ", response);
            navigate('/');
          }
        }
      } catch (error) {
        console.error('Error during handleRedirectCallback:', error);
      }
    };

    handleAuth();
  }, [location.search, navigate]);

  return (<div>Loading...</div>);
};

export default Callback;
