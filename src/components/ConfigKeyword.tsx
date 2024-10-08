import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronUp, faChevronDown, faTrash, faReply, faReplyAll } from "@fortawesome/free-solid-svg-icons"
import * as dayjs from 'dayjs';
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import { EditText } from 'react-edit-text';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

/*
  TODO:
  - Show keyword duplicate matches?
  - don't allow renaming to cause duplicate matches.
*/

interface KeywordList {
  id: number;
  envelopeID: number;
  description: string;
  category: string;
  envelope: string;
  account: string;
  last_used: string;
}

export const ConfigKeyword = () => {
  const { config } = useAuthToken();

  const [keywordData, setKeywordData] = useState<KeywordList[]>([]);
  const [sortKeyword, setSortKeyword] = useState('10');
  const [envList, setEnvList] = useState<any[]>([]);
  const [accList, setAccList] = useState<any[]>([]);
 
  const load_envelope_list = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ENV_LIST, { includeInactive: 1 }, config);
    
    // Receive the data
    setEnvList([...response.data.map((i) => {
      return {
        id: i.envID,
        text: i.category + (i.category?.length && i.envelope?.length?" : ":"") + i.envelope,
      }
    })]);
  }

  const load_account_list = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ACCOUNT_NAMES, null, config);
    setAccList([{
      id: "All", text: "All"
    }, ...(response.data.map((i) => {
      return { id: i.common_name, text: i.common_name }
    }))]);
  }

  const load_keywords = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_KEYWORDS, null, config);
    const tmpArr = sort_keyword_array(response.data);
    setKeywordData(tmpArr);
  }

  const sort_keyword_array = (arr) => {
    let sortValue = sortKeyword[0];
    let sortDir = sortKeyword[1];

    let tmpArr = arr as KeywordList[];
    
    if (sortValue === '0') {
      tmpArr.sort((a, b) => a.description.localeCompare(b.description) * (sortDir === '0' ? 1 : -1));
    } else {
      tmpArr.sort((a, b) => {
        
        if (a.category && b.category) {
          const categoryComparison = a.category.localeCompare(b.category);
          if (categoryComparison !== 0) {
            return categoryComparison * (sortDir === '0' ? 1 : -1);
          }
        } else {
          if (!(!a.category && !b.category)) {
            return (a.category && !b.category) ? 1 : -1;
          }
        }
        if (a.envelope && b.envelope) {
          const envelopeComparison = a.envelope.localeCompare(b.envelope);
          if (envelopeComparison !== 0) {
            return envelopeComparison * (sortDir === '0' ? 1 : -1);
          }
        } else {
          if (!(!a.envelope && !b.envelope)) {
            return (a.envelope && !b.envelope) ? 1 : -1;
          }
        }
        return a.description.localeCompare(b.description) * (sortDir === '0' ? 1 : -1);
      });
    }
    return tmpArr;
  }

  const set_keyword_sort = (col, dir) => {
    setSortKeyword(col + dir);
  }

  const handleKeywordDelete = async (id) => {
    // Request we delete the keyword in the DB
    if (!config) return;
    await axios.post(baseUrl + channels.DEL_KEYWORD, { id }, config);
    load_keywords();
  };

  const handleKeywordSetAll = (id, force) => {
    // Request we set the keyword in the DB for undefined tx
    if (!config) return;
    axios.post(baseUrl + channels.SET_ALL_KEYWORD, {id, force}, config);
  };

  const handleAccountChange = ({id, new_value, new_text}) => {
    // Request we update the DB
    if (!config) return;
    axios.post(baseUrl + channels.UPDATE_KEYWORD_ACC, {id, new_value}, config);
  };

  const handleEnvelopeChange = ({id, new_value, new_text}) => {
    // Request we update the DB
    if (!config) return;
    axios.post(baseUrl + channels.UPDATE_KEYWORD_ENV, {id, new_value}, config);
  };

  useEffect(() => {
    setKeywordData([...sort_keyword_array(keywordData)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKeyword]);

  useEffect(() => {
    load_keywords();
    load_account_list();
    load_envelope_list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!keywordData?.length) {
    return (
      <></>
    );
  }

  return (
    <table className="Table" cellSpacing={0} cellPadding={0}>
      <thead>
        <tr className="Table THR">
          <th className="Table THR THRC">{'Account'}</th>
          <th className="Table THR THRC THRCClickable" onClick={() => {
            set_keyword_sort('0', (sortKeyword[0] === '0')?((sortKeyword[1] === '0')?('1'):('0')):('0'));
          }}>
            {'Keyword'}
            { sortKeyword === '00' &&
                <FontAwesomeIcon icon={faChevronUp} className="sortIcon" />
            }
            { sortKeyword=== '01' &&
                <FontAwesomeIcon icon={faChevronDown} className="sortIcon" />
            }
          </th>
          <th className="Table THR THRC THRCClickable" onClick={() => {
            set_keyword_sort('1', (sortKeyword[0] === '1')?((sortKeyword[1] === '0')?('1'):('0')):('0'));
          }}>
            {'Envelope'}
            { sortKeyword === '10' &&
                <FontAwesomeIcon icon={faChevronUp} className="sortIcon" />
            }
            { sortKeyword === '11' &&
                <FontAwesomeIcon icon={faChevronDown} className="sortIcon" />
            }
          </th>
          <th className="Table THR THRC">{'Used?'}</th>
          <th className="Table THR THRC">{'Del'}</th>
          <th className="Table THR THRC">{'Set'}</th>
          <th className="Table THR THRC">{'Force'}</th>
        </tr>
      </thead>

      <tbody>
        {
          keywordData.map(({ id, envelopeID, description, account, last_used }, index) => (
            <tr key={"row-"+id} className="Table TR">
              <td className="Table TC">
                <DropDown 
                  id={id}
                  selectedID={account}
                  optionData={accList}
                  changeCallback={handleAccountChange}
                  className={""}
                />
              </td>
              <td className="Table TC Left">
                <EditText
                  name={id.toString()}
                  defaultValue={description} 
                  onSave={({name, value, previousValue}) => {
                    // Request we rename the keyword in the DB
                    if (!config) return;
                    axios.post(baseUrl + channels.UPDATE_KEYWORD, { id, new_value: value }, config);
                  }}
                  style={{padding: '0px', margin: '0px', minHeight: '1rem'}}
                  className={"editableText"}
                  inputClassName={"normalInput"}
                />
              </td>
              <td className="Table TC">
                <DropDown 
                  id={id}
                  selectedID={envelopeID}
                  optionData={envList}
                  changeCallback={handleEnvelopeChange}
                  className={envelopeID === -1 ? "envelopeDropDown-undefined":""}
                />
              </td>
              <td className="Table TC">
                {last_used && dayjs(last_used).format('M/D/YYYY')}
              </td>
              <td className="Table TC">
              <button 
                className="trash"
                onClick={() => handleKeywordDelete(id)}>
                  <FontAwesomeIcon icon={faTrash} />
              </button>
              </td>
              <td className="Table TC">
                <button 
                  onClick={() => handleKeywordSetAll(id, 0)}>
                    <FontAwesomeIcon icon={faReply} flip="horizontal" />
                </button>
              </td>
              <td className="Table TC">
                <button 
                  onClick={() => handleKeywordSetAll(id, 1)}>
                    <FontAwesomeIcon icon={faReplyAll} flip="horizontal" />
                </button>
              </td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
};

export default ConfigKeyword;