import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEyeSlash, faTrash } from "@fortawesome/free-solid-svg-icons";
import * as dayjs from 'dayjs';
import { EditText } from 'react-edit-text';
import { baseUrl, channels } from '../shared/constants.js';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

/*
  TODO:
  - sort by last tx date?
*/

export const ConfigAccount = () => {
  const { config } = useAuthToken();

  const [accountData, setAccountData] = useState<any[]>([]);

  const load_accounts = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ACCOUNTS, null, config);
    setAccountData(response.data);
  }

  const handleAccountDelete = async (id) => {
    // Request we delete the account in the DB
    if (!config) return;
    await axios.post(baseUrl + channels.DEL_ACCOUNT, {id}, config);
    load_accounts();
  };


  const handleAccountVisibility = async (id, isActive) => {
    // Request we delete the account in the DB
    if (!config) return;
    await axios.post(baseUrl + channels.VIS_ACCOUNT, { id, value: ( isActive ? false : true ) }, config);
    load_accounts();
  };

  useEffect(() => {
    load_accounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!accountData?.length) {
    return (
      <></>
    );
  }

  return (
    <table className="Table" cellSpacing={0} cellPadding={0}>
    <thead>
      <tr className="Table THR">
        <th className="Table THR THRC">{'Account'}</th>
        <th className="Table THR THRC">{'Name'}</th>
        <th className="Table THR THRC">{'Last Tx'}</th>
        <th className="Table THR THRC">{'Num Tx'}</th>
        <th className="Table THR THRC">{'Vis'}</th>
        <th className="Table THR THRC">{'Del'}</th>
      </tr>
    </thead>

    <tbody>
      {
        accountData.map(({ id, refNumber, account, isActive, lastTx, numTx }, index) => (
          <tr key={"acc-" + id} className="Table TR">
            <td className="Table TC Left">{refNumber}</td>
            <td className="Table TC Left">
              
              <EditText
                name={id.toString()}
                defaultValue={account}
                onSave={({name, value, previousValue}) => {
                  // Request we rename the account in the DB
                  if (!config) return;
                  axios.post(baseUrl + channels.UPDATE_ACCOUNT, { id, new_value: value }, config);
                }}
                style={{padding: '0px', margin: '0px', minHeight: '1rem'}}
                className={"editableText"}
                inputClassName={"normalInput"}
              />
            </td>
            <td className="Table TC Right">{lastTx && dayjs(lastTx).format('M/D/YYYY')}</td>
            <td className="Table TC Right">{numTx}</td>
            <td className="Table TC">
              <div 
                className={"Toggle" + (!isActive?" Toggle-active":"")}
                onClick={() => handleAccountVisibility(id, isActive)}>
                  <FontAwesomeIcon icon={faEyeSlash} />
              </div>
            </td>
            <td className="Table TC">
              { numTx === '0' &&
                <button 
                  className="trash"
                  onClick={() => handleAccountDelete(id)}>
                    <FontAwesomeIcon icon={faTrash} />
                </button>
              }
            </td>
          </tr>
        ))
      }
    </tbody>
  </table>
  );
};


export default ConfigAccount;