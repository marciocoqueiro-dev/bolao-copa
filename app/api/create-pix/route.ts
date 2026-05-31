import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, amount } = await req.json();

    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Token do Mercado Pago não configurado" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: `Bolão Copa - ${name || "Participante"}`,
        payment_method_id: "pix",
        payer: {
          email: `participante${Date.now()}@gmail.com`,
          first_name: name || "Participante",
        },
      }),
    });

    const data = await response.json();

    console.log("STATUS MERCADO PAGO:", response.status);
    console.log("RESPOSTA MERCADO PAGO:", data);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Erro Mercado Pago",
          status: response.status,
          details: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      paymentId: data.id,
      qrCode: data.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64:
        data.point_of_interaction?.transaction_data?.qr_code_base64,
      ticketUrl: data.point_of_interaction?.transaction_data?.ticket_url,
    });
  } catch (error) {
    console.error("ERRO INTERNO CREATE PIX:", error);

    return NextResponse.json(
      { error: "Erro interno ao gerar PIX" },
      { status: 500 }
    );
  }
}