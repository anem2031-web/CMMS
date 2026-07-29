import { relations } from "drizzle-orm/relations";
import { constructionPhases, constructionActivities, constructionProjects, constructionAutomations, constructionChangeOrders, constructionCustomFields, constructionDailyReports, constructionFieldValues, constructionTasks, constructionGoals, constructionProjectMembers, constructionQuantityTracking, constructionSafetyLogs, constructionTaskComments, constructionTaskDependencies, constructionTimeLogs, purchaseOrderItems, inventoryTransactions, purchaseOrders, warehouseReceiptItems } from "./schema";

export const constructionActivitiesRelations = relations(constructionActivities, ({one, many}) => ({
	constructionPhase: one(constructionPhases, {
		fields: [constructionActivities.phaseId],
		references: [constructionPhases.id]
	}),
	constructionProject: one(constructionProjects, {
		fields: [constructionActivities.projectId],
		references: [constructionProjects.id]
	}),
	constructionTasks: many(constructionTasks),
}));

export const constructionPhasesRelations = relations(constructionPhases, ({one, many}) => ({
	constructionActivities: many(constructionActivities),
	constructionProject: one(constructionProjects, {
		fields: [constructionPhases.projectId],
		references: [constructionProjects.id]
	}),
	constructionTasks: many(constructionTasks),
}));

export const constructionProjectsRelations = relations(constructionProjects, ({many}) => ({
	constructionActivities: many(constructionActivities),
	constructionAutomations: many(constructionAutomations),
	constructionChangeOrders: many(constructionChangeOrders),
	constructionCustomFields: many(constructionCustomFields),
	constructionDailyReports: many(constructionDailyReports),
	constructionGoals: many(constructionGoals),
	constructionPhases: many(constructionPhases),
	constructionProjectMembers: many(constructionProjectMembers),
	constructionQuantityTrackings: many(constructionQuantityTracking),
	constructionSafetyLogs: many(constructionSafetyLogs),
	constructionTasks: many(constructionTasks),
}));

export const constructionAutomationsRelations = relations(constructionAutomations, ({one}) => ({
	constructionProject: one(constructionProjects, {
		fields: [constructionAutomations.projectId],
		references: [constructionProjects.id]
	}),
}));

export const constructionChangeOrdersRelations = relations(constructionChangeOrders, ({one}) => ({
	constructionProject: one(constructionProjects, {
		fields: [constructionChangeOrders.projectId],
		references: [constructionProjects.id]
	}),
}));

export const constructionCustomFieldsRelations = relations(constructionCustomFields, ({one, many}) => ({
	constructionProject: one(constructionProjects, {
		fields: [constructionCustomFields.projectId],
		references: [constructionProjects.id]
	}),
	constructionFieldValues: many(constructionFieldValues),
}));

export const constructionDailyReportsRelations = relations(constructionDailyReports, ({one}) => ({
	constructionProject: one(constructionProjects, {
		fields: [constructionDailyReports.projectId],
		references: [constructionProjects.id]
	}),
}));

export const constructionFieldValuesRelations = relations(constructionFieldValues, ({one}) => ({
	constructionCustomField: one(constructionCustomFields, {
		fields: [constructionFieldValues.fieldId],
		references: [constructionCustomFields.id]
	}),
	constructionTask: one(constructionTasks, {
		fields: [constructionFieldValues.taskId],
		references: [constructionTasks.id]
	}),
}));

export const constructionTasksRelations = relations(constructionTasks, ({one, many}) => ({
	constructionFieldValues: many(constructionFieldValues),
	constructionQuantityTrackings: many(constructionQuantityTracking),
	constructionTaskComments: many(constructionTaskComments),
	constructionTaskDependencies_taskId: many(constructionTaskDependencies, {
		relationName: "constructionTaskDependencies_taskId_constructionTasks_id"
	}),
	constructionTaskDependencies_dependsOnTaskId: many(constructionTaskDependencies, {
		relationName: "constructionTaskDependencies_dependsOnTaskId_constructionTasks_id"
	}),
	constructionActivity: one(constructionActivities, {
		fields: [constructionTasks.activityId],
		references: [constructionActivities.id]
	}),
	constructionPhase: one(constructionPhases, {
		fields: [constructionTasks.phaseId],
		references: [constructionPhases.id]
	}),
	constructionProject: one(constructionProjects, {
		fields: [constructionTasks.projectId],
		references: [constructionProjects.id]
	}),
	constructionTimeLogs: many(constructionTimeLogs),
}));

export const constructionGoalsRelations = relations(constructionGoals, ({one}) => ({
	constructionProject: one(constructionProjects, {
		fields: [constructionGoals.projectId],
		references: [constructionProjects.id]
	}),
}));

export const constructionProjectMembersRelations = relations(constructionProjectMembers, ({one}) => ({
	constructionProject: one(constructionProjects, {
		fields: [constructionProjectMembers.projectId],
		references: [constructionProjects.id]
	}),
}));

export const constructionQuantityTrackingRelations = relations(constructionQuantityTracking, ({one}) => ({
	constructionTask: one(constructionTasks, {
		fields: [constructionQuantityTracking.taskId],
		references: [constructionTasks.id]
	}),
	constructionProject: one(constructionProjects, {
		fields: [constructionQuantityTracking.projectId],
		references: [constructionProjects.id]
	}),
}));

export const constructionSafetyLogsRelations = relations(constructionSafetyLogs, ({one}) => ({
	constructionProject: one(constructionProjects, {
		fields: [constructionSafetyLogs.projectId],
		references: [constructionProjects.id]
	}),
}));

export const constructionTaskCommentsRelations = relations(constructionTaskComments, ({one}) => ({
	constructionTask: one(constructionTasks, {
		fields: [constructionTaskComments.taskId],
		references: [constructionTasks.id]
	}),
}));

export const constructionTaskDependenciesRelations = relations(constructionTaskDependencies, ({one}) => ({
	constructionTask_taskId: one(constructionTasks, {
		fields: [constructionTaskDependencies.taskId],
		references: [constructionTasks.id],
		relationName: "constructionTaskDependencies_taskId_constructionTasks_id"
	}),
	constructionTask_dependsOnTaskId: one(constructionTasks, {
		fields: [constructionTaskDependencies.dependsOnTaskId],
		references: [constructionTasks.id],
		relationName: "constructionTaskDependencies_dependsOnTaskId_constructionTasks_id"
	}),
}));

export const constructionTimeLogsRelations = relations(constructionTimeLogs, ({one}) => ({
	constructionTask: one(constructionTasks, {
		fields: [constructionTimeLogs.taskId],
		references: [constructionTasks.id]
	}),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({one}) => ({
	purchaseOrderItem: one(purchaseOrderItems, {
		fields: [inventoryTransactions.purchaseOrderItemId],
		references: [purchaseOrderItems.id]
	}),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({one, many}) => ({
	inventoryTransactions: many(inventoryTransactions),
	purchaseOrder: one(purchaseOrders, {
		fields: [purchaseOrderItems.purchaseOrderId],
		references: [purchaseOrders.id]
	}),
	warehouseReceiptItems: many(warehouseReceiptItems),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({many}) => ({
	purchaseOrderItems: many(purchaseOrderItems),
}));

export const warehouseReceiptItemsRelations = relations(warehouseReceiptItems, ({one}) => ({
	purchaseOrderItem: one(purchaseOrderItems, {
		fields: [warehouseReceiptItems.purchaseOrderItemId],
		references: [purchaseOrderItems.id]
	}),
}));