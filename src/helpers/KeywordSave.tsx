import React, { useState, useEffect } from 'react';
import 'react-edit-text/dist/index.css';
import { baseUrl, channels } from '../shared/constants.js';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

export const KeywordSave = ({txID, acc, envID, description, keywordEnvID}) => {
  const { config } = useAuthToken();

  //const [my_txID, ] = useState(txID);
  const [my_envID, setEnvID] = useState(envID);
  const [my_description, setDescription] = useState(description);
  const [my_keywordEnvID, setKeywordEnvID] = useState(keywordEnvID);

  const saveKeyword = (e) => {
    // Don't allow setting a keyword if one already matches.
    if (keywordEnvID === null) {
      // Request we update the DB
      if (!config) return;
      axios.post(baseUrl + channels.SAVE_KEYWORD, { acc: acc, envID: my_envID, description: my_description }, config);
      
      // Rather than wait for the DB and re-query
      // let's just set this to our own env ID
      setKeywordEnvID(my_envID);
    }
  };

  useEffect(() => {
    setEnvID(envID);
  }, [envID]);

  useEffect(() => {
    setDescription(description);
  }, [description]);

  useEffect(() => {
    setKeywordEnvID(keywordEnvID);
  }, [keywordEnvID]);

  return (
    <div
      onClick={saveKeyword}
      className={"Toggle" + (my_keywordEnvID === my_envID && my_envID !== null ?" Toggle-active":"")}>
      <FontAwesomeIcon icon={faBookmark} />
    </div>
  );
};

export default KeywordSave;