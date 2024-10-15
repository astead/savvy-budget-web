import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import { KeywordSave } from '../helpers/KeywordSave.tsx';
import * as dayjs from 'dayjs';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import SplitTransactionModal from './SplitTransactionModal.tsx';
import { EditText } from 'react-edit-text';
import { EditDate } from '../helpers/EditDate.tsx';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { Tooltip } from '@mui/material';

function formatCurrency(currencyNumber:number) {
  if (currencyNumber === null) {
    // TODO: why are we getting a null value?
    console.log("WARNING: we were asked to convert a null number to a currency string.");
    let tmpNumber = 0;
    return tmpNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
  }
  return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
}

export const TransactionTableRow = ({ index, item, envList, onRowUpdate, callback }) => {
  const { config } = useAuthToken();

  const [envStyle, setEnvStyle] = useState('envelopeDropDown');
  const [rowStyle, setRowStyle] = useState('TR');
  const [duplicateStyle, setDuplicateStyle] = useState('Toggle');
  const [visibleStyle, setVisibleStyle] = useState('Toggle');

  const handleTxEnvChange = async ({id, new_value, new_text}) => {
    // Request we update the DB
    if (!config) return;
    await axios.post(baseUrl + channels.UPDATE_TX_ENV, { txID: id, envID: new_value }, config);
    
    item.envID = new_value;
    onRowUpdate(item);
  };

  const handleCheckChange = async () => {
    onRowUpdate({ ...item, isChecked: !item.isChecked });
  };

  const toggleDuplicate = async ({txID, isDuplicate}) => {
    // Request we update the DB
    if (!config) return;
    await axios.post(baseUrl + channels.SET_DUPLICATE, { txID: txID, isDuplicate: isDuplicate }, config);
    
    item.isDuplicate = isDuplicate;
    onRowUpdate(item);
  };

  const toggleVisibility = async ({txID, isVisible}) => {
    // Request we update the DB
    if (!config) return;
    await axios.post(baseUrl + channels.SET_VISIBILITY, { txID: txID, isVisible: isVisible }, config);
    
    item.isVisible = isVisible;
    onRowUpdate(item);
  };

  useEffect(() => {
    // Update cell colors based on rowData
    if (!item.envID || item.envID.toString() === "-1") {
      setEnvStyle("envelopeDropDown-undefined");
    } else {
      setEnvStyle("envelopeDropDown");
    }
  }, [item.envID]);

  useEffect(() => {
    // Update cell colors based on rowData
    if (item.isDuplicate === 1) {
      setRowStyle("TR-duplicate");
      setDuplicateStyle('Toggle Toggle-active');
    } else {
      setRowStyle("TR");
      setDuplicateStyle('Toggle');
    }
  }, [item.isDuplicate]);

  useEffect(() => {
    // Update cell colors based on rowData
    if (!item.isVisible) {
      setVisibleStyle('Toggle Toggle-active');
    } else {
      setVisibleStyle('Toggle');
    }
  }, [item.isVisible]);

  return (
    <tr className={rowStyle}>
      <td className="Table TC">
        <EditDate 
          in_ID={item.txID.toString()}
          in_value={dayjs(item.txDate).format('M/D/YYYY')}
          callback={({id, value}) => {
            if (!config) return;
            axios.post(baseUrl + channels.UPDATE_TX_DATE, { txID: item.txID, new_value: value }, config);
          }}
        />
      </td>
      <td className="Table TC Left">
        <Tooltip title={item.full_account_name} arrow>
          <span>{item.common_name}</span>
        </Tooltip>
      </td>
      <td className="Table TC Left" style={{ minWidth: 200, maxWidth: '35vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Tooltip title={item.description} arrow><span>
          <EditText
            name={item.txID.toString()}
            defaultValue={item.description}
            onSave={({name, value, previousValue}) => {
              // Request we rename the account in the DB
              if (!config) return;
              axios.post(baseUrl + channels.UPDATE_TX_DESC, { txID: item.txID, new_value: value }, config);
            }}
            style={{padding: '0px', margin: '0px', minHeight: '1rem'}}
            className={"editableText"}
            inputClassName={"normalInput"}
          />
        </span></Tooltip>
      </td>
      <td className="Table TC Right">{formatCurrency(item.txAmt)}</td>
      <td className="Table TC TCInput">
        <DropDown 
          id={item.txID}
          selectedID={item.envID}
          optionData={envList}
          changeCallback={handleTxEnvChange}
          className={envStyle}
        />
      </td>
      <td className="Table TC">
        <SplitTransactionModal 
            txID={item.txID}
            txDate={item.txDate}
            txAmt={ ( !item.txAmt ) ? 0 : item.txAmt }
            txDesc={item.description}
            cat={item.category}
            env={item.envelope}
            envID={item.envID}
            isSplit={item.isSplit}
            envList={envList}
            callback={callback}
          />
      </td>
      <td className="Table TC">
          <KeywordSave
            txID={item.txID}
            acc={item.common_name}
            envID={item.envID}
            description={item.description}
            keywordEnvID={item.keywordEnvID}
            callback={callback}
          />
      </td>
      <td className="Table TC">
        <div
          onClick={() => {
            toggleDuplicate({txID: item.txID, isDuplicate: (item.isDuplicate === 1 ? 0 : 1)});
          }}
          className={duplicateStyle}>
          <FontAwesomeIcon icon={faCopy} />
        </div>
      </td>
      <td className="Table TC">
        <div
          onClick={() => {
            toggleVisibility({txID: item.txID, isVisible: ( item.isVisible ? false : true)});
          }}
          className={visibleStyle}>
          <FontAwesomeIcon icon={faEyeSlash} />
        </div>
      </td>
      <td className="Table TC">
        <input
          type="checkbox"
          id={item.txID.toString()}
          onChange={handleCheckChange}
          checked={item.isChecked}
        />
      </td>
    </tr>
  );
}