import * as React from "react";
import HomeIcon from '@mui/icons-material/Home';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChatIcon from '@mui/icons-material/Chat';
import EmailIcon from '@mui/icons-material/Email';
import { platform } from 'app/platform';
import { connect } from "react-redux";

import { ScopedThunkDispatch } from "ui/reducer";
import { logoutUserAction } from "ui/auth/actions";
import { getClientConfig } from "api/clientConfig";
import { contactMailto } from "ui/common/contact";

interface DispatchProps {
  logout: () => Promise<void>;
}

type Props = DispatchProps;

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  padding: "20px 12px",
  marginTop: "24px",
};

const iconStyle: React.CSSProperties = {
  fontSize: "36px",
  lineHeight: 1,
};

const linkStyle: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  color: "inherit",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const mailtoHref = contactMailto("Member Portal assistance request");

const FooterBase: React.FC<Props> = ({ logout }) => {
  const [wikiUrl, setWikiUrl] = React.useState("");

  React.useEffect(() => {
    let active = true;
    getClientConfig()
      .then(config => active && setWikiUrl(config.wiki_url))
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const logoutAndGo = async (event: any, href: string) => {
    event.preventDefault();
    if (platform.native) {
      try { await platform.openExternal?.(href); } catch { window.dispatchEvent(new Event('mms:link-error')); }
      return;
    }
    try {
      await logout();
    } finally {
      window.location.assign(href);
    }
  };

  return (
    <footer style={footerStyle}>
      <a href="https://manchestermakerspace.org/" style={linkStyle} aria-label="Public Home" title="Public Home" onClick={(e) => logoutAndGo(e, "https://manchestermakerspace.org/")}>
        <HomeIcon style={iconStyle} />
      </a>
      {wikiUrl &&
        <a href={wikiUrl} style={linkStyle} aria-label="Public Wiki" title="Public Wiki" onClick={(e) => logoutAndGo(e, wikiUrl)}>
          <HelpCenterIcon style={iconStyle} />
        </a>}
      <a href="https://manchestermakerspace.org/calendar" style={linkStyle} aria-label="Event Calendar" title="Event Calendar" onClick={(e) => logoutAndGo(e, "https://manchestermakerspace.org/calendar")}>
        <CalendarMonthIcon style={iconStyle} />
      </a>
      <a href="https://manchestermakerspace.slack.com/archives/C29L2UMDF" style={linkStyle} aria-label="Chat with us on Slack" title="Chat with us on Slack" onClick={(e) => logoutAndGo(e, "https://manchestermakerspace.slack.com/archives/C29L2UMDF")}>
        <ChatIcon style={iconStyle} />
      </a>
      <a href={mailtoHref} style={linkStyle} aria-label="Contact us via Email" title="Contact Us" onClick={(e) => logoutAndGo(e, mailtoHref)}>
        <EmailIcon style={iconStyle} />
      </a>
    </footer>
  );
};

const mapDispatchToProps = (dispatch: ScopedThunkDispatch): DispatchProps => ({
  logout: () => dispatch(logoutUserAction()),
});

export default connect<{}, DispatchProps, {}, any>(null, mapDispatchToProps)(FooterBase as any);
