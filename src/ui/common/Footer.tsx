import * as React from "react";
import { connect } from "react-redux";

import { ScopedThunkDispatch } from "ui/reducer";
import { logoutUserAction } from "ui/auth/actions";

interface DispatchProps {
  logout: () => Promise<void>;
}

type Props = DispatchProps;

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "24px",
  padding: "20px 12px",
  marginTop: "24px",
};

const iconStyle: React.CSSProperties = {
  fontSize: "36px",
  lineHeight: 1,
};

const linkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const mailtoHref = `mailto:${"contact@manchestermakerspace.org"}?subject=${encodeURIComponent("Member Portal assistance request")}`;

const FooterBase: React.FC<Props> = ({ logout }) => {
  const logoutAndGo = async (event: any, href: string) => {
    event.preventDefault();
    try {
      await logout();
    } finally {
      window.location.assign(href);
    }
  };

  return (
    <footer style={footerStyle}>
      <a href="https://manchestermakerspace.org/" style={linkStyle} aria-label="Public Home" title="Public Home" onClick={(e) => logoutAndGo(e, "https://manchestermakerspace.org/")}>
        <span className="material-symbols-rounded" style={iconStyle}>home</span>
      </a>
      <a href="https://wiki.manchestermakerspace.org/" style={linkStyle} aria-label="Public Wiki" title="Public Wiki" onClick={(e) => logoutAndGo(e, "https://wiki.manchestermakerspace.org/")}>
        <span className="material-symbols-rounded" style={iconStyle}>help_center</span>
      </a>
      <a href="https://manchestermakerspace.org/calendar" style={linkStyle} aria-label="Event Calendar" title="Event Calendar" onClick={(e) => logoutAndGo(e, "https://manchestermakerspace.org/calendar")}>
        <span className="material-symbols-rounded" style={iconStyle}>calendar_month</span>
      </a>
      <a href="https://manchestermakerspace.slack.com/archives/C29L2UMDF" style={linkStyle} aria-label="Chat with us on Slack" title="Chat with us on Slack" onClick={(e) => logoutAndGo(e, "https://manchestermakerspace.slack.com/archives/C29L2UMDF")}>
        <span className="material-symbols-rounded" style={iconStyle}>chat</span>
      </a>
      <a href={mailtoHref} style={linkStyle} aria-label="Contact us via Email" title="Contact Us" onClick={(e) => logoutAndGo(e, mailtoHref)}>
        <span className="material-symbols-rounded" style={iconStyle}>mail</span>
      </a>
    </footer>
  );
};

const mapDispatchToProps = (dispatch: ScopedThunkDispatch): DispatchProps => ({
  logout: () => dispatch(logoutUserAction()),
});

export default connect<{}, DispatchProps, {}, any>(null, mapDispatchToProps)(FooterBase as any);
