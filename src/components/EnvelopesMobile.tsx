import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js'
import * as dayjs from 'dayjs';
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { FooterMobile } from './FooterMobile.tsx';
import ProgressBar from '../helpers/BorderLinearProgress.tsx';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { IconButton } from '@mui/material';
import { HeaderMobile } from './headerMobile.tsx';

export const EnvelopesMobile: React.FC = () => {
  const { config } = useAuthToken();
  
  /* Month Selector code -------------------------------------------*/
  const [year, ] = useState((new Date()).getFullYear());
  const [month, ] = useState((new Date()).getMonth());
  const [curMonth, ] = useState(dayjs(new Date(year, month)).format('YYYY-MM-DD'));
  /* End Month Selector code ---------------------------------------*/
  
  interface BudgetNodeData {
    catID: number; 
    category: string;
    currBalance: number; 
    currBudget: number; 
    envID: number; 
    envelope: string;
    currActual: number; 
  };

  function formatWholeCurrency(currencyNumber:number) {
    return currencyNumber.toLocaleString('en-EN', {style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  };

  const compare = (a, b) => {
    if (a.category === 'Income' || b.category === 'Income') {
      if (a.category === 'Income' && b.category !== 'Income') {
        return -1;
      }
      if (a.category !== 'Income' && b.category === 'Income') {
        return 1;
      }
      if (a.envelope < b.envelope) {
        return -1;
      }
      if (a.envelope > b.envelope) {
        return 1;
      }
      return 0;
    } else {
      if (a.category < b.category) {
        return -1;
      }
      if (a.category > b.category) {
        return 1;
      }
      if (a.envelope < b.envelope) {
        return -1;
      }
      if (a.envelope > b.envelope) {
        return 1;
      }
      return 0;
    }
  };
  
  const [budgetData, setBudgetData] = useState<BudgetNodeData[]>([]);
  const [loaded, setLoaded] = useState(false);  
  const [favorites, setFavorites] = useState<any[]>([]);
  
  const load_CurrBalance = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CURR_BALANCE, null, config);
    
    // Receive the data
    let rows = response.data;
  
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.id === item.envID);
      return match ? { envID: item.envID, currBalance: match.balance } : { envID: item.envID };
    });
    
    return updatedData;
  };

  const load_CurrBudget = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CUR_BUDGET, { find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD') }, config);
    
    // Receive the data
    let rows = response.data;
  
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? { envID: item.envID, currBudget: match.txAmt } : { envID: item.envID };
    });

    return updatedData;
  };

  const load_CurrActual = async (currentData) => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_CUR_ACTUAL, {
      find_date: dayjs(new Date(year, month)).format('YYYY-MM-DD')
    }, config);
    
    // Receive the data
    let rows = response.data;
    
    // Go through the data and store it into our table array
    const updatedData = currentData.map((item) => {
      const match = rows.find((d) => d.envelopeID === item.envID);
      return match ? { envID: item.envID, currActual: match.totalAmt ?? 0 } : { envID: item.envID };
    });

    return updatedData;
  };

  const handleFavoriteClick = (item) => {
    if (!favorites.includes(item.envID)) {
      favorites.push(item.envID);
      localStorage.setItem('favorites', JSON.stringify(favorites));
      setFavorites([...favorites]);
    } else {
      let tmp_favorites = favorites.filter(id => id !== item.envID);
      localStorage.setItem('favorites', JSON.stringify(tmp_favorites));
      setFavorites([...tmp_favorites]);
    }
  };

  const load_favorites = () => {
    const favs = localStorage.getItem('favorites');
    let favorites = (favs) ? JSON.parse(favs) : [];
    setFavorites(favorites);
  };

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoaded(false);
        
        // Load favorites first - this doesn't depend on API calls
        load_favorites();
        
        // Step 1: Load the initial envelope structure
        if (!config) return;
        const response = await axios.post(baseUrl + channels.GET_BUDGET_ENV, null, config);
        
        // Process envelope data with default values
        if (response.data?.length) {
          const defaultValues = {
            prevBudget: 0,
            prevActual: 0,
            currBalance: 0,
            currBudget: 0,
            monthlyAvg: 0,
            currActual: 0,
          };

          const enrichedData = response.data.map((item) => ({ 
            ...item, 
            ...defaultValues 
          })) as BudgetNodeData[];
          const sortedData = enrichedData.sort(compare);
          
          // Step 2: Load all the detailed data in parallel
          const [currBudgetData, currBalanceData, currActualData] = await Promise.all([
            load_CurrBudget(sortedData),
            load_CurrBalance(sortedData),
            load_CurrActual(sortedData),
          ]);

          // Step 3: Combine all data in one update
          const combinedData = sortedData.map((item, index) => ({
            ...item,
            ...currBudgetData[index],
            ...currBalanceData[index],
            ...currActualData[index],
          }));

          // Final state update - do this once with all data
          setBudgetData(combinedData);
          setLoaded(true);
        }
      } catch (error) {
        console.error('Error loading mobile budget data:', error);
      }
    };

    loadAllData();
    
    // Only depend on month changes and config
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMonth, config]);

  return (
    <>
      <div className="App-header">
        <HeaderMobile currTab="Budget"/>
      </div>
      <div className="main-page-body-text-mobile">
        {loaded &&
          <>
            <div style={{ paddingBottom: '10px', fontWeight: 'bold' }}>
              { dayjs(new Date(year, month)).format("MMMM YYYY") + ' Budget' }
            </div>
            
            { budgetData
              .filter(i => favorites.some(e => e === i.envID))
              .map((item, index, myArray) => (
              <React.Fragment key={index}>
                { index === 0 && (
                  <div className='mobile-tx-date'>Favorites</div>
                )}
                <div className='mobile-budget-container'
                  style={{
                    display: 'flex',
                    alignItems: 'center', 
                    marginBottom: index === myArray.length-1 ? '20px' : '0'
                  }}>
                  <IconButton onClick={() => handleFavoriteClick(item)} style={{ marginLeft: '0px', marginRight: '0px' }}>
                    {favorites.some(e => e === item.envID) ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                  </IconButton>
                  <div style={{ flex: 1 }}>
                    <div className='mobile-budget-header'>
                      <span className='mobile-tx-description'>
                        {item.envelope}
                      </span>
                      <span className='mobile-tx-amt'>
                        { 
                          formatWholeCurrency(
                            item.category === 'Income' ? 
                              item.currActual :
                              (item.currActual === 0 ? 0 : -1*item.currActual)
                          )
                        } 
                        {' of '}
                        {
                          formatWholeCurrency(
                            item.category === 'Income' ? 
                              (item.currBudget === 0 ? 0 : -1*item.currBudget) : 
                              item.currBudget
                          )
                        }
                        {', left over '}
                        {
                          formatWholeCurrency(item.currBalance)
                        }
                      </span>
                    </div>
                    <ProgressBar 
                      actual={
                        item.category === 'Income' ? Math.floor(item.currActual) : Math.floor(-1 * item.currActual)
                      }
                      budget={
                        item.category === 'Income' ? Math.floor(-1 * item.currBudget) : Math.floor(item.currBudget)
                      }
                      balance={item.currBalance}
                      isIncome={item.category === 'Income'}
                    />
                  </div>
                </div>
              </React.Fragment>
            ))}
            
            { budgetData.map((item, index, myArray) => (
              <React.Fragment key={index}>
                { (index === 0 || (index > 0 && item.category !== myArray[index - 1].category)) && (
                  <div className='mobile-tx-date'>{item.category}</div>
                )}
                <div className='mobile-budget-container'
                  style={{
                    display: 'flex',
                    alignItems: 'center', 
                    marginBottom: index === myArray.length-1 ? '20px' : '0'
                  }}>
                  <IconButton onClick={() => handleFavoriteClick(item)} style={{ marginLeft: '0px', marginRight: '0px' }}>
                    {favorites.some(e => e === item.envID) ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                  </IconButton>
                  <div style={{ flex: 1 }}>
                    <div className='mobile-budget-header'>
                      <span className='mobile-tx-description'>
                        {item.envelope}
                      </span>
                      <span className='mobile-tx-amt'>
                        { 
                          formatWholeCurrency(
                            item.category === 'Income' ? 
                              item.currActual :
                              (item.currActual === 0 ? 0 : -1*item.currActual)
                          )
                        } 
                        {' of '}
                        {
                          formatWholeCurrency(
                            item.category === 'Income' ? 
                              (item.currBudget === 0 ? 0 : -1*item.currBudget) : 
                              item.currBudget
                          )
                        }
                        {', left over '}
                        {
                          formatWholeCurrency(item.currBalance)
                        }
                      </span>
                    </div>
                    <ProgressBar 
                      actual={
                        item.category === 'Income' ? Math.floor(item.currActual) : Math.floor(-1 * item.currActual)
                      }
                      budget={
                        item.category === 'Income' ? Math.floor(-1 * item.currBudget) : Math.floor(item.currBudget)
                      }
                      balance={item.currBalance}
                      isIncome={item.category === 'Income'}
                    />
                  </div>
                </div>
              </React.Fragment>
            ))}
          </>
        }
      </div>
      <FooterMobile defaultValue={1} />
    </>
  );
}