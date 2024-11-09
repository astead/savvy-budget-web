import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

const PrivateRoute = ({ element: Component, ...rest }) => {
  const { isAuthenticated } = useAuth0();
  if (isAuthenticated) {
    return <Component {...rest} />; 
  } else { 
    return <Navigate to="/" />;
  }
};

export default PrivateRoute;
