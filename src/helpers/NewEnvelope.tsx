import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';


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
    <button onClick={handleSubmit}>
        <FontAwesomeIcon icon={faPlus} />
    </button>
  );
};

export default NewEnvelope;