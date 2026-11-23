import QRCode from "qrcode";
import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { createPaymentOrder, createSelfSendOrder } from "@/lib/services/orders";
import { requireClient } from "@/lib/session";
import { paymentOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = paymentOrderSchema.parse(await request.json());
    if (data.kind === "wallet") {
      const order = await createSelfSendOrder({
        companyId: session.companyId,
        actorId: session.sub,
        beneficiaryId: data.beneficiaryId,
        usdcAmount: data.usdcAmount,
        ip: clientIp(request),
      });
      const [feeQr, paymentQr] = await Promise.all([
        QRCode.toDataURL(order.feeAddress, { margin: 1, width: 180 }),
        QRCode.toDataURL(order.liquidationAddress, { margin: 1, width: 180 }),
      ]);
      return apiOk(
        {
          ok: true,
          kind: "wallet",
          id: order.id,
          usdcAmount: order.usdcAmount,
          fixedFeeUsd: order.fixedFeeUsd,
          feeAddress: order.feeAddress,
          feeChain: order.feeChain,
          liquidationAddress: order.liquidationAddress,
          sendFeePercent: order.sendFeePercent,
          sendFeeUsdc: order.sendFeeUsdc,
          feeLegStatus: order.feeLegStatus,
          paymentLegStatus: order.paymentLegStatus,
          status: order.status,
          feeQr,
          paymentQr,
        },
        201,
      );
    }
    const order = await createPaymentOrder({
      companyId: session.companyId,
      actorId: session.sub,
      beneficiaryId: data.beneficiaryId,
      usdcAmount: data.usdcAmount,
      ip: clientIp(request),
    });
    return apiOk(
      {
        ok: true,
        kind: "bob",
        id: order.id,
        rate: order.rate,
        usdcAmount: order.usdcAmount,
        principalBob: order.principalBob,
        fixedFeeUsd: order.fixedFeeUsd,
        fixedFeeBob: order.fixedFeeBob,
        bobAmount: order.bobAmount,
        sendFeeUsdc: order.sendFeeUsdc,
        beneficiaryUsdc: order.beneficiaryUsdc,
      },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
