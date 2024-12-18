// header.js
import React from 'react';
import { Link } from 'react-router-dom';
import LoginButton from '../helpers/login.js';
import LogoutButton from '../helpers/logout.js';
import { useAuth0 } from '@auth0/auth0-react';

export const HeaderMobile = ({currTab}) => {
  const { isAuthenticated } = useAuth0();

  return (
    <div className="NavBar">
      <div className="NavLeft">
        <Link to="/" className={currTab === "Home"?"menuLink menuLink-selected":"menuLink"}>Home</Link>
      </div>
      <div className="NavRight">
        { !isAuthenticated && <LoginButton/> }
        { isAuthenticated && 
          <>
            <Link to="/ProfileMobile" className={currTab === "ProfileMobile"?"menuLink menuLink-selected":"menuLink"}>Profile</Link>
            <LogoutButton/>
          </>
        }
      </div>
    </div>
  );
};

export default HeaderMobile;