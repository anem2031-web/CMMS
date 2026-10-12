import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { localizeNamedRecords } from "../../services/translation/localizedMasterData";

export const nfcRouter = router({
  scanTag: protectedProcedure.input(z.object({
    rfidTag: z.string().min(1, "يجب توفير رقم الرقاقة"),
  })).mutation(async ({ input, ctx }) => {
    // ✅ Find asset by RFID tag
    const asset = await db.getAssetByRfidTag(input.rfidTag);
    if (!asset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "الأصل غير موجود. يرجى تسجيل الرقاقة أولاً.",
      });
    }
    // ✅ Get site/location associated with the asset
    const site = asset.siteId ? await db.getSiteById(asset.siteId) : null;
    // ✅ Get section associated with the asset
    let section: { id: number; name: string } | null = null;
    if (asset.sectionId) {
      const sectionsList = await db.getSections();
      const found = sectionsList.find((s: any) => s.id === asset.sectionId);
      if (found) section = { id: found.id, name: found.name, nameEn: found.nameEn, nameUr: found.nameUr } as any;
    }
    const language = (ctx.user.preferredLanguage || "ar") as any;
    const [localizedAsset] = await localizeNamedRecords("ASSET", [asset as any], language);
    const localizedSite = site ? (await localizeNamedRecords("SITE", [site as any], language))[0] : null;
    const localizedSection = section ? (await localizeNamedRecords("SECTION", [section as any], language))[0] : null;
    return {
      success: true,
      asset: {
        id: asset.id,
        assetNumber: asset.assetNumber,
        name: localizedAsset?.name || asset.name,
        description: asset.description,
        category: asset.category,
        brand: asset.brand,
        model: asset.model,
        serialNumber: asset.serialNumber,
        siteId: asset.siteId,
        sectionId: asset.sectionId,
        locationDetail: asset.locationDetail,
        photoUrl: asset.photoUrl,
        rfidTag: asset.rfidTag,
      },
      site: localizedSite ? { id: localizedSite.id, name: localizedSite.name, address: localizedSite.address } : null,
      section: localizedSection ? { id: localizedSection.id, name: localizedSection.name } : null,
    };
  }),

  lookupTag: protectedProcedure.input(z.object({
    rfidTag: z.string().min(1),
  })).query(async ({ input, ctx }) => {
    const asset = await db.getAssetByRfidTag(input.rfidTag);
    if (!asset) return null;
    const site = asset.siteId ? await db.getSiteById(asset.siteId) : null;
    const language = (ctx.user.preferredLanguage || "ar") as any;
    const [localizedAsset] = await localizeNamedRecords("ASSET", [asset as any], language);
    const localizedSite = site ? (await localizeNamedRecords("SITE", [site as any], language))[0] : null;
    return {
      asset: {
        id: asset.id,
        assetNumber: asset.assetNumber,
        name: localizedAsset?.name || asset.name,
        siteId: asset.siteId,
        locationDetail: asset.locationDetail,
        photoUrl: asset.photoUrl,
      },
      site: localizedSite ? { id: localizedSite.id, name: localizedSite.name } : null,
    };
  }),
});
