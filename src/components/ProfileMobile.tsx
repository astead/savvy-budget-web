import React, { useState, useEffect } from 'react';
import { FooterMobile } from './FooterMobile.tsx';
import { useAuth0 } from '@auth0/auth0-react';
import { HeaderMobile } from './headerMobile.tsx';
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';
import { Button, TextField, Box, Checkbox, FormControlLabel, FormGroup, Typography } from '@mui/material';

const SubscriptionLevels = {
  FREE: 0,                  // 0000
  LINKED_BANK_ACCOUNTS: 1,  // 0001
};

function hasSubscription(level, flag) {
  return (level & flag) !== 0;
}

export const ProfileMobile: React.FC = () => {
  const [deleteInputText, setDeleteInputText] = useState<string>("");
  const [cancelInputText, setCancelInputText] = useState<string>("");
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

  const handleCancelSubscription = async () => {
    if (cancelInputText !== "CANCEL LINKED BANK ACCOUNTS") {
      alert("Please type 'CANCEL LINKED BANK ACCOUNTS' to confirm.");
      return;
    }

    const newLevel =
      subscriptionLevel & ~SubscriptionLevels.LINKED_BANK_ACCOUNTS;
    
    setSubscriptionLevel(newLevel);
    setCancelInputText("");
    
    try {
      const response = await axios.post(
        baseUrl + channels.UPDATE_SUBSCRIPTION,
        { subscriptionLevel: newLevel }
      );
      if (response.status !== 200) {
        alert("Failed to cancel subscription.");
      }
    } catch (error) {
      alert("Error: Failed to cancel subscription.");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInputText !== "DELETE ACCOUNT") {
      alert("Please type 'DELETE ACCOUNT' to confirm.");
      return;
    }

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
        <HeaderMobile currTab="ProfileMobile" />
      </div>
      <div className="main-page-body-text-mobile">
        <Box mt={0} p={2} border="1px solid grey" borderRadius="5px">
          <Typography variant="h6">
          Subscription Options
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={true}
                  onChange={handleCheckboxChange}
                  name="FREE"
                  disabled // 'Free' is the default level, thus disabled
                />
              }
              label="Free"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={hasSubscription(
                    subscriptionLevel,
                    SubscriptionLevels.LINKED_BANK_ACCOUNTS
                  )}
                  onChange={handleCheckboxChange}
                  name="LINKED_BANK_ACCOUNTS"
                  disabled={hasSubscription(
                    subscriptionLevel,
                    SubscriptionLevels.LINKED_BANK_ACCOUNTS
                  )}
                />
              }
              label="Linked Bank Accounts  ( $5 / month )"
            />
            {/* Add more features as needed */}
          </FormGroup>
        </Box>

        { hasSubscription(
          subscriptionLevel,
          SubscriptionLevels.LINKED_BANK_ACCOUNTS
        ) && (
          <Box mt={0} p={2} border="1px solid grey" borderRadius="5px">
            <Typography variant="h6">
              Cancel Linked Bank Accounts
            </Typography>
            <Typography variant="body2">
              Removing this subscription will unlink your bank accounts and you
              won't be able to automatically pull new transactions.
              To confirm cancellation, type 'CANCEL LINKED BANK ACCOUNTS' below
              and click the cancel button.
            </Typography>
            <TextField
              id="cancel-input"
              value={cancelInputText}
              onChange={(e) => setCancelInputText(e.target.value)}
              style={{ width: "100%", marginTop: "10px" }}
            />
            <Button
              variant="contained"
              className="textButton"
              style={{ backgroundColor: "Salmon", marginTop: "10px" }}
              onClick={handleCancelSubscription}
              disabled={cancelInputText !== "CANCEL LINKED BANK ACCOUNTS"}
            >
              Cancel Subscription
            </Button>
          </Box>
        )}

        <Box mt={0} p={2} border="1px solid grey" borderRadius="5px">
          <Typography variant="h6">
            Delete Account
          </Typography>
          <Typography variant="body2">
            This will delete your account and all your data. There is no
            recovering from this, you will have to start over if you want to.
            To proceed, type 'DELETE ACCOUNT' in all caps and hit the delete button.
          </Typography>
          
            <TextField
              id="delete-check"
              value={deleteInputText}
              onChange={(e) => setDeleteInputText(e.target.value)}
              style={{ width: "100%", marginTop: "10px" }}
              className={"inputField"}
            />
            <Button
              variant="contained"
              className="textButton"
              style={{ backgroundColor: "Salmon", marginTop: "10px" }}
              onClick={handleDeleteAccount}
              disabled={deleteInputText !== "DELETE ACCOUNT"}
            >
              DELETE ACCOUNT
            </Button>
          </Box>
      </div>
      {isAuthenticated && <FooterMobile defaultValue={null} />}
    </>
  );
};
