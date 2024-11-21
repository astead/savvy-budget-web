import React, { useState, useEffect } from 'react';
import { FooterMobile } from './FooterMobile.tsx';
import { useAuth0 } from '@auth0/auth0-react';
import { HeaderMobile } from './headerMobile.tsx';
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';
import { Button, TextField, Box, Checkbox, FormControlLabel, FormGroup } from '@mui/material';

const SubscriptionLevels = {
  FREE: 0,                  // 0000
  LINKED_BANK_ACCOUNTS: 1,  // 0001
};

function hasSubscription(level, flag) {
  return (level & flag) !== 0;
}

export const ProfileMobile: React.FC = () => {
  const [inputText, setInputText] = useState<string>("");
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true);
  const [pageLoaded, setPageLoaded] = useState<boolean>(false);
  const [subscriptionLevel, setSubscriptionLevel] = useState<number>(0);
  const { isAuthenticated, logout } = useAuth0();


  const handleCheckboxChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = event.target;
    let newLevel = subscriptionLevel;
    if (checked) {
      newLevel |= SubscriptionLevels[name];
    } else {
      newLevel &= ~SubscriptionLevels[name];
    }
    setSubscriptionLevel(newLevel);
    try {
      const response = await axios.post(
        baseUrl + channels.UPDATE_SUBSCRIPTION,
        { subscriptionLevel: newLevel }
      );
      if (response.status !== 200) {
        alert("Failed to update subscription.");
      }
    } catch (error) {
      alert("Error: Failed to update subscription.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
    setIsButtonDisabled(value !== "DELETE");
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await axios.delete(baseUrl + channels.DELETE_PROFILE);
      if (response.status === 200) {
        logout({ logoutParams: { returnTo: window.location.origin } });
      } else {
        console.log('status: ', response.status);
        console.log('message: ', response.data.message);
        alert("Failed to delete account.");
      }
    } catch (error) {
      alert("Error: Failed to delete account.");
    }
  };

  const getProfile = async () => {
    const response = await axios.get(baseUrl + channels.GET_PROFILE);
    if (response.status === 200) {
      setSubscriptionLevel(response.data.subscriptionLevel);
    } else {
      console.log('status: ', response.status);
      console.log('message: ', response.data.message);
      alert("Failed to get account.");
    }
  }

  useEffect(() => {
    if (pageLoaded) {
      getProfile();
    }
  }, [pageLoaded]);

  useEffect(() => {
    setPageLoaded(true);
  }, []);
  
  return (
    <>
      <div className="App-header">
        <HeaderMobile currTab="ProfileMobile"/>
      </div>
      <div className="main-page-body-text-mobile">
        
        <b>SUBSCRIPTION LEVEL</b><br/>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox checked={true}
                onChange={handleCheckboxChange}
                name="FREE"
                disabled // 'Free' is the default level, thus disabled
              />
            } label="Free"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={hasSubscription(subscriptionLevel, SubscriptionLevels.LINKED_BANK_ACCOUNTS)}
                onChange={handleCheckboxChange}
                name="LINKED_BANK_ACCOUNTS"
              />
            } label="Linked Bank Accounts  ( $5 / month )"
          />
          {/* Add more features as needed */}
        </FormGroup>
        
        <br/><br/>
        
        <b>DELETE ACCOUNT</b><br/>
        To delete your account and all your data, type 'DELETE' in all caps and hit the delete button.<br/>
        <Box display="flex" alignItems="center" mt={2}>
          <TextField
            id="delete-check"
            value={inputText}
            onChange={handleInputChange}
            style={{ width: '200px', marginRight: '10px' }}
            className={"inputField"}
          />
          <Button
            variant="contained"
            className='textButton'
            style={{ backgroundColor: 'Salmon' }}
            onClick={handleDeleteAccount}
            disabled={isButtonDisabled}
          >
            DELETE ACCOUNT
          </Button>
        </Box>
      </div>
      { isAuthenticated && 
        <FooterMobile defaultValue={null} />
      }
    </>
  );
};
