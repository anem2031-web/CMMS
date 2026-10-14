import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ticketTeamNotificationPath,
  warehouseRequestsSelection,
  warehouseRequestsLink,
  TICKET_MATERIAL_REQUEST_EVENT,
} from "../../../shared/maintenance-team-tickets/warehouse-navigation";

test("material notification opens the warehouse ticket tab and its original ticket", () => {
  const link = ticketTeamNotificationPath(TICKET_MATERIAL_REQUEST_EVENT, 566)!;
  assert.equal(
    link,
    "/scheduled-maintenance/warehouse-requests?source=tickets&ticketId=566"
  );
  assert.deepEqual(warehouseRequestsSelection(link.split("?")[1]), {
    source: "tickets",
    ticketId: 566,
  });
});
test("other team notifications retain the technician execution window", () => {
  assert.equal(
    ticketTeamNotificationPath("ticket_team_action", 566),
    "/maintenance-team-tickets"
  );
  assert.equal(ticketTeamNotificationPath("purchase_updated", 566), undefined);
});
test("PMV2 remains the default and invalid ticket query IDs never select a ticket", () => {
  assert.equal(warehouseRequestsSelection("").source, "pmv2");
  assert.equal(warehouseRequestsSelection("source=unknown").source, "pmv2");
  for (const id of ["-1", "NaN", "1.5", "Infinity", "9007199254740993", ""]) {
    assert.equal(
      warehouseRequestsSelection(`?source=tickets&ticketId=${id}`).ticketId,
      undefined
    );
  }
  assert.equal(
    warehouseRequestsLink(-1),
    "/scheduled-maintenance/warehouse-requests?source=tickets"
  );
});
