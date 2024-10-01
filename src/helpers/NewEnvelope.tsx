import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';

export const NewEnvelope = ({ id, callback }) => {
  const [categoryID, ] = useState(id);
  
  const handleSubmit = async () => {
    // Request we add the new category
    await axios.post(baseUrl + channels.ADD_ENVELOPE, { categoryID });
    
    callback();
  };  

  return (
    <button onClick={handleSubmit}>
        <FontAwesomeIcon icon={faPlus} />
    </button>
  );
};

export default NewEnvelope;