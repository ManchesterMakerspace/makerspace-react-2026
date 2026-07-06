interface RuntimeItemsPerPageArgs {
  currentItemCount: number;
  pageNum?: number;
  totalItems?: number;
  previousItemsPerPage?: number;
  fallbackItemsPerPage: number;
}

const isPositiveNumber = (value?: number): value is number => (
  typeof value === "number" && Number.isFinite(value) && value > 0
);

export const getRuntimeItemsPerPage = ({
  currentItemCount,
  pageNum = 0,
  totalItems,
  previousItemsPerPage,
  fallbackItemsPerPage,
}: RuntimeItemsPerPageArgs): number => {
  const fallback = isPositiveNumber(previousItemsPerPage)
    ? previousItemsPerPage
    : fallbackItemsPerPage;

  if (!isPositiveNumber(currentItemCount)) {
    return fallback;
  }

  if (pageNum === 0 && isPositiveNumber(totalItems) && totalItems > currentItemCount) {
    return currentItemCount;
  }

  if (isPositiveNumber(previousItemsPerPage)) {
    return Math.max(previousItemsPerPage, currentItemCount);
  }

  return Math.max(fallbackItemsPerPage, currentItemCount);
};
