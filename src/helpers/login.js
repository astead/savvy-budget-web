import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import axios from 'axios';
//import base64URLEncode from 'base64url';
//import crypto from 'crypto-browserify';
import { baseUrl, channels, auth0data } from '../shared/constants.js';


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

const LoginButton = () => {
  console.log("LoginButton");
  const { loginWithRedirect } = useAuth0();
  
  const handleLogin = async () => {
    console.log("handleLogin");
    try {
      // Generate and store code_verifier
      //const codeVerifier = base64URLEncode(crypto.randomBytes(32));
      //sessionStorage.setItem('code_verifier', codeVerifier);

      // Generate code_challenge and initiate authorization request
      //const codeChallenge = base64URLEncode(crypto.createHash('sha256').update(codeVerifier).digest());

      const codeVerifier = generateRandomString(32);
      sessionStorage.setItem('code_verifier', codeVerifier);
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      console.log('Code Verifier:', codeVerifier);
      console.log('Code Challenge:', codeChallenge);

      
      const authUrl = 'https://'+ auth0data.domain + '/authorize?' +
      'response_type=code&' +
      'client_id='+ auth0data.clientId + '&' +
      'redirect_uri='+ auth0data.redirectURL + '&' +
      'code_challenge='+ codeChallenge + '&' +
      'code_challenge_method=S256&' +
      'scope=offline_access openid profile';

      // Redirect to Auth0 authorization endpoint
      window.location.href = authUrl;
      
      /*
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
      
      



    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  return (
    <span onClick={handleLogin} className={"menuLink"}>Log In</span>
  );
};

export default LoginButton;