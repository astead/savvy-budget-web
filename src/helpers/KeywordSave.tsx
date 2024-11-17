import React, { useState, useEffect } from 'react';
import 'react-edit-text/dist/index.css';
import { baseUrl, channels } from '../shared/constants.js';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { isMobile } from '../detectMobile.js';

export const KeywordSave = ({ txID, acc, envID, description, keywordEnvID, callback }) => {
  const { config } = useAuthToken();

  //const [my_txID, ] = useState(txID);
  const [my_envID, setEnvID] = useState(envID);
  const [my_description, setDescription] = useState(description);
  const [my_keywordEnvID, setKeywordEnvID] = useState(keywordEnvID);

  const saveKeyword = async (e) => {
    // Don't allow setting a keyword if one already matches.
    if (keywordEnvID === null && my_envID !== '-1') {
      // Request we update the DB
      if (!config) return;
      await axios.post(baseUrl + channels.SAVE_KEYWORD, { acc: acc, envID: my_envID, description: my_description }, config);
      
      // Rather than wait for the DB and re-query
      // let's just set this to our own env ID
      setKeywordEnvID(my_envID);
      
      // Since we might have changed other items,
      // lets re-query the transaction list
      callback();
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
      className={
        (isMobile())
        ?
          (
            my_keywordEnvID === my_envID && 
            my_envID !== '-1' && 
            my_envID !== null
          ) ? "ToggleMobile-active" :
            (( my_envID !== '-1' ) ? "ToggleMobile" : "ToggleMobile-inactive")
        :
          (
            my_keywordEnvID === my_envID && 
            my_envID !== '-1' && 
            my_envID !== null
          ) ? "Toggle-active" :
            (( my_envID !== '-1' ) ? "Toggle" : "Toggle-inactive")
      }>
      <FontAwesomeIcon icon={faBookmark} />
    </div>
  );
};

export default KeywordSave;