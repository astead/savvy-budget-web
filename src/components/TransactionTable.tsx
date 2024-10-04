import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Pagination from '@mui/material/Pagination';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { TransactionTableRow } from './TransactionTableRow.tsx';

/*
 TODO:
  - popup window to add notes, tags, etc
*/

interface TransactionNodeData {
  txID: number;
  catID: number; 
  envID: number; 
  category: string;
  envelope: string; 
  accountID: number;  
  account: string;
  txAmt: number;
  txDate: number;
  description: string;
  keywordEnvID: number;
  isDuplicate: number;
  isVisible: boolean;
  isSplit: number;
  isChecked: boolean;
}

export const TransactionTable = ({data, envList, callback}) => {  
  const { config } = useAuthToken();

  // Other variables
  const [changeAllEnvID, setChangeAllEnvID] = useState(-1);

  // Transaction data
  const [txData, setTxData] = useState<TransactionNodeData[]>(data.map(item => ({ ...item, isChecked: false })));
  const [isAllChecked, setIsAllChecked] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  
  // Variables for data table paging
  const [pagingCurPage, setPagingCurPage] = useState(1);
  const [pagingPerPage, setPagingPerPage] = useState(50);
  const [pagingNumPages, setPagingNumPages] = useState(1);
  const [pagingTotalRecords, setPagingTotalRecords] = useState(0);

  function formatCurrency(currencyNumber:number) {
    if (currencyNumber === null) {
      // TODO: why are we getting a null value?
      console.log("WARNING: we were asked to convert a null number to a currency string.");
      let tmpNumber = 0;
      return tmpNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
    }
    return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD'});
  }

  const handlePageChange = (event, page: number) => {
    setPagingCurPage(page);
  };

  const handleNumPerPageChange = (event: SelectChangeEvent) => {
    setPagingPerPage(parseInt(event.target.value));
  };

  const look_for_dups = () => {
    const startIdx = (pagingCurPage - 1) * pagingPerPage;
    const endIdx = pagingCurPage * pagingPerPage;

    let found = false;
    const updatedData = txData.map((item, index) => {
      if (index >= startIdx && index < endIdx && item.isDuplicate === 1) {
        found = true;
        return { ...item, isChecked: true };
      }
      return item;
    });

    if (found) {
      setTxData(updatedData);
    } else {
      const newUpdatedData = txData.map((item, index, myArr) => {
        if (index >= startIdx && index < endIdx && myArr.find((item2, index2) => {
          let isMatch = (
            item.txID !== item2.txID &&
            item.txAmt === item2.txAmt &&
            item.txDate === item2.txDate &&
            item.description === item2.description &&
            index2 > index &&
            index2 < endIdx);
          return isMatch;
          })) {
          
          found = true;
          return { ...item, isChecked: true };
        }
        return item;
      });
      if (found) {
        setTxData(newUpdatedData);
      }
    }
  }

  const look_for_invisible = () => {
    const startIdx = (pagingCurPage - 1) * pagingPerPage;
    const endIdx = pagingCurPage * pagingPerPage;
    
    const updatedData = txData.map((item, index) => {
      if (index >= startIdx && index < endIdx && !item.isVisible) {
        return { ...item, isChecked: true };
      }
      return item;
    });

    setTxData(updatedData);
  }

  const delete_checked_transactions = async () => {
    const startIdx = (pagingCurPage - 1) * pagingPerPage;
    const endIdx = pagingCurPage * pagingPerPage;

    let filtered_nodes = txData.filter((item, index) => {
      return item.isChecked && index >= startIdx && index < endIdx;
    });
    // Signal we want to del data
    if (!config) return;
    await axios.post(baseUrl + channels.DEL_TX_LIST, { del_tx_list: filtered_nodes }, config);
  
    // Remove the deleted items from the local data set
    const updatedData = txData.filter((item, index) => {
      return !(item.isChecked && index >= startIdx && index < endIdx);
    });
  
    // Update the main data array
    setTxData(updatedData);

    // We want to ensure all items are unchecked, although
    // this should be happening anyway.
    setIsAllChecked(false);

    // Probably don't need to call the callback since we 
    // already made the changes in the local data array above.
    // Let's avoid the back and forth.
    //callback();
  }

  const handleCheckAll = (e) => {
    const checked = e.target.checked;
    const startIdx = (pagingCurPage - 1) * pagingPerPage;
    const endIdx = pagingCurPage * pagingPerPage;

    const updatedData = txData.map((item, index) => {
      if (index >= startIdx && index < endIdx) {
        return { ...item, isChecked: checked };
      }
      return item;
    });

    setTxData(updatedData);
    setIsAllChecked(checked);
  };

  const handleChangeAllEnvID = async ({id, new_value}) => {
    setChangeAllEnvID(new_value);
    const startIdx = (pagingCurPage - 1) * pagingPerPage;
    const endIdx = pagingCurPage * pagingPerPage;

    const updatedData = txData.map((item, index) => {
      if (index >= startIdx && index < endIdx && item.isChecked) {
       return { ...item, envID: new_value };
      }
      return item;
    });

    // Update the main data array
    setTxData(updatedData);

    // Signal we want to change the envelope for checked items.
    if (!config) return;
    await axios.post(baseUrl + channels.UPDATE_TX_ENV_LIST, 
      { new_value, filtered_nodes: updatedData.filter(item => item.isChecked) }, config);

    // Intentionally leave the checkboxes checked incase
    // we made a mistake and want to set those to something else
    // or back to the original value.
    //setIsAllChecked(false);

    // Probably don't need to call the callback since we 
    // already made the changes in the local data array above.
    // Let's avoid the back and forth.
    //callback();
  };

  const handleRowUpdate = (updatedRow) => {
    setTxData((prevData) =>
      prevData.map((row) => (row.txID === updatedRow.txID ? updatedRow : row))
    );
  };

  useEffect(() => {
    const updatedData = txData.map(item => ({ ...item, isChecked: false }));
    setTxData(updatedData);
    setIsAllChecked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagingCurPage, pagingPerPage, pagingTotalRecords]);

  useEffect(() => {
    const oldNumPer = Math.ceil(pagingTotalRecords / pagingNumPages);
    const oldItemIndex = (pagingCurPage - 1) * oldNumPer;
    const newItemIndex = Math.floor(oldItemIndex / pagingPerPage) + 1;
    setPagingCurPage(newItemIndex > 0 ? newItemIndex : 1);
    
    setPagingNumPages(Math.ceil(pagingTotalRecords / pagingPerPage));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagingPerPage]);
  
  useEffect(() => {
    const numtx = data?.length || 0;
    const oldnumtx = pagingTotalRecords;
    
    setPagingTotalRecords(numtx);
    setPagingNumPages(Math.ceil(numtx / pagingPerPage));
    
    const tmpData = [...data];
    setTxData(tmpData);
    
    // If our number of records changed, we likely have new data,
    // so reset our current page to the first one.
    // Also do this if our current page is past the max.
    if (pagingCurPage > Math.ceil(numtx / pagingPerPage) ||
        numtx !== oldnumtx) {

      setPagingCurPage(1);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (txData?.length > 0) {
      setDataReady(true);
    } else {
      setDataReady(false);
    }
  }, [txData]);


  return (
    <>
    <table className="Table TxTable" cellSpacing={0} cellPadding={0}>
      <thead>
        <tr className="Table THR">
          <th className="Table THR THRC Small">{'Date'}</th>
          <th className="Table THR THRC THRCMed">{'Account'}</th>
          <th className="Table THR THRC">{'Description'}</th>
          <th className="Table THR THRC Small">{'Amount'}</th>
          <th className="Table THR THRC">{'Envelope'}</th>
          <th className="Table THR THRC">{'Split'}</th>
          <th className="Table THR THRC">{' KW '}</th>
          <th className="Table THR THRC THRCClickable">
            <div onClick={() => look_for_dups()}>{' Dup '}</div>
          </th>
          <th className="Table THR THRC THRCClickable">
            <div onClick={() => look_for_invisible()}>{' Vis '}</div>
          </th>
          <th className="Table THR THRC">
            <input
              type="checkbox"
              onChange={handleCheckAll}
              checked={isAllChecked}
            />
          </th>
        </tr>
      </thead>

      <tbody>
        { dataReady &&
        //for (const [index, item] of txData.entries()) {
          txData.map((item, index) => (
            index < (pagingCurPage * pagingPerPage) &&
            index >= ((pagingCurPage-1) * pagingPerPage) &&
            <TransactionTableRow
              key={"tx-" + item.txID}  
              index={index}
              item={item}
              envList={envList}
              onRowUpdate={handleRowUpdate}
              callback={callback}
            />
          ))
        //}
        }
      </tbody>
      <tfoot>
        <tr className="Table THR">
          <td className="Table THR THRC TC Right" colSpan={3}>
            (Only filtered data, but including all pages) Total:
          </td>
          <td className="Table THR THRC TC Right">{
            formatCurrency(
              txData.reduce((total, curItem, curIndex) => {
                return total + curItem.txAmt;
              }, 0)
            )
          }</td>
          <td className="Table THR TCInput">
            <DropDown
                  id={'change-all-selected-envelopes'}
                  selectedID={changeAllEnvID}
                  optionData={envList}
                  changeCallback={handleChangeAllEnvID}
                  className="envelopeDropDown"
                />
          </td>
          <td className="Table THR THRC" colSpan={4}></td>
          <td className="Table THR THRC">
            <button 
              className='trash'
              onClick={() => delete_checked_transactions()}>
                <FontAwesomeIcon icon={faTrash} />
            </button>
          </td>
        </tr>
      </tfoot>
    </table>
    <div className="PagingContainer"><table ><tbody><tr>
      <td>
      <span>Rows per page:</span>
      
      <Select
        id="dpaging-select-num-per-page"
        value={pagingPerPage.toString()}
        onChange={handleNumPerPageChange}
        sx={{ m:0, p:0, ml:1, lineHeight: 'normal', height: 30 }}
      >
        <MenuItem value={10}>10</MenuItem>
        <MenuItem value={20}>20</MenuItem>
        <MenuItem value={30}>30</MenuItem>
        <MenuItem value={40}>40</MenuItem>
        <MenuItem value={50}>50</MenuItem>
        <MenuItem value={100}>100</MenuItem>
        <MenuItem value={200}>200</MenuItem>
        <MenuItem value={300}>300</MenuItem>
      </Select>
      </td>
      <td >
        <Pagination
          count={pagingNumPages}
          variant="outlined"
          shape="rounded"
          onChange={handlePageChange}
          page={pagingCurPage}
          sx={{ width: 'fit-content'}}
        />
      </td>
      </tr></tbody></table></div>
    </>
  );
};

export default TransactionTable;