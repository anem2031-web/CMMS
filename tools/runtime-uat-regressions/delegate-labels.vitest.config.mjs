import base from "./pricing-pdf.vitest.config.mjs";
export default {...base,test:{...base.test,include:[...base.test.include,"server/tests/inventoryLabelPrinting.test.ts","server/tests/delegateSupplyStage.test.tsx","server/tests/purchaseDelegateViews.test.tsx","server/tests/lotScannerKeyboard.test.ts"]}};
