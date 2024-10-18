// configure.tsx

import React, { useEffect, useState } from 'react';
import { Header } from './header.tsx';
import { ChartsTrend } from './ChartsTrend.tsx';
import { ChartsPie } from './ChartsPie.tsx';

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export const Charts = () => {

  interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    tabValue: number;
  }

  function CustomTabPanel(props: TabPanelProps) {
    const { children, tabValue, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={tabValue !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {tabValue === index && (
          <Box sx={{ pt: 3, m: 'auto' }}>
            <Typography component={"span"}>{children}</Typography>
          </Box>
        )}
      </div>
    );
  }

  function a11yProps(index: number) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }
  
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    localStorage.setItem('tabValue-chart', JSON.stringify(newValue));
    setTabValue(newValue);
  };

  useEffect(() => {
    // which tab were we on?
    const my_tabValue_str = localStorage.getItem('tabValue-chart');
    if (my_tabValue_str?.length) {
      const my_tabValue = JSON.parse(my_tabValue_str);
      if (my_tabValue) {
        setTabValue(my_tabValue);
      }
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        {<Header currTab="Charts"/>}
      </header>
      <div className="mainContent">
          <Box 
            sx={{ 
              width: '800', 
              bgcolor: 'lightgray', 
              borderBottom: 1, 
              borderColor: 'divider',
            }}
          >
            <Tabs 
              value={tabValue}
              onChange={handleTabChange}
              aria-label="basic tabs example"
              variant="fullWidth"
              textColor="inherit"
              TabIndicatorProps={{
                style: {
                  backgroundColor: "black"
                }
              }}
              sx={{ padding: 0, margin: 0, height: 30, minHeight:30, width: '100%', minWidth: '800px'}}>
              <Tab label="Trend Line" {...a11yProps(0)} className="TabButton" sx={{ padding: 0, margin: 0, height: 30, minHeight:30 }} />
              <Tab label="Pie Chart" {...a11yProps(1)} className="TabButton" sx={{ padding: 0, margin: 0, height: 30, minHeight:30 }} />
            </Tabs>
          </Box>
          <CustomTabPanel tabValue={tabValue} index={0}>
            <ChartsTrend />
          </CustomTabPanel>
          <CustomTabPanel tabValue={tabValue} index={1}>
            <ChartsPie />
          </CustomTabPanel>
      </div>
    </div>
  );
};
