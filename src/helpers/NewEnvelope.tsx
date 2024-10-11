import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { Tooltip } from '@mui/material';


export const NewEnvelope = ({ id, callback }) => {
  const { config } = useAuthToken();

  const [categoryID, ] = useState(id);
  
  const handleSubmit = async () => {
    // Request we add the new category
    if (!config) return;
    await axios.post(baseUrl + channels.ADD_ENVELOPE, { categoryID }, config);
    
    callback();
  };  

  return (
    <Tooltip title="Add a new envelope to this category">
      <button onClick={handleSubmit}>
        <FontAwesomeIcon icon={faPlus} />
      </button>
    </Tooltip>
  );
};

export default NewEnvelope;