import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import MenuIcon from '@mui/icons-material/Menu';

import Logo from '../../assets/FilledLaserableLogo.svg';

import { ScopedThunkDispatch, State as ReduxState } from 'ui/reducer';
import { logoutUserAction } from 'ui/auth/actions';
import { AuthMember } from 'ui/auth/interfaces';
import { memberIsAdmin, memberIsBoardMember } from 'ui/member/utils';
import { Routing, Whitelists } from 'app/constants';
import Help from 'ui/common/Help';

const roleBadge = (currentUser: AuthMember): JSX.Element | null => {
  if (currentUser.isAdmin) {
    return <Chip label="Admin" size="small" style={{ marginLeft: 8, height: 20, fontSize: 10, backgroundColor: '#d32f2f', color: '#fff', fontWeight: 700, letterSpacing: '0.05em' }} />;
  }
  if (currentUser.isBoardMember) {
    return <Chip label="Board" size="small" style={{ marginLeft: 8, height: 20, fontSize: 10, backgroundColor: '#7b1fa2', color: '#fff', fontWeight: 700, letterSpacing: '0.05em' }} />;
  }
  if (currentUser.isResourceManager) {
    return <Chip label="RM" size="small" style={{ marginLeft: 8, height: 20, fontSize: 10, backgroundColor: '#1565c0', color: '#fff', fontWeight: 700, letterSpacing: '0.05em' }} />;
  }
  return null;
};

const Header: React.FC = () => {
  const location = useLocation();
  const dispatch = useDispatch<ScopedThunkDispatch>();

  const { currentUser, isRequesting: authRequesting, permissions, totpEnrollmentRequired } = useSelector(
    (state: ReduxState) => state.auth
  );
  const billingEnabled = !!permissions[Whitelists.billing] || false;
  const earnedMembershipEnabled =
    (memberIsAdmin(currentUser) || memberIsBoardMember(currentUser)) &&
    !!permissions[Whitelists.earnedMembership] || false;

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  const attachMenu = (event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);
  const detachMenu = () => setAnchorEl(null);
  const logoutUser = () => { dispatch(logoutUserAction()); detachMenu(); };

  const renderMenuNavLink = (path: string, label: string, id: string) => {
    const selected = location.pathname === path;
    return (
      <Link key={id} id={id} to={path} style={{ outline: 'none', textDecoration: 'none', color: 'unset' }} onClick={detachMenu}>
        <MenuItem selected={selected}>{label}</MenuItem>
      </Link>
    );
  };

  const renderLoginLink = () => (
    <Link to={Routing.Login} style={{ outline: 'none', textDecoration: 'none', color: 'unset' }}>
      <MenuItem component={Typography as any}>Already a member? Login</MenuItem>
    </Link>
  );

  const renderHambMenu = () => {
    const profileUrl  = Routing.Profile.replace(Routing.PathPlaceholder.MemberId, currentUser.id);
    const settingsUrl = Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUser.id);
    const isAdmin       = currentUser.isAdmin;
    const isBoardMember = currentUser.isBoardMember;
    const isRM          = currentUser.isResourceManager;
    const isAdminOrBoard  = isAdmin || isBoardMember;
    const isPrivileged    = isAdmin || isBoardMember || isRM;
    const canManageShopFees  = isPrivileged;
    const canManageCheckouts = isPrivileged || (currentUser as any).isCheckoutApprover;
    const canManageVolunteer = isPrivileged;
    const canManageRentals   = isPrivileged;

    const privilegedItems: JSX.Element[] = [
      ...(billingEnabled && isAdminOrBoard ? [renderMenuNavLink(Routing.Billing, 'Billing', 'billing')] : []),
      ...(earnedMembershipEnabled && isAdminOrBoard ? [renderMenuNavLink(Routing.EarnedMemberships, 'Earned Memberships', 'earnedMembership')] : []),
      ...(isPrivileged ? [renderMenuNavLink(Routing.Members, 'Members', 'members')] : []),
      ...(isAdmin ? [renderMenuNavLink(Routing.SystemSettings, 'Portal Settings', 'system-settings')] : []),
      ...(canManageRentals ? [renderMenuNavLink(Routing.AdminRentals, 'Rentals', 'rentals')] : []),
      ...(canManageShopFees ? [renderMenuNavLink(Routing.ShopFees, 'Shop Fees', 'shop-fees')] : []),
      ...(canManageCheckouts ? [renderMenuNavLink(Routing.ToolCheckouts, 'Tool Checkouts', 'tool-checkouts')] : []),
      ...(canManageVolunteer ? [renderMenuNavLink(Routing.Volunteer, 'Volunteer', 'volunteer')] : []),
    ];

    const settingsSubRoutes = [
      { route: 'profile', label: 'Personal Information', id: 'settings-submenu-profile' },
      ...(billingEnabled ? [
        { route: 'subscriptions', label: 'Subscriptions', id: 'settings-submenu-subscriptions' },
        { route: 'payment-methods', label: 'Payment Methods', id: 'settings-submenu-payment-methods' },
      ] : []),
      { route: 'security', label: 'Security', id: 'settings-submenu-security' },
    ];
    const settingsItems = settingsSubRoutes.map(({ route, label, id }) =>
      renderMenuNavLink(`${settingsUrl}/${route}`, label, id)
    );

    return (
      <>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Typography variant="body1" color="secondary">
            {currentUser.firstname} {currentUser.lastname}
          </Typography>
          {roleBadge(currentUser)}
        </span>
        <IconButton id="menu-button" className="menu-button" color="inherit" aria-label="Menu" onClick={attachMenu}>
          <MenuIcon />
        </IconButton>
        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          transitionDuration={0}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          open={menuOpen}
          onClose={detachMenu}
        >
          {renderMenuNavLink(settingsUrl, 'Account Settings', 'settings')}
          {renderMenuNavLink(profileUrl, 'My Profile', 'profile')}
          {privilegedItems.length > 0 && <Divider />}
          {privilegedItems}
          {privilegedItems.length < 5 && settingsItems.length > 0 && <Divider />}
          {privilegedItems.length < 5 && settingsItems}
          <Divider />
          <MenuItem id="logout" onClick={logoutUser} style={{ color: '#d32f2f' }}>Logout</MenuItem>
        </Menu>
      </>
    );
  };

  return (
    <AppBar style={{ marginBottom: '1em' }} position="static" color="default" title="Manchester Makerspace">
      <Toolbar>
        <Typography variant="h6" color="inherit" className="flex">
          <Logo alt="Manchester Makerspace" viewBox="0 0 960 580" preserveAspectRatio="xMinYMin" />
        </Typography>
        <Help />
        {currentUser.id
          ? (!totpEnrollmentRequired && renderHambMenu())
          : (!authRequesting && renderLoginLink())
        }
      </Toolbar>
    </AppBar>
  );
};

export default Header;
