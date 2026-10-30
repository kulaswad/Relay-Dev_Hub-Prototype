export type MessagingChannel = "sms" | "rcs" | "whatsapp";

export interface RateCardEntry {
  channel: MessagingChannel;
  costPerMessageINR: number;
  label: string;
}

export const RATE_CARD: Record<MessagingChannel, RateCardEntry> = {
  sms: {
    channel: "sms",
    costPerMessageINR: 0.12,
    label: "Transactional SMS (160 char GSM-7)",
  },
  rcs: {
    channel: "rcs",
    costPerMessageINR: 0.25,
    label: "RCS Business Messaging (Basic/Single)",
  },
  whatsapp: {
    channel: "whatsapp",
    costPerMessageINR: 0.70,
    label: "WhatsApp Business Template (Utility)",
  },
};

export interface MessageCostCalculation {
  estimated: number;
  currency: "INR";
  actualCharged: number;
  wouldBeCharged: number;
}

export function calculateMessageCost(
  channel: MessagingChannel,
  environment: "test" | "live"
): MessageCostCalculation {
  const rate = RATE_CARD[channel]?.costPerMessageINR ?? 0.12;

  return {
    estimated: rate,
    currency: "INR",
    actualCharged: environment === "live" ? rate : 0,
    wouldBeCharged: rate,
  };
}
