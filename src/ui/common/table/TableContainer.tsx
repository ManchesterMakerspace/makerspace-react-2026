// @ts-nocheck
import * as React from "react";
import TablePagination from "@mui/material/TablePagination";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";

import Table, { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import { defaultItemsPerPage } from "ui/constants";
import { getRuntimeItemsPerPage } from "ui/common/table/pagination";

interface Props<T> {
  id: string;
  title?: string;
  columns: Column<T>[];
  data: T[];
  rowId: (row: T) => string;
  selectedIds?: string[];
  pageNum?: number;
  orderBy?: string;
  order?: SortDirection;
  loading?: boolean;
  totalItems?: number;
  error?: string | JSX.Element;
  onPageChange?: (pageNum: number) => void;
  onSearchEnter?: (searchTerm: string) => void;
  onSort?: (columnName: string) => void;
  onSelect?: (rowId: string, selected: boolean) => void;
  onSelectAll?: () => void;
}

interface State {
  itemsPerPage?: number;
}

class TableContainer<T> extends React.Component<Props<T>, State> {

  public state: State = {};

  public static getDerivedStateFromProps<T>(props: Props<T>, state: State): State {
    return {
      itemsPerPage: getRuntimeItemsPerPage({
        currentItemCount: props.data?.length || 0,
        pageNum: props.pageNum,
        totalItems: props.totalItems,
        previousItemsPerPage: state.itemsPerPage,
        fallbackItemsPerPage: defaultItemsPerPage,
      }),
    };
  }

  private onPageChange = (_event: React.ChangeEvent<EventTarget>, newPage: number) => {
    this.props.onPageChange(newPage);
  }

  private onSearchEnter = (event: React.KeyboardEvent<EventTarget>) => {
    if (event.key === "Enter") {
      const searchTerm = (event.target as HTMLInputElement).value;
      this.props.onSearchEnter(searchTerm);
    }
  }

  public render(): JSX.Element {
    const {
      id,
      rowId,
      onSelect,
      onSelectAll,
      onSort,
      columns,
      title,
      data,
      totalItems,
      loading,
      selectedIds,
      pageNum,
      order,
      orderBy,
      onSearchEnter,
      error,
      onPageChange
    } = this.props;
    const itemsPerPage = this.state.itemsPerPage || defaultItemsPerPage;

    return (
      <div className="table-container-wrapper" style={{width: "100%"}}>
        { (title || onSearchEnter) && (
          <Toolbar>
            {title && <Typography id={`${id}-title`} variant="h6" color="inherit" className="flex">
              {title}
            </Typography>}
            {onSearchEnter &&
              <TextField
                id={`${id}-search-input`}
                type="text"
                disabled={loading}
                placeholder="Search..."
                onKeyPress={this.onSearchEnter}
              />
            }
          </Toolbar>
        )}
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <Table
            id={id}
            page={pageNum}
            columns={columns}
            data={data}
            selectedIds={selectedIds}
            order={order}
            orderBy={orderBy}
            rowId={rowId}
            onSelect={onSelect}
            onSort={onSort}
            onSelectAll={onSelectAll}
            error={error}
            loading={loading}
          >
          </Table>
          {totalItems > itemsPerPage && onPageChange && <TablePagination
            component="div"
            count={totalItems || 0}
            rowsPerPage={itemsPerPage}
            rowsPerPageOptions={[]}
            page={pageNum}
            backIconButtonProps={{
              'aria-label': 'Previous Page',
            }}
            nextIconButtonProps={{
              'aria-label': 'Next Page',
            }}
            onPageChange={this.onPageChange}
          />}
        </div>
      </div>
    );
  }
}

export default TableContainer;
