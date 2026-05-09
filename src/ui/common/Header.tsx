import * as React from "react";
import { Link } from "react-router-dom";
import { withRouter, RouteComponentProps } from "react-router-dom";
import { connect } from "react-redux";

import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Divider from "@material-ui/core/Divider";
import Chip from "@material-ui/core/Chip";
import MenuIcon from "@material-ui/icons/Menu";

import Logo from "../../assets/FilledLaserableLogo.svg";

import { ScopedThunkDispatch, State as ReduxState } from "ui/reducer";
import { logoutUserAction } from "ui/auth/actions";
import { AuthMember } from "ui/auth/interfaces";
import { memberIsAdmin, memberIsBoardMember, memberIsResourceManager } from "ui/member/utils";
import { Routing, Whitelists } from "app/constants";
import Help from "ui/common/Help";

interface OwnProps extends RouteComponentProps<any> {}
interface StateProps {
  currentUser: AuthMember;
  authRequesting: boolean;
  billingEnabled: boolean;
  earnedMembershipEnabled: boolean;
}
interface DispatchProps {
  logout: () => void;
}
interface Props extends OwnProps, StateProps, DispatchProps {}
interface State {
  authOpen: boolean;
  anchorEl: HTMLElement;
}

const roleBadge = (currentUser: AuthMember): JSX.Element | null => {
  if (currentUser.isAdmin) {
    return (
      <Chip
        label="Admin"
        size="small"
        style={{
          marginLeft: 8, height: 20, fontSize: 10,
          backgroundColor: "#d32f2f", color: "#fff",
          fontWeight: 700, letterSpacing: "0.05em"
        }}
      />
    );
  }
  if (currentUser.isBoardMember) {
    return (
      <Chip
        label="Board"
        size="small"
        style={{
          marginLeft: 8, height: 20, fontSize: 10,
          backgroundColor: "#7b1fa2", color: "#fff",
          fontWeight: 700, letterSpacing: "0.05em"
        }}
      />
    );
  }
  if (currentUser.isResourceManager) {
    return (
      <Chip
        label="RM"
        size="small"
        style={{
          marginLeft: 8, height: 20, fontSize: 10,
          backgroundColor: "#1565c0", color: "#fff",
          fontWeight: 700, letterSpacing: "0.05em"
        }}
      />
    );
  }
  return null;
};

class Header extends React.Component<Props, State> {

  constructor(props: Props) {
    super(props);
    this.state = { authOpen: false, anchorEl: null };
  }

