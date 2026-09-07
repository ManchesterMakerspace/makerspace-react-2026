import * as React from "react";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import useModal from "ui/hooks/useModal";
import { useAuthState } from "ui/reducer/hooks";
import FormModal from "ui/common/FormModal";
import { getClientConfig } from "api/clientConfig";
import { contactMailto } from "ui/common/contact";

const Help: React.FC = () => {
  const { isOpen, openModal, closeModal } = useModal();
  const { currentUser } = useAuthState();
  const [wikiUrl, setWikiUrl] = React.useState("");
  React.useEffect(() => {
    let active = true;
    getClientConfig()
      .then(config => active && setWikiUrl(config.wiki_url))
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  let subject = "Digital makerspace help requested";
  if (currentUser && currentUser.id) {
    subject += ` from ${currentUser.firstname} ${currentUser.lastname} (#${currentUser.id})`;
  }
  const mailLink = contactMailto(subject);

  return (
    <>
    <Tooltip title="Help">
      <IconButton aria-label="Help" onClick={openModal}>
        <HelpOutlineOutlined fontSize="large" color="primary"/>
      </IconButton>
    </Tooltip>
    {isOpen && (
      <FormModal
        isOpen={true}
        id="help-modal"
        title="Contact Us"
        closeHandler={closeModal}
        cancelText="Close"
      >
        <Typography variant="body1">
          Having trouble using our software? Please don't hesitate to
          {" "}
          <a href={mailLink} >contact us.</a>
        </Typography>
        {wikiUrl && <Typography variant="body1" style={{ marginTop: 12 }}>
          You can also visit the <a href={wikiUrl} target="_blank" rel="noopener noreferrer">Wiki</a>.
        </Typography>}
      </FormModal>
    )}
    </>
  )
}

export default Help;
