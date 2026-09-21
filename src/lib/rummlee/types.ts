export type HandoffMode = "porch" | "official";
export type ListingStatus = "live" | "sold" | "held";
export type OfferStatus = "pending" | "countered" | "accepted" | "declined";
export type OrderStatus = "escrow" | "picked_up" | "cancelled";
export type SaleStatus = "live" | "ended" | "draft";

export type Profile = {
  id: string;
  handle: string;
  neighborhood: string | null;
  zip: string | null;
  isPremium: boolean;
  walletCents: number;
};

export type SpotKind = "partner" | "public";

export type HandoffSpot = {
  id: string;
  name: string;
  area: string;
  hint: string;
  kind: SpotKind;
};

export type Sale = {
  id: string;
  sellerId: string;
  sellerHandle: string;
  name: string;
  kind: string;
  neighborhood: string;
  startsOn: string;
  endsOn: string;
  handoffModes: HandoffMode[];
  handoffSpotId: string | null;
  status: SaleStatus;
  itemCount: number;
};

export type Listing = {
  id: string;
  saleId: string;
  saleName: string;
  sellerId: string;
  sellerHandle: string;
  title: string;
  description: string;
  priceCents: number;
  buyNowCents: number | null;
  originalCents: number | null;
  category: string;
  condition: string;
  haul: string;
  neighborhood: string;
  handoffModes: HandoffMode[];
  handoffSpotName: string | null;
  handoffSpotArea: string | null;
  handoffSpotHint: string | null;
  handoffSpotKind: SpotKind | null;
  photoUrl: string;
  status: ListingStatus;
  saleStartsOn: string;
  saleEndsOn: string;
  saved?: boolean;
};

export type Offer = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPhoto: string;
  buyerId: string;
  buyerHandle: string;
  sellerId: string;
  sellerHandle: string;
  amountCents: number;
  counterCents: number | null;
  status: OfferStatus;
  note: string | null;
  createdAt: string;
};

export type Message = {
  id: string;
  listingId: string;
  listingTitle: string;
  fromId: string;
  fromHandle: string;
  toId: string;
  body: string;
  createdAt: string;
};

export type Order = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPhoto: string;
  buyerId: string;
  buyerHandle: string;
  sellerId: string;
  sellerHandle: string;
  amountCents: number;
  feeCents: number;
  status: OrderStatus;
  pickupCode: string;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  handoffType: HandoffMode;
  createdAt: string;
};

export type WalletTx = {
  id: string;
  kind: string;
  amountCents: number;
  note: string | null;
  createdAt: string;
};

export type InboxPayload = {
  offersIn: Offer[];
  offersOut: Offer[];
  orders: Order[];
  messages: Message[];
};