  private attachMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    this.setState({ anchorEl: event.currentTarget });
  }

  private detachMenu = () => {
    this.setState({ anchorEl: null });
  };

  private renderMenuNavLink = (path: string, label: string, id: string) => {
    const match = this.props.location && this.props.location.pathname === path;
    return (
      <Link key={id} id={id} to={path} style={{ outline: "none", textDecoration: "none", color: "unset" }} onClick={this.detachMenu}>
        <MenuItem selected={match}>{label}</MenuItem>
      </Link>
    );
  }

  private renderLoginLink = () => {
    return (
      <Link to={Routing.Login} style={{ outline: "none", textDecoration: "none", color: "unset" }}>
        <MenuItem component={Typography as any}>
          Already a member? Login
        </MenuItem>
      </Link>
    );
  }

  private renderHambMenu = (): JSX.Element => {
    const { currentUser, billingEnabled, earnedMembershipEnabled } = this.props;
    const { anchorEl } = this.state;
    const menuOpen = Boolean(anchorEl);
    const profileUrl = Routing.Profile.replace(Routing.PathPlaceholder.MemberId, currentUser.id);
    const settingsUrl = Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUser.id);

    const isAdmin = currentUser.isAdmin;
    const isBoardMember = currentUser.isBoardMember;
    const isRM = currentUser.isResourceManager;

    // Access levels
    const isAdminOrBoard = isAdmin || isBoardMember;
    const isPrivileged   = isAdmin || isBoardMember || isRM;
    const canManageShopFees    = isPrivileged;
    const canManageCheckouts   = isPrivileged || (currentUser as any).isCheckoutApprover;
    const canManageVolunteer   = isPrivileged;
    const canManageRentals     = isPrivileged;

    // Privileged menu items — alphabetized
    const privilegedItems: JSX.Element[] = [
      ...(billingEnabled && isAdminOrBoard ? [this.renderMenuNavLink(Routing.Billing, "Billing", "billing")] : []),
      ...(earnedMembershipEnabled && isAdminOrBoard ? [this.renderMenuNavLink(Routing.EarnedMemberships, "Earned Memberships", "earnedMembership")] : []),
      ...(isPrivileged ? [this.renderMenuNavLink(Routing.Members, "Members", "members")] : []),
      ...(isAdmin ? [this.renderMenuNavLink(Routing.SystemSettings, "Portal Settings", "system-settings")] : []),
      ...(canManageRentals ? [this.renderMenuNavLink(Routing.AdminRentals, "Rentals", "rentals")] : []),
      ...(canManageShopFees ? [this.renderMenuNavLink(Routing.ShopFees, "Shop Fees", "shop-fees")] : []),
      ...(canManageCheckouts ? [this.renderMenuNavLink(Routing.ToolCheckouts, "Tool Checkouts", "tool-checkouts")] : []),
      ...(canManageVolunteer ? [this.renderMenuNavLink(Routing.Volunteer, "Volunteer", "volunteer")] : []),
    ];

    return (
      <>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <Typography variant="body1" color="secondary">
            {currentUser.firstname} {currentUser.lastname}
          </Typography>
          {roleBadge(currentUser)}
        </span>
        <IconButton
          id="menu-button"
          className="menu-button"
          color="inherit"
          aria-label="Menu"
          onClick={this.attachMenu}
        >
          <MenuIcon />
        </IconButton>
        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          transitionDuration={0}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          open={menuOpen}
          onClose={this.detachMenu}
        >
          {/* Member section */}
          {this.renderMenuNavLink(settingsUrl, "Account Settings", "settings")}
          {this.renderMenuNavLink(profileUrl, "My Profile", "profile")}

          {/* Privileged section */}
          {privilegedItems.length > 0 && <Divider />}
          {privilegedItems}

          {/* Logout */}
          <Divider />
          <MenuItem id="logout" onClick={this.logoutUser} style={{ color: "#d32f2f" }}>
            Logout
          </MenuItem>
        </Menu>
      </>
    );
  }

  private logoutUser = () => {
    const { logout } = this.props;
    logout();
    this.detachMenu();
  }

  public render(): JSX.Element {
    const { currentUser, authRequesting } = this.props;
    return (
      <AppBar style={{ marginBottom: "1em" }} position="static" color="default" title="Manchester Makerspace">
        <Toolbar>
          <Typography variant="h6" color="inherit" className="flex">
            <Logo alt="Manchester Makerspace" viewBox="0 0 960 580" preserveAspectRatio="xMinYMin" />
          </Typography>
          <Help />
          {currentUser.id ? this.renderHambMenu() : (!authRequesting && this.renderLoginLink())}
        </Toolbar>
      </AppBar>
    );
  }
}

const mapStateToProps = (state: ReduxState, _ownProps: OwnProps): StateProps => {
  const { auth: { currentUser, isRequesting, permissions } } = state;
  return {
    currentUser,
    billingEnabled: !!permissions[Whitelists.billing] || false,
    earnedMembershipEnabled: (memberIsAdmin(currentUser) || memberIsBoardMember(currentUser)) && !!permissions[Whitelists.earnedMembership] || false,
    authRequesting: isRequesting
  };
};

const mapDispatchToProps = (dispatch: ScopedThunkDispatch): DispatchProps => {
  return { logout: () => dispatch(logoutUserAction()) };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Header));
