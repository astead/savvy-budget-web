import React, { useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';
import { Button, TextField, Box } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';

export const Profile: React.FC = () => {
  const [inputText, setInputText] = useState<string>("");
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true);
  const { logout } = useAuth0();

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

  return (
    <div style={{ textAlign: 'left' }}>
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
  );
};

export default Profile;
