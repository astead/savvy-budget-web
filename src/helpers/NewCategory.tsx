import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

export const NewCategory = ({ callback }) => {
  const { config } = useAuthToken();

  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = async () => {
    if (newCategory) {
      // Request we add the new category
      if (!config) return;
      await axios.post(baseUrl + channels.ADD_CATEGORY, { name: newCategory }, config);
      
      callback();
    } else {
      setError("Please enter a new category name.");
    }
  };  

  return (
    <div className="new-category-container">
        <div className="new-category">
            <input
                type="text"
                id="new-category"
                value={newCategory}
                onChange={(e) => {
                  setNewCategory(e.target.value);
                  setError("");
                }}
                placeholder="Enter new category"
            />
            {error &&
              <><br/><span className="Red">{"Error: " + error}</span></>
            }
        </div>
        <button onClick={handleSubmit}>
            <FontAwesomeIcon icon={faPlus} />
        </button>
    </div>
  );
};

export default NewCategory;