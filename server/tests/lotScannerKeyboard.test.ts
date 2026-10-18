import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";import vm from "node:vm";import ts from "typescript";
import { lotScannerPhysicalKey, resolveLotScannerInput } from "../../client/src/lib/lotScannerKeyboard";
const token="CMMS-LOT-11111111-2222-4333-8444-abcdef123456";
const keyboard=(text:string)=>[...text].map(char=>lotScannerPhysicalKey({code:/[a-z]/i.test(char)?`Key${char.toUpperCase()}`:/\d/.test(char)?`Digit${char}`:"Minus",shiftKey:/[A-Z]/.test(char)})).join("");
describe("Lot scanning under Arabic and English keyboard layouts",()=>{
  it("reconstructs the physical scanner code and recovers only a complete known lot identifier",()=>{
    const physical=keyboard(token);expect(physical).toBe(token);expect(resolveLotScannerInput("أحرف عربية من نفس مفاتيح القارئ",physical)).toBe(token);
    expect(resolveLotScannerInput("حروف عربية",keyboard("LOT-2026-00007"))).toBe("LOT-2026-00007");
  });
  it("keeps a correct English/camera QR unchanged even when stale physical text exists",()=>{
    expect(resolveLotScannerInput(token,"LOT-2026-99999")).toBe(token);expect(resolveLotScannerInput(token+"\r\n","")).toBe(token);
  });
  it.each(["",token.slice(0,-1),"]Q3"+token,"OTHER-123","CMMS-LOT-../../1"])("does not guess from incomplete or unrelated physical data: %s",physical=>{
    expect(resolveLotScannerInput("نص عربي",physical)).toBe("نص عربي");
  });
  it("does not change ordinary numeric/product barcodes or pasted values",()=>{
    expect(resolveLotScannerInput("061-74",token)).toBe("061-74");expect(resolveLotScannerInput("١٢٣٤","")).toBe("١٢٣٤");
  });
  it("does not change identifiers to another inventory or remove server checks",()=>{
    const wrong="CMMS-LOT-99999999-2222-4333-8444-abcdef123456";expect(resolveLotScannerInput(wrong,token)).toBe(wrong);
    expect(lotScannerPhysicalKey({code:"Slash",shiftKey:false})).toBeNull();
  });
});

describe("Actual scanner component keyboard handlers",()=>{
  const source=ts.createSourceFile("Scanner.tsx",fs.readFileSync("client/src/components/common/BarcodeScanner.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const handlers:Record<string,string>={};
  function find(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==="handleManualSubmit")handlers.submit=node.initializer!.getText(source);if(ts.isJsxAttribute(node)&&["onKeyDown","onChange"].includes(node.name.getText(source))&&ts.isJsxExpression(node.initializer!))handlers[node.name.getText(source)]=node.initializer.expression!.getText(source);ts.forEachChild(node,find);}find(source);
  function fixture(){const onScan=vi.fn();const context:any={value:"",physicalInput:{current:{text:"",expectedChange:false}},onScan,resolveLotScannerInput,lotScannerPhysicalKey};context.setValue=(value:string)=>{context.value=value;};const evaluate=(text:string)=>vm.runInNewContext(ts.transpileModule(`(${text})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);context.handleManualSubmit=evaluate(handlers.submit);return{context,onScan,key:evaluate(handlers.onKeyDown),change:evaluate(handlers.onChange)};}
  it("submits the full DOM value with physical keyboard reconstruction even if React state trails the final key",()=>{
    const f=fixture();const input={value:"",selectionStart:0,selectionEnd:0};
    for(const char of token){const code=/[a-z]/i.test(char)?`Key${char.toUpperCase()}`:/\d/.test(char)?`Digit${char}`:"Minus";f.key({key:/[a-z]/i.test(char)?"ا":char,code,shiftKey:/[A-Z]/.test(char),currentTarget:input});input.value+=/[a-z]/i.test(char)?"ا":char;input.selectionStart=input.selectionEnd=input.value.length;f.change({target:input});}
    f.context.value=input.value.slice(0,-1);const preventDefault=vi.fn();f.key({key:"Enter",currentTarget:input,preventDefault});expect(f.onScan).toHaveBeenCalledOnce();expect(f.onScan).toHaveBeenCalledWith(token);expect(preventDefault).toHaveBeenCalledOnce();expect(f.context.physicalInput.current.text).toBe("");
  });
  it("does not reuse physical data for a paste or unrelated input",()=>{const f=fixture();f.context.physicalInput.current.text=token;f.change({target:{value:"نص ملصق"}});f.context.handleManualSubmit();expect(f.onScan).toHaveBeenCalledWith("نص ملصق");});
});
