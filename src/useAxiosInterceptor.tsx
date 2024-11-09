import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';

const useAxiosInterceptor = () => {
  const { getAccessTokenSilently, logout } = useAuth0();

  axios.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      if (error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const accessToken = await getAccessTokenSilently();
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          return axios(originalRequest);
        } catch (tokenRefreshError) {
          // Handle refresh token failure (e.g., user needs to re-login)
          logout({
            logoutParams: {
              returnTo: window.location.origin
            }
          });
          return Promise.reject(tokenRefreshError);
        }
      }

      return Promise.reject(error);
    }
  );
};

export default useAxiosInterceptor;
