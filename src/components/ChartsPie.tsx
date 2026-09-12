import React, { useEffect, useState } from 'react';
import { baseUrl, channels } from '../shared/constants.js';
import { DropDown } from '../helpers/DropDown.tsx';
import Chart from "react-apexcharts";
import axios from 'axios';
import { useAuthToken } from '../context/AuthTokenContext.tsx';
import { MonthSelector } from '../helpers/MonthSelector.tsx';
import dayjs from 'dayjs';

export const ChartsPie: React.FC = () => {
  const { config } = useAuthToken();
  
  interface FilterList {
    id: number; 
    text: string;
  }

  interface ChartData {
    [key: string]: string | number | Date;
  }

  interface ModeToggleChipProps {
    mode: "actual" | "budget";
    onChange: (newMode: "actual" | "budget") => void;
  }

  const [filterEnvList, setFilterEnvList] = useState<FilterList[]>([]);
  const [filterEnvListLoaded, setFilterEnvListLoaded] = useState(false);
  const [filterCatID, setFilterCatID] = useState(-2);
  const [filterCatName, setFilterCatName] = useState(null as any);
  const [filterEnvName, setFilterEnvName] = useState(null as any);
  const [mode, setMode] = useState<"actual" | "budget">("actual");

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
  
  const ModeToggleChip: React.FC<ModeToggleChipProps> = ({ mode, onChange }) => {
    return (
      <div className="mode-toggle-chip">
        <button
          className={`chip ${mode === "actual" ? "active actual" : ""}`}
          onClick={() => onChange("actual")}
        >
          Actual
        </button>
        <button
          className={`chip ${mode === "budget" ? "active budget" : ""}`}
          onClick={() => onChange("budget")}
        >
          Budget
        </button>
      </div>
    );
  };

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
      text: "All Categories",
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
      {filterCatID, filterEnvName, find_date: curMonth, mode }, config);

    // Receive the data
    const myChartData = response.data;
    
    setChartData(myChartData as ChartData[]);
    
    // Step 1: Build combined array
    const combined = myChartData.map((item) => {
      const amt = parseFloat(item.totalAmt.toFixed(2));

      let value;
      if (mode === "actual" && filterCatName === 'Income' && amt > 0) {
        value = amt;
      } else if (mode === "budget" && filterCatName === 'Income' && amt < 0) {
        value = Math.abs(amt);
      } else if (mode === "actual" && filterCatName !== 'Income' && amt < 0) {
        value = Math.abs(amt);
      } else if (mode === "budget" && filterCatName !== 'Income' && amt > 0) {
        value = amt;
      } else {
        value = 0;
      }

      return { label: item.label, value };
    });

    // Step 2: Sort largest → smallest
    combined.sort((a, b) => b.value - a.value);

    // Step 3: Extract sorted labels + series
    const labels = combined.map((i) => i.label);
    const series = combined.map((i) => i.value);

    const customColors = [
      "#1f77b4", // strong blue
      "#ff7f0e", // vivid orange
      "#2ca02c", // strong green
      "#d62728", // bold red
      "#9467bd", // purple
      "#8c564b", // brown
      "#e377c2", // pink
      "#7f7f7f", // gray
      "#bcbd22", // olive
      "#17becf", // cyan

      "#4e79a7", // steel blue
      "#f28e2b", // orange-yellow
      "#e15759", // coral red
      "#76b7b2", // teal
      "#59a14f", // medium green
      "#edc948", // gold
      "#b07aa1", // lavender
      "#ff9da7", // rose
      "#9c755f", // warm brown
      "#bab0ac", // soft gray

      "#003f5c", // deep navy
      "#58508d", // indigo
      "#bc5090", // magenta
      "#ffa600"  // bright amber
    ];
     
    setChartState({
      series: series,
      options: {
        chart: {
          width: 800,
          type: 'pie',
          events:{
            dataPointSelection: (event, chartContext, config) => {
              const clickedLabel = config.w.config.labels[config.dataPointIndex];
              
              // Find the category in the dropdown list
              const cat = filterEnvList.find((i) => i.text === clickedLabel);
              if (cat) {
                handleFilterEnvChange({
                  id: null,
                  new_value: cat.id,
                  new_text: cat.text,
                });
              }
            },
          },
        },
        labels: labels,
        colors: customColors,
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
        <span key="all-categories" className="bread-crumb" 
          onClick={() => {
            handleFilterEnvChange({ id: null, new_value: -2, new_text: "All Categories" })
          }}
        >All Categories</span>
      );
    } else {
      crumbs.push(<span key="all-income" className="bread-crumb">All Income</span>);
    }
    if (filterCatID !== -2 && filterCatName !== 'Income') {
      crumbs.push(<span key="spacer-1" className="bread-crumb-spacer">{'>'}</span>);
      crumbs.push(<span key={`cat-${filterCatID}`} className="bread-crumb" 
        onClick={() => {
          handleFilterEnvChange({id: null, new_value: filterCatID, new_text: filterCatName});
        }}
      >{filterCatName}</span>);
    }
    if (filterEnvName) {
      crumbs.push(<span key="spacer-2" className="bread-crumb-spacer">{'>'}</span>);
      crumbs.push(<span key={`env-${filterEnvName}`} className="bread-crumb">{filterEnvName}</span>);
    }
    return crumbs;
  }

  
  useEffect(() => {
    if (filterEnvListLoaded) {
      if (filterCatName) {
        load_chart();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEnvListLoaded, filterCatID, filterCatName, filterEnvName, mode]);


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
          <div className="chartTitle" style={{ backgroundColor: mode === "budget" ? "#e8f5e9" : "#e3f2fd" }}>
            <ModeToggleChip mode={mode} onChange={setMode} />
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