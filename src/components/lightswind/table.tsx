import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from "lucide-react";

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Disables outer scroll container wrapper */
  noScroll?: boolean;
  /** Reduces cell padding for high-density data views */
  dense?: boolean;
  /** Adds subtle row hover background highlight */
  hoverable?: boolean;
  /** Alternating zebra stripe backgrounds for rows */
  striped?: boolean;
  /** Adds full grid borders around table cells */
  bordered?: boolean;
  /** Fixes table header to top during scrolling */
  stickyHeader?: boolean;
}

const TableContext = React.createContext<{
  dense?: boolean;
  hoverable?: boolean;
  striped?: boolean;
  bordered?: boolean;
}>({});

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      noScroll,
      dense = false,
      hoverable = true,
      striped = false,
      bordered = false,
      stickyHeader = false,
      children,
      ...props
    },
    ref
  ) => {
    const table = (
      <TableContext.Provider value={{ dense, hoverable, striped, bordered }}>
        <table
          ref={ref}
          className={cn(
            "w-full text-sm text-left border-collapse",
            bordered && "border border-border",
            className
          )}
          {...props}
        >
          {children}
        </table>
      </TableContext.Provider>
    );

    if (noScroll) return table;

    return (
      <div
        className={cn(
          "relative w-full rounded-xl border border-border bg-background shadow-sm overflow-hidden transition-all duration-300",
          bordered && "border-2",

        )}
      >
        <div
          className={cn(
            "w-full overflow-auto max-h-[calc(80vh-70px)] custom-scrollbar",
            stickyHeader && "relative"
          )}
          data-lenis-prevent
        >
          {table}
        </div>
      </div>
    );
  }
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "sticky top-0 z-10 bg-muted border-b border-border text-foreground",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-border", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-border bg-secondary/50 font-medium text-muted-foreground transition-all duration-300",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Highlights the row as selected */
  selected?: boolean;
  /** Shows cursor pointer on hover */
  clickable?: boolean;
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected = false, clickable = false, ...props }, ref) => {
    const { hoverable, striped } = React.useContext(TableContext);

    return (
      <tr
        ref={ref}
        className={cn(
          "transition-colors",
          hoverable && "hover:bg-muted",
          striped && "even:bg-secondary/40",
          selected && "bg-accent font-medium",
          clickable && "cursor-pointer select-none",
          /* 3D Mode Row Styling */
          className
        )}
        data-state={selected ? "selected" : undefined}
        {...props}
      />
    );
  }
);
TableRow.displayName = "TableRow";

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Enables sortable column header button styling */
  sortable?: boolean;
  /** Current active sort direction */
  sortDirection?: "asc" | "desc" | false;
  /** Callback triggered when column header is clicked */
  onSort?: () => void;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  (
    {
      className,
      align = "left",
      sortable = false,
      sortDirection = false,
      onSort,
      children,
      ...props
    },
    ref
  ) => {
    const { dense, bordered } = React.useContext(TableContext);

    const alignmentClasses = {
      left: "text-left justify-start",
      center: "text-center justify-center",
      right: "text-right justify-end",
    };

    return (
      <th
        ref={ref}
        className={cn(
          "align-middle font-semibold text-muted-foreground transition-all duration-200 select-none",
          dense ? "h-9 px-3 text-xs" : "h-11 px-4 text-xs tracking-wide uppercase",
          bordered && "border-r border-border last:border-r-0",
          sortable && "cursor-pointer hover:bg-muted",
          className
        )}
        onClick={sortable ? onSort : undefined}
        {...props}
      >
        <div className={cn("inline-flex items-center gap-1.5 w-full", alignmentClasses[align])}>
          <span>{children}</span>
          {sortable && (
            <span className="shrink-0 text-muted-foreground">
              {sortDirection === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-primary" />
              ) : sortDirection === "desc" ? (
                <ArrowDown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
              )}
            </span>
          )}
        </div>
      </th>
    );
  }
);
TableHead.displayName = "TableHead";

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Text alignment */
  align?: "left" | "center" | "right";
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align = "left", ...props }, ref) => {
    const { dense, bordered } = React.useContext(TableContext);

    const alignmentClasses = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    };

    return (
      <td
        ref={ref}
        className={cn(
          "align-middle text-foreground/90",
          dense ? "py-2 px-3 text-xs" : "py-3.5 px-4 text-sm",
          bordered && "border-r border-border last:border-r-0",
          alignmentClasses[align],
          className
        )}
        {...props}
      />
    );
  }
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("py-3 text-xs text-muted-foreground font-medium", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

/** Ready-to-use empty state placeholder inside tables */
const TableEmptyState: React.FC<{
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  colSpan?: number;
}> = ({
  icon = <Inbox className="w-8 h-8 text-muted-foreground/60" />,
  title = "No results found",
  description = "No matching records were found for your current query.",
  action,
  colSpan = 10,
}) => (
  <tr>
    <td colSpan={colSpan} className="py-12 text-center">
      <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
        <div className="p-3 rounded-full bg-muted mb-1">
          {icon}
        </div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </td>
  </tr>
);

/** Skeleton loading rows for table async loading */
const TableSkeletonRows: React.FC<{
  rows?: number;
  columns?: number;
}> = ({ rows = 5, columns = 4 }) => (
  <>
    {Array.from({ length: rows }).map((_, rIdx) => (
      <tr key={rIdx} className="animate-pulse">
        {Array.from({ length: columns }).map((_, cIdx) => (
          <td key={cIdx} className="py-3.5 px-4">
            <div className="h-4 bg-muted rounded-md w-full max-w-[120px]" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmptyState,
  TableSkeletonRows,
};