import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js'
import { Link } from 'react-router-dom';
import BudgetBalanceModal from './BudgetBalanceModal.tsx';
import InputText from '../helpers/InputText.tsx';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

const red_color = '#dd8888';

export const EnvelopeRow = ({ item, year, month, curMonth, transferEnvList, onRowUpdate, onBalanceTransfer }) => {
  const { config } = useAuthToken();

  // Add local state to track the item's values
  const [localItem, setLocalItem] = useState(item);

  // Update local state when prop changes
  useEffect(() => {
    setLocalItem(item);
  }, [item]);

  const [cellColors, setCellColors] = useState({
    currBalanceColor: 'transparent',
    currBudgetColor: 'transparent',
    currActualColor: 'transparent',
  });

  useEffect(() => {
    // Update cell colors based on localItem instead of item
    const newColors = {
      currBalanceColor: localItem.currBalance < 0 ? red_color : 'transparent',
      currBudgetColor: -1*localItem.monthlyAvg > localItem.currBudget ? red_color : 'transparent',
      currActualColor: -1*localItem.currActual > localItem.currBudget ? red_color : 'transparent',
    };
    setCellColors(newColors);
  }, [localItem.currBalance, localItem.currBudget, localItem.currActual, localItem.monthlyAvg]);

  function formatCurrency(currencyNumber:number) {
    if (currencyNumber) {
      return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
    } else {
      const tmp_currency = 0;
      return tmp_currency.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
    }
  };

  const handleUpdateBudget = async ({ id, date, value }) => {
    // Request we update the DB
    if (!config) return;
    await axios.post(baseUrl + channels.UPDATE_BUDGET, 
      { newEnvelopeID: id, newtxDate: date, newtxAmt: value }, config);
    
    const oldValue = localItem.currBudget;
    // Create a new object for the updated item
    const updatedItem = {
      ...localItem,
      currBudget: parseFloat(value),
      currBalance: localItem.currBalance + (parseFloat(value) - oldValue)
    };
    
    // Update local state with the new object
    setLocalItem(updatedItem);
    
    // Notify parent of the update
    onRowUpdate(updatedItem);
  };

  const handleBalanceChange = async ({ newAmt }) => {
    const updatedItem = {
      ...localItem,
      currBalance: parseFloat(newAmt)
    };
    setLocalItem(updatedItem);
    onRowUpdate(updatedItem);
  };

  const handleBalanceTransfer = async ({ transferAmt, toID }) => {
    const updatedItem = {
      ...localItem,
      currBalance: localItem.currBalance - parseFloat(transferAmt)
    };
    setLocalItem(updatedItem);
    onBalanceTransfer({ updatedRow: updatedItem, transferAmt, toID });
  };

  return (
    <tr key={localItem.envID} className="TR">
      <td className="Table TC Left">{localItem.envelope}</td>
      <td className="Table TC Right">{formatCurrency(localItem.prevBudget)}</td>
      <td className="Table TC Right">
        <Link to={
          "/Transactions" +
          "/-1/" + localItem.envID + 
          "/1/" + new Date(year, month-1).getFullYear() + 
          "/" + new Date(year, month-1).getMonth()}>
          {formatCurrency(localItem.prevActual)}
        </Link>
      </td>
      <td className="Table Right TCInput"
        style={{ backgroundColor: cellColors.currBalanceColor }}>
        <BudgetBalanceModal 
          balanceAmt={localItem.currBalance}
          category={localItem.category}
          envelope={localItem.envelope}
          envID={localItem.envID}
          transferEnvList={transferEnvList}
          callback_transfer={handleBalanceTransfer}
          callback_change={handleBalanceChange}
        />
      </td>
      <td className="Table Right">
        <InputText
          in_ID={localItem.envID}
          in_value={localItem.currBudget}
          callback={(id, value) => {
            handleUpdateBudget({ id, date: curMonth, value });
          }}
          err_callback={null}
          className={"Curr"}
          style={{ paddingLeft: '2px', paddingRight: '2px', backgroundColor: cellColors.currBudgetColor }}
          isNum={true}
        />
      </td>
      <td className="Table TC Right"
        style={{ backgroundColor: cellColors.currActualColor }}>
        <Link to={"/Transactions/-1/" + localItem.envID + "/1/" + year + "/" + month}>
          {formatCurrency(localItem.currActual)}
        </Link>
      </td>
      <td className="Table TC Right">
        <Link to={"/Charts/env" + localItem.envID}>
          {formatCurrency(localItem.monthlyAvg)}
        </Link>
      </td>
    </tr>
  )
}