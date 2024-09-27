import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons"
import { channels } from '../shared/constants.js';
import axios from 'axios';

export const NewCategory = ({ callback }) => {
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = async () => {
    if (newCategory) {
      // Request we add the new category
      await axios.post('http://localhost:3001/api/' + channels.ADD_CATEGORY, { name: newCategory });
      
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