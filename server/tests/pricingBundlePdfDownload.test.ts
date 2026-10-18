import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPricingBundlePdf } from "../../client/src/lib/downloadPricingBundlePdf";

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe("Pricing bundle direct PDF download, no iframe or application API",()=>{
  it("downloads the exact server bytes with the bundle filename and releases the URL after the browser starts",async()=>{
    vi.useFakeTimers();
    const events:string[]=[];
    const anchor:any={click:vi.fn(()=>events.push("click")),remove:vi.fn(()=>events.push("remove"))};
    const createElement=vi.fn(()=>anchor),appendChild=vi.fn(()=>events.push("append"));
    vi.stubGlobal("window",{document:{createElement,body:{appendChild}},setTimeout});
    const createObjectURL=vi.fn((_blob:Blob)=>"blob:local-pdf"),revokeObjectURL=vi.fn();
    vi.stubGlobal("URL",{createObjectURL,revokeObjectURL});
    const bytes=Buffer.from("%PDF-frozen-document-\u0000\u00ff");
    downloadPricingBundlePdf({name:"DPB-2026-000001.pdf",content:bytes.toString("base64")});
    expect(createElement).toHaveBeenCalledWith("a");expect(anchor.download).toBe("DPB-2026-000001.pdf");expect(anchor.href).toBe("blob:local-pdf");expect(events).toEqual(["append","click","remove"]);
    const blob=createObjectURL.mock.calls[0][0] as Blob;expect(blob.type).toBe("application/pdf");expect(Buffer.from(await blob.arrayBuffer())).toEqual(bytes);
    expect(revokeObjectURL).not.toHaveBeenCalled();vi.advanceTimersByTime(60_000);expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-pdf");
  });
  it("still releases the URL if the browser refuses to initiate the download",()=>{
    vi.useFakeTimers();const remove=vi.fn(),revokeObjectURL=vi.fn();
    vi.stubGlobal("window",{document:{createElement:()=>({click:()=>{throw Error("blocked");},remove}),body:{appendChild:vi.fn()}},setTimeout});
    vi.stubGlobal("URL",{createObjectURL:()=>"blob:local-pdf",revokeObjectURL});
    expect(()=>downloadPricingBundlePdf({name:"DPB.pdf",content:btoa("%PDF-local")})).toThrow("blocked");
    expect(remove).toHaveBeenCalledOnce();vi.runAllTimers();expect(revokeObjectURL).toHaveBeenCalledOnce();
  });
});
