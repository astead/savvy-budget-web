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

  const [cellColors, setCellColors] = useState({
    currBalanceColor: 'transparent',
    currBudgetColor: 'transparent',
    currActualColor: 'transparent',
  });

  useEffect(() => {
    // Update cell colors based on rowData
    const newColors = {
      currBalanceColor: item.currBalance < 0 ? red_color : 'transparent',
      currBudgetColor: -1*item.monthlyAvg > item.currBudget ? red_color : 'transparent',
      currActualColor: -1*item.currActual > item.currBudget ? red_color : 'transparent',
    };
    setCellColors(newColors);
  }, [item.currBalance, item.currBudget, item.currActual, item.monthlyAvg]);

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
    
    const oldValue = item.currBudget;
    item.currBudget = parseFloat(value);
    item.currBalance += value - oldValue;

    onRowUpdate(item);
  };

  const handleBalanceChange = async ({ newAmt }) => {
    item.currBalance = parseFloat(newAmt);
    onRowUpdate(item);
  };

  const handleBalanceTransfer = async ({ transferAmt, toID }) => {
    item.currBalance -= parseFloat(transferAmt);
    onBalanceTransfer({ updatedRow: item, transferAmt, toID });
  };

  return (
    <tr key={item.envID} className="TR">
      <td className="Table TC Left">{item.envelope}</td>
      <td className="Table TC Right">{formatCurrency(item.prevBudget)}</td>
      <td className="Table TC Right">
        <Link to={
          "/Transactions" +
          "/-1/" + item.envID + 
          "/1/" + new Date(year, month-1).getFullYear() + 
          "/" + new Date(year, month-1).getMonth()}>
          {formatCurrency(item.prevActual)}
        </Link>
      </td>
      <td className="Table BTC Right TCInput"
        style={{ backgroundColor: cellColors.currBalanceColor }}>
        <BudgetBalanceModal 
          balanceAmt={item.currBalance}
          category={item.category}
          envelope={item.envelope}
          envID={item.envID}
          transferEnvList={transferEnvList}
          callback_transfer={handleBalanceTransfer}
          callback_change={handleBalanceChange}
        />
      </td>
      <td className="Table TC Right">
        <InputText
          in_ID={item.envID}
          in_value={item.currBudget}
          callback={(id, value) => {
            handleUpdateBudget({ id, date: curMonth, value });
          }}
          err_callback={null}
          className={"Curr"}
          style={{ backgroundColor: cellColors.currBudgetColor }}
          isNum={true}
        />
      </td>
      <td className="Table TC Right"
        style={{ backgroundColor: cellColors.currActualColor }}>
        <Link to={"/Transactions/-1/" + item.envID + "/1/" + year + "/" + month}>
          {formatCurrency(item.currActual)}
        </Link>
      </td>
      <td className="Table TC Right">
        <Link to={"/Charts/env" + item.envID}>
          {formatCurrency(item.monthlyAvg)}
        </Link>
      </td>
    </tr>
  )
}