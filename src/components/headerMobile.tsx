// header.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoginButton from '../helpers/login.js';
import LogoutButton from '../helpers/logout.js';
import { useAuth0 } from '@auth0/auth0-react';

export const HeaderMobile = ({currTab}) => {
  const { isAuthenticated } = useAuth0();

  return (
    <div className="NavBar">
      <Link to="/" className={currTab === "Home"?"menuLink menuLink-selected":"menuLink"}>Home</Link>
      { !isAuthenticated && <LoginButton/> }
      { isAuthenticated && <LogoutButton/> }
    </div>
  );
};

export default HeaderMobile;