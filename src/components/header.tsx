// header.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoginButton from '../helpers/login.js';
import LogoutButton from '../helpers/logout.js';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import { baseUrl, channels } from '../shared/constants.js';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

const ADMIN_BIT = 128;

export const Header = ({currTab}) => {
  const { isAuthenticated } = useAuth0();
  const { config } = useAuthToken();

  const [year, setYear] = useState((new Date()).getFullYear());
  const [month, setMonth] = useState((new Date()).getMonth());
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {    
    const my_monthData_str = localStorage.getItem('transaction-month-data');
    let year = (new Date()).getFullYear();
    let month = (new Date()).getMonth();

    if (my_monthData_str?.length) {
      const my_monthData = JSON.parse(my_monthData_str);
      if (my_monthData) {
        let { childStartMonth, childCurIndex } = my_monthData;
        const child_start = new Date(childStartMonth);
        const child_month = child_start.getMonth();
        const child_year = child_start.getFullYear();
        let tmpDate = new Date(child_year, child_month + childCurIndex);
        year = tmpDate.getFullYear();
        month = tmpDate.getMonth();
      }
    }

    setYear(year);
    setMonth(month);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !config) return;
    const checkAdmin = async () => {
      try {
        const response = await axios.get(baseUrl + channels.GET_PROFILE, config);
        const level = response.data?.subscriptionLevel ?? 0;
        setIsAdmin((level & ADMIN_BIT) !== 0);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [isAuthenticated, config]);

  return (
    <div className="NavBar">
      <Link to="/" className={currTab === "Home"?"menuLink menuLink-selected":"menuLink"}>Home</Link>
      { isAuthenticated && <Link to="/Charts/env-2" className={currTab === "Charts"?"menuLink menuLink-selected":"menuLink"}>Charts</Link> }
      { isAuthenticated && <Link to={"/Transactions/-1/-3/0/"+year+"/"+month} className={currTab === "Transactions"?"menuLink menuLink-selected":"menuLink"}>Transactions</Link> }
      { isAuthenticated && <Link to="/Envelopes" className={currTab === "Envelopes"?"menuLink menuLink-selected":"menuLink"}>Envelopes</Link> }
      { isAuthenticated && <Link to="/Configure" className={currTab === "Configure"?"menuLink menuLink-selected":"menuLink"}>Configure</Link> }
      { isAuthenticated && isAdmin && <Link to="/Admin" className={currTab === "Admin"?"menuLink menuLink-selected":"menuLink"}>Admin</Link> }
      { !isAuthenticated && <LoginButton/> }
      { isAuthenticated && <LogoutButton/> }
    </div>
  );
};

export default Header;