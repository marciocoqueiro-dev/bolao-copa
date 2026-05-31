import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const paymentId =
      body?.data?.id ||
      body?.id ||
      body?.resource?.split("/")?.pop();

    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = await paymentResponse.json();

    console.log("WEBHOOK PAYMENT:", payment);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    if (payment.status === "approved") {
      await supabase
        .from("participants")
        .update({
          paid: true,
          payment_status: "approved",
          payment_amount: payment.transaction_amount,
          payment_approved_at: payment.date_approved,
          payment_method: payment.payment_method_id || "pix",
        })
        .eq("payment_id", String(payment.id));
    } else {
      await supabase
        .from("participants")
        .update({
          payment_status: payment.status,
          payment_amount: payment.transaction_amount,
          payment_method: payment.payment_method_id || "pix",
        })
        .eq("payment_id", String(payment.id));
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("ERRO WEBHOOK MERCADO PAGO:", error);

    return NextResponse.json(
      { error: "Erro no webhook" },
      { status: 500 }
    );
  }
}