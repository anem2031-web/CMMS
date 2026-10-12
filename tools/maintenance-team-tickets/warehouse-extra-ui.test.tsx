import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemo } from "../../server/maintenance-team-tickets/testing/fixture";

const fixture = vi.hoisted(() => ({
  hooks: [] as any[],
  index: 0,
  inputs: new Map<string, any>(),
  buttons: new Map<string, any>(),
  state: null as any,
  balances: [{ needId: 12, branch: 0, main: 0 }],
  navigate: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: any) => {
      const index = fixture.index++;
      if (!(index in fixture.hooks))
        fixture.hooks[index] =
          typeof initial === "function" ? initial() : initial;
      return [
        fixture.hooks[index],
        (value: any) => {
          fixture.hooks[index] =
            typeof value === "function" ? value(fixture.hooks[index]) : value;
        },
      ];
    },
  };
});
const text = (node: any): string =>
  node == null
    ? ""
    : Array.isArray(node)
      ? node.map(text).join("")
      : typeof node === "object"
        ? text(node.props?.children)
        : String(node);
vi.mock("../../client/src/components/ui/input", () => ({
  Input: (props: any) => {
    fixture.inputs.set(props.id, props);
    return <input {...props} />;
  },
}));
vi.mock("../../client/src/components/ui/button", () => ({
  Button: (props: any) => {
    fixture.buttons.set(text(props.children), props);
    return (
      <button disabled={props.disabled} className={props.className}>
        {props.children}
      </button>
    );
  },
}));
vi.mock("../../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      client: {
        ticketTeamExecution: { prepareSupply: { mutate: fixture.prepare } },
      },
      ticketTeamExecution: { balances: { invalidate: vi.fn() } },
      ticketTeamAssignments: {
        queue: { invalidate: vi.fn() },
        warehouseRequests: { invalidate: vi.fn() },
      },
    }),
    ticketTeamExecution: {
      details: {
        useQuery: () => ({
          data: fixture.state,
          isLoading: false,
          refetch: vi.fn(),
        }),
      },
      catalog: { useQuery: () => ({ data: [] }) },
      preview: {
        useQuery: () => ({ data: null, error: null, isFetching: false }),
      },
      balances: { useQuery: () => ({ data: fixture.balances }) },
    },
  },
}));
import { WarehousePurchaseQuantities } from "../../client/src/pages/maintenance-teams/WarehousePurchaseQuantities";
import { ExecutionPanel } from "../../client/src/pages/maintenance-teams/ExecutionPanel";

beforeEach(() => {
  fixture.hooks = [];
  fixture.index = 0;
  fixture.inputs.clear();
  fixture.buttons.clear();
  fixture.navigate.mockReset();
  fixture.prepare.mockReset();
  fixture.balances = [{ needId: 12, branch: 0, main: 0 }];
  vi.stubGlobal("window", { location: { assign: fixture.navigate } });
});
const fields = (
  extra = "3",
  purchaseQuantity: number | null = 5,
  language = "ar",
  disabled = false,
  onExtraChange = vi.fn()
) =>
  renderToStaticMarkup(
    <WarehousePurchaseQuantities
      id="test"
      technicianQuantity={5}
      purchaseQuantity={purchaseQuantity}
      extra={extra}
      unit="حبة"
      language={language}
      disabled={disabled}
      onExtraChange={onExtraChange}
    />
  );
