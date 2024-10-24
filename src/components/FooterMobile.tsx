// header.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';

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
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
      <BottomNavigation
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
    </Paper>
  );
};

export default FooterMobile;