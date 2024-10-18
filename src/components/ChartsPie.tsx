import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import Chart from "react-apexcharts";
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { MonthSelector } from '../helpers/MonthSelector.tsx';
import * as dayjs from 'dayjs';

export const ChartsPie: React.FC = () => {
  const { config } = useAuthToken();
  
  interface FilterList {
    id: number; 
    text: string;
  }

  interface ChartData {
    [key: string]: string | number | Date;
  }

  const [filterEnvList, setFilterEnvList] = useState<FilterList[]>([]);
  const [filterEnvListLoaded, setFilterEnvListLoaded] = useState(false);
  const [filterCatID, setFilterCatID] = useState(-2);
  const [filterCatName, setFilterCatName] = useState(null as any);
  const [filterEnvName, setFilterEnvName] = useState(null as any);

  /* Month Selector code -------------------------------------------*/
  const [year, setYear] = useState((new Date()).getFullYear());
  const [month, setMonth] = useState((new Date()).getMonth());
  const [curMonth, setCurMonth] = useState(dayjs(new Date(year, month)).format('YYYY-MM-DD'));
  const [myStartMonth, setMyStartMonth] = useState(new Date(year, month));
  const [myCurIndex, setMyCurIndex] = useState(0);
  const [gotMonthData, setGotMonthData] = useState(false);
  
  const monthSelectorCallback = ({ childStartMonth, childCurIndex, source }) => {
    
    // Need to adjust our month/year to reflect the change
    const child_start = new Date(childStartMonth);
    const child_month = child_start.getMonth();
    const child_year = child_start.getFullYear();
    let tmpDate = new Date(child_year, child_month + childCurIndex);

    localStorage.setItem('pie-month-data', JSON.stringify({ childStartMonth, childCurIndex }));
    setMyStartMonth(childStartMonth);
    setMyCurIndex(childCurIndex);
    setYear(tmpDate.getFullYear());
    setMonth(tmpDate.getMonth());
    setCurMonth(dayjs(tmpDate).format('YYYY-MM-DD'));
  };  

  useEffect(() => {
    if (gotMonthData && filterEnvListLoaded) {
      load_chart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMonth]); 

  /* End Month Selector code ---------------------------------------*/

  const [haveChartData, setHaveChartData] = useState(false);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartState, setChartState] = useState(null as any);
  
  const handleFilterEnvChange = ({id, new_value, new_text}) => {
    if (filterCatID !== parseInt(new_value) || 
        filterCatName !== new_text ||
        filterEnvName !== null) {
      setHaveChartData(false);
    }
    
    setFilterCatID(parseInt(new_value));
    setFilterCatName(new_text);
    setFilterEnvName(null);
  };

  const load_envelope_list = async () => {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ENV_CAT, {onlyActive: 1}, config);

    // Receive the data
    let groupedItems = [
    {
      id: -2,
      text: "All Spending",
    }];

    // Step 1: Extract and rename catID and category
    const extractedData = response.data.map(item => ({
      id: item.catID,
      text: item.category
    }));

    // Step 2: Filter unique items
    const uniqueData = Array.from(new Map(extractedData.map(item => [item.id, item])).values()) as FilterList[];

    const tmpEnvList = [...groupedItems, ...uniqueData];
    setFilterEnvList(tmpEnvList);

    // Set our filter category name
    const tmpEnv = tmpEnvList.find((i) => {return (i.id === filterCatID)});
    if (tmpEnv) {
      setFilterCatName(tmpEnv.text);
    }
    setFilterEnvListLoaded(true);
  };

  async function load_chart() {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ENV_PIE_CHART_DATA,
      {filterCatID, filterEnvName, find_date: curMonth }, config);

    // Receive the data
    const myChartData = response.data;
    
    setChartData(myChartData as ChartData[]);
    
    const labels = myChartData.map((item) => item.label);
    
    const yActual = myChartData.map((i) => {
      if (filterCatName === 'Income' && i.totalAmt > 0) {
        return parseFloat((i.totalAmt).toFixed(2));
      } else if (filterCatName !== 'Income' && i.totalAmt < 0) {
        return -1*parseFloat((i.totalAmt).toFixed(2));
      } else {
        return 0;
      }
    });
     
    setChartState({
      series: yActual,
      options: {
        chart: {
          width: 800,
          type: 'pie',
          events:{
            dataPointSelection: (event, chartContext, config) => {
              if (filterCatID === -2) {
                // update our filter
                setFilterCatName(config.w.config.labels[config.dataPointIndex]);
              } else {
                setFilterEnvName(config.w.config.labels[config.dataPointIndex]);
              }
            },
          },
        },
        labels: labels,
        responsive: [{
          breakpoint: 480,
          options: {
            chart: {
              width: 800
            },
            legend: {
              position: 'bottom'
            }
          }
        }],
        // Adding data labels formatter to handle undefined values
        dataLabels: {
          formatter: function (val, opts) {
            return val ? Math.round(val)+'%' : 'N/A';
          }
        },
        // Adding tooltip formatter to handle undefined values
        tooltip: {
          y: {
            formatter: function (val) {
              return val ? val.toLocaleString('en-EN', {style: 'currency', currency: 'USD'}) : 'N/A';
            }
          }
        },
        // Adding legend formatter to handle undefined values
        legend: {
          onItemHover: {
            highlightDataSeries: false,
          },
          formatter: function(val, opts) {
            return val !== undefined ? val.toString().slice(0, 25) : 'N/A';
          }
        }
      }
    });

    setHaveChartData(true);
  };

  const crumbs: JSX.Element[] = [];

  function renderBreadCrumbTitle() {
    if (filterCatName !== 'Income') {
      crumbs.push(
        <span className="bread-crumb" 
          onClick={() => {
            handleFilterEnvChange({ id: null, new_value: -2, new_text: "All Spending" })
          }}
        >All Spending</span>
      );
    } else {
      crumbs.push(<span className="bread-crumb">All Income</span>);
    }
    if (filterCatID !== -2 && filterCatName !== 'Income') {
      crumbs.push(<span className="bread-crumb-spacer">{'>'}</span>);
      crumbs.push(<span className="bread-crumb" 
        onClick={() => {
          handleFilterEnvChange({id: null, new_value: filterCatID, new_text: filterCatName});
        }}
      >{filterCatName}</span>);
    }
    if (filterEnvName) {
      crumbs.push(<span className="bread-crumb-spacer">{'>'}</span>);
      crumbs.push(<span className="bread-crumb">{filterEnvName}</span>);
    }
    return crumbs;
  }
  
  useEffect(() => {
    if (filterEnvListLoaded) {
      const tmpEnv = filterEnvList.find((i) => {return (i.text === filterCatName)});
      if (tmpEnv && tmpEnv.id !== filterCatID) {
        handleFilterEnvChange({id: null, new_value: tmpEnv.id, new_text: filterCatName});
      }

    }
  }, [filterCatName]);

  
  useEffect(() => {
    if (filterEnvListLoaded) {
      if (filterCatName) {
        renderBreadCrumbTitle();
        load_chart();
      }
    }
  }, [filterCatID, filterCatName, filterEnvName]);


  useEffect(() => {
    if (chartData?.length > 0) {
      setHaveChartData(true);
    } else {
      setHaveChartData(false);
    }
  }, [chartData]);

  useEffect(() => {
    setGotMonthData(true);
    load_envelope_list();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      { filterEnvListLoaded &&
        <>
        <div className="chart-filter-container">
            <label className="chart-filter-label">Envelope:</label>
          <DropDown 
            id={-1}
            selectedID={filterCatID}
            optionData={filterEnvList}
            changeCallback={handleFilterEnvChange}
            className="selectField"
          />
        </div>
        </>
      }
      {gotMonthData &&
        <MonthSelector numMonths="10" startMonth={myStartMonth} curIndex={myCurIndex} parentCallback={monthSelectorCallback} />
      }
      {haveChartData &&
        <div className="chartContainer">
          <br/>
          <div className="chartTitle">
            { renderBreadCrumbTitle() }
          </div>
          <Chart
            options={chartState.options}
            series={chartState.series}
            type="pie"
            width={"800"}
          />
        </div>
      }
    </>
  );
}