import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import { baseUrl, channels } from '../shared/constants.js';
import { useAuthToken } from '../context/AuthTokenContext.tsx';

const ADMIN_BIT = 128;

const AdminRoute = ({ element: Component, ...rest }) => {
  const { isAuthenticated } = useAuth0();
  const { config } = useAuthToken();

  // null = still loading, true/false = resolved
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !config) {
      setIsAdmin(false);
      return;
    }
    const checkAdmin = async () => {
      try {
        const response = await axios.get(baseUrl + channels.GET_PROFILE, config);
        const level = response.data?.subscriptionLevel ?? 0;
        setIsAdmin((level & ADMIN_BIT) !== 0);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [isAuthenticated, config]);

  if (!isAuthenticated) return <Navigate to="/" />;
  if (isAdmin === null) return null; // loading — render nothing briefly
  if (!isAdmin) return <Navigate to="/" />;
  return <Component {...rest} />;
};

export default AdminRoute;
