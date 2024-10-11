import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import axios from 'axios';
//import base64URLEncode from 'base64url';
//import crypto from 'crypto-browserify';
import { baseUrl, channels, auth0data } from '../shared/constants.js';

/*
REFRESH TOKEN: These functions were used to generate the verifier and challenge

// Function to generate a random string
const generateRandomString = (length) => {
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('');
};

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
*/

const LoginButton = () => {
  console.log("LoginButton");
  const { loginWithRedirect } = useAuth0();
  
  /*
  REFRESH TOKEN: this was manual calls so we can intercept the callback
    in order to capture the authorization code.

  const handleLogin = async () => {
    console.log("handleLogin");
    try {
      // Generate and store code_verifier
      const codeVerifier = generateRandomString(32);
      sessionStorage.setItem('code_verifier', codeVerifier);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      const authUrl = 'https://'+ auth0data.domain + '/authorize?' +
      'response_type=code&' +
      'client_id='+ auth0data.clientId + '&' +
      'redirect_uri='+ auth0data.redirectURL + '&' +
      'code_challenge='+ codeChallenge + '&' +
      'code_challenge_method=S256&' +
      'scope=offline_access openid profile';

      // Redirect to Auth0 authorization endpoint
      window.location.href = authUrl;
  */
      /* Previously commented out
      await loginWithRedirect({
        authorizationParams: {
          response_type: 'code',
          client_id: auth0data.clientId,
          redirect_uri: `${window.location.origin}`,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          audience: auth0data.audience,
          scope: 'offline_access openid profile',
        },
      });
      */
  /* REFRESH TOKEN: this was part of the refresh token code, just commenting
      it out since there was already a commented out section right above this.
    } catch (error) {
      console.error('Error during login:', error);
    }
  };
  */

  /* REFRESH TOKEN: This was calling our specific login handler
  return (
    <span onClick={handleLogin} className={"menuLink"}>Log In</span>
  );
  */

  return (
    <span onClick={() => loginWithRedirect()} className={"menuLink"}>Log In</span>
  );
};

export default LoginButton;