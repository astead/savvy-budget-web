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
  const [filterEnvID, setFilterEnvID] = useState(-2);
  const [filterEnvelopeName, setFilterEnvelopeName] = useState(null as any);

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
      load_chart({ filterEnvID, drillDownLabel: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMonth]); 

  /* End Month Selector code ---------------------------------------*/

  const [haveChartData, setHaveChartData] = useState(false);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartState, setChartState] = useState(null as any);
  
  const handleFilterEnvChange = ({id, new_value, new_text}) => {
    setHaveChartData(false);
    setFilterEnvID(parseInt(new_value));
    setFilterEnvelopeName(new_text);
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

    const tmpEnv = tmpEnvList.find((i) => {return (i.id === filterEnvID)});
    if (tmpEnv) {
      setFilterEnvelopeName(tmpEnv.text);
    }
    setFilterEnvListLoaded(true);
  };

  const set_filter = (name) => {
    const tmpEnv = filterEnvList.find((i) => {return (i.text === name)});
    if (tmpEnv) {
      setFilterEnvID(tmpEnv.id);
      setFilterEnvelopeName(tmpEnv.text);
      return tmpEnv.id;
    } else {
      return null;
    }
  }

  async function load_chart({ filterEnvID, drillDownLabel }) {
    // Signal we want to get data
    if (!config) return;
    const response = await axios.post(baseUrl + channels.GET_ENV_PIE_CHART_DATA, {filterEnvID, find_date: curMonth, drillDownLabel }, config);

    // Receive the data
    const myChartData = response.data;
    
    setChartData(myChartData as ChartData[]);
    
    const labels = myChartData.map((item) => item.label);
    
    const yActual = myChartData.map((i) => {
      if (filterEnvelopeName === 'Income' && i.totalAmt > 0) {
        return parseFloat((i.totalAmt).toFixed(2));
      } else if (filterEnvelopeName !== 'Income' && i.totalAmt < 0) {
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
              if (!drillDownLabel) {
                // update our filter
                const newFilterID = set_filter(config.w.config.labels[config.dataPointIndex]);
                load_chart({filterEnvID: newFilterID, drillDownLabel: config.w.config.labels[config.dataPointIndex] });
              } else {
                // We can drill down to the envelope level
                if (filterEnvID) {
                  load_chart({filterEnvID: null, drillDownLabel: config.w.config.labels[config.dataPointIndex] });
                }
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

  useEffect(() => {
    if (chartData?.length > 0) {
      setHaveChartData(true);
    } else {
      setHaveChartData(false);
    }
  }, [chartData]);

  useEffect(() => {
    if (filterEnvID && filterEnvelopeName?.length && gotMonthData) {
      load_chart({ filterEnvID, drillDownLabel: null });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEnvID, filterEnvelopeName]);

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
            selectedID={filterEnvID}
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