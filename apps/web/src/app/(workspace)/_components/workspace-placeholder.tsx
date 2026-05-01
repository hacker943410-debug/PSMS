import {
  DataTable,
  type DataTableColumn,
  MetricCard,
  PageIntro,
  Panel,
  TonePill,
  type TonePillTone,
} from "@/components/workspace";

export type PlaceholderStatus =
  | "Static placeholder"
  | "Wizard placeholder"
  | "Admin placeholder"
  | "Report placeholder";

type WorkspacePlaceholderProps = {
  title: string;
  route: string;
  status: PlaceholderStatus;
  description: string;
  searchParams: string[];
  features: string[];
  access?: "ADMIN/STAFF" | "ADMIN only";
};

type FeatureRow = {
  id: string;
  label: string;
  status: "planned";
};

const statusTone: Record<PlaceholderStatus, TonePillTone> = {
  "Static placeholder": "info",
  "Wizard placeholder": "warning",
  "Admin placeholder": "warning",
  "Report placeholder": "info",
};

const featureColumns: DataTableColumn<FeatureRow>[] = [
  {
    key: "feature",
    header: "Planned feature",
    cell: (row) => (
      <span className="font-medium text-slate-900">{row.label}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: () => <TonePill tone="warning">Planned</TonePill>,
  },
];

export function WorkspacePlaceholder({
  title,
  route,
  status,
  description,
  searchParams,
  features,
  access = "ADMIN/STAFF",
}: WorkspacePlaceholderProps) {
  const featureRows = features.map((feature, index) => ({
    id: `${route}-feature-${index}`,
    label: feature,
    status: "planned" as const,
  }));

  return (
    <>
      <PageIntro
        eyebrow="Workspace route"
        title={title}
        description={description}
        meta={
          <>
            <TonePill tone={statusTone[status]}>{status}</TonePill>
            <TonePill tone="neutral">{route}</TonePill>
            <TonePill tone={access === "ADMIN only" ? "warning" : "success"}>
              {access}
            </TonePill>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Route"
          value={route}
          helper="Documented App Router workspace path"
          trend="Static"
          tone="info"
        />
        <MetricCard
          label="Current status"
          value={status}
          helper="No server actions, DB queries, or auth changes are connected"
          trend="Guarded"
          tone={statusTone[status]}
        />
        <MetricCard
          label="Search params"
          value={searchParams.length}
          helper="Planned URL-driven filters and drawer state"
          trend="Planned"
          tone="neutral"
        />
      </section>

      <Panel
        title="Planned search params"
        description="These params are documented for this route and will be wired when data fetching and interactions are implemented."
      >
        <div className="flex flex-wrap gap-2">
          {searchParams.map((param) => (
            <TonePill key={param} tone="neutral">
              {param}
            </TonePill>
          ))}
        </div>
      </Panel>

      <DataTable
        caption={`${title} planned features`}
        columns={featureColumns}
        data={featureRows}
        getRowKey={(row) => row.id}
      />
    </>
  );
}
