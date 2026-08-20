import { useAuth0 } from "@auth0/auth0-react";
import React from "react";

const LogoutButton = () => {
  const { logout } = useAuth0();

  return (
    <span className={"menuLink"} onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>Log Out</span>
  );
};

export default LogoutButton;