async function initPanel() {
  const d = createDemo();
  await d.service.assign(1, {
    ...(await d.store.read()).tickets[0],
    teamId: 21,
  });
  fixture.state = await d.store.read();
  fixture.state.assignments[0].stage = "waiting_material";
  fixture.state.needs.push({
    id: 12,
    assignmentId: fixture.state.assignments[0].id,
    catalogItemId: 103,
    name: "حساس",
    originalName: "حساس",
    unit: "حبة",
    requested: 5,
    requestedById: 3,
    used: null,
    round: 1,
    warehouseId: 20,
  });
  fixture.prepare.mockResolvedValue({
    assignmentId: fixture.state.assignments[0].id,
    needId: 12,
    revision: 2,
    ticketId: 1001,
    ticketItemId: 5001,
    ticketNumber: "MT-1",
    catalogItemId: 103,
    name: "حساس",
    unit: "حبة",
    quantity: 5,
    location: { siteId: 1, sectionId: 11 },
    mainWarehouseId: 10,
    warehouseId: 20,
  });
}
function panel(
  role = "warehouse",
  mode: "warehouse" | "execution" = "warehouse"
) {
  fixture.index = 0;
  return renderToStaticMarkup(
    <ExecutionPanel
      assignmentId={fixture.state.assignments[0].id}
      actorId={role === "technician" ? 3 : 2}
      role={role}
      language="ar"
      mode={mode}
      onChanged={() => {}}
    />
  );
}
describe("warehouse extra quantity with isolated UI/API boundaries", () => {
  it("5 + 3 shows 8 with blue technician, amber extra and green total", () => {
    const html = fields();
    expect(fixture.inputs.get("test-total").value).toBe(8);
    expect(html).toContain("كمية الفني");
    expect(html).toContain("إضافة المستودع للتخزين");
    expect(html).toContain("إجمالي طلب الشراء");
    expect(html).toContain("border-blue-200");
    expect(html).toContain("border-amber-200");
    expect(html).toContain("border-emerald-200");
  });
  it("technician and total are read-only; extra uses the controlled parent value", () => {
    const onChange = vi.fn();
    fields("0", 5, "ar", false, onChange);
    expect(fixture.inputs.get("test-technician").readOnly).toBe(true);
    expect(fixture.inputs.get("test-total").readOnly).toBe(true);
    fixture.inputs.get("test-warehouse").onChange({ target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith("3");
    fields("3");
    expect(fixture.inputs.get("test-total").value).toBe(8);
  });
  it("partial existing coverage shows purchase 2 + extra 3 = 5 without changing requested 5", () => {
    const html = fields("3", 2);
    expect(fixture.inputs.get("test-technician").value).toBe(5);
    expect(fixture.inputs.get("test-total").value).toBe(5);
    expect(html).toContain("الشراء للتذكرة: 2 حبة");
  });
  it("invalid or unknown inputs never invent an order total", () => {
    for (const extra of ["", "-1", "0.5", "NaN", "2147483647"]) {
      expect(fields(extra)).toContain('role="alert"');
      expect(fixture.inputs.get("test-total").value).toBe("—");
    }
    fields("3", null);
    expect(fixture.inputs.get("test-total").value).toBe("—");
  });
  it("busy/pending controls and Arabic/English/Urdu labels are supported", () => {
    fields("3", 5, "ar", true);
    expect(fixture.inputs.get("test-warehouse").disabled).toBe(true);
    expect(fields("3", 5, "en")).toContain("Extra warehouse stock");
    expect(fields("3", 5, "ur")).toContain("گودام کے لیے اضافی اسٹاک");
  });
  it("warehouse action carries extra separately to the original purchase form", async () => {
    await initPanel();
    panel();
    const id = `need-${fixture.state.assignments[0].id}-12-warehouse`;
    fixture.inputs.get(id).onChange({ target: { value: "3" } });
    panel();
    expect(fixture.buttons.get("طلب شراء العجز").className).toContain("amber");
    fixture.buttons.get("طلب شراء العجز").onClick();
    await vi.waitFor(() => expect(fixture.navigate).toHaveBeenCalledOnce());
    const url = new URL(
      fixture.navigate.mock.calls[0][0],
      "http://mock.invalid"
    );
    expect(url.pathname).toBe("/purchase-orders/new");
    expect(url.searchParams.get("ticketWarehouseExtraQuantity")).toBe("3");
    expect(url.searchParams.get("ticketTechnicianQuantity")).toBe("5");
    expect(url.searchParams.get("ticketMinimumQuantity")).toBe("5");
    expect(url.searchParams.has("pmv2RequestItemId")).toBe(false);
  });
  it("invalid extra disables purchasing and is not available to the technician", async () => {
    await initPanel();
    panel();
    fixture.inputs
      .get(`need-${fixture.state.assignments[0].id}-12-warehouse`)
      .onChange({ target: { value: "-1" } });
    panel();
    expect(fixture.buttons.get("طلب شراء العجز").disabled).toBe(true);
    fixture.inputs.clear();
    const html = panel("technician", "execution");
    expect(html).not.toContain("إضافة المستودع للتخزين");
  });
  it("each need has an independent warehouse extra and ready issue stays at ticket quantity", async () => {
    await initPanel();
    fixture.state.needs.push({
      ...fixture.state.needs[0],
      id: 13,
      catalogItemId: 102,
      requested: 2,
    });
    fixture.balances.push({ needId: 13, branch: 0, main: 0 });
    panel();
    const prefix = `need-${fixture.state.assignments[0].id}`;
    fixture.inputs
      .get(`${prefix}-12-warehouse`)
      .onChange({ target: { value: "3" } });
    panel();
    expect(fixture.inputs.get(`${prefix}-12-total`).value).toBe(8);
    expect(fixture.inputs.get(`${prefix}-13-total`).value).toBe(2);
  });
});
