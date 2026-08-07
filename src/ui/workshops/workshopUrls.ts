const googleDriveEmbeddedFolderUrl = (gdriveId: string) =>
  `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(gdriveId)}`;

export { googleDriveEmbeddedFolderUrl };
