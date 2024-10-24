// header.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';

import ReceiptIcon from '@mui/icons-material/Receipt';
import BalanceIcon from '@mui/icons-material/Balance';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

export const FooterMobile = ({ defaultValue }) => {
  const navigate = useNavigate();
  
  const [value, setValue] = useState<null | number>(defaultValue);
  
  const handleNavigation = (newValue: number) => {
    setValue(newValue);
    switch (newValue) {
      case 0:
        navigate('/Transactions-mobile');
        break;
      case 1:
        navigate('/Budget-mobile');
        break;
      case 2:
        navigate('/Accounts-mobile');
        break;
      default:
        break;
    }
  };

  return (
    <BottomNavigation
      sx={{ 
        width: '100%', 
        position: 'fixed', 
        bottom: 0,
        left: 0,
        backgroundColor: '#333', 
        color: '#fff', 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        padding: '0px 0',
        zIndex: 1000,
      }}
      showLabels
      value={value}
      onChange={(event, newValue) => {
        handleNavigation(newValue);
      }}

    >
      <BottomNavigationAction label="Transactions" icon={<ReceiptIcon />} />
      <BottomNavigationAction label="Budget" icon={<BalanceIcon />} />
      <BottomNavigationAction label="Accounts" icon={<AccountBalanceIcon />} />
    </BottomNavigation>
  );
};

export default FooterMobile;