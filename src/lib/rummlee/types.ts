/** In person handoff. Legacy DB rows may still say `porch`; canonicalize on read. */
export type HandoffMode = "official" | "public" | "person";
export type ListingStatus = "live" | "sold" | "held" | "outside" | "bundle" | "bundled" | "withdrawn" | "abandoned" | "stashed";
export type OfferStatus = "pending" | "countered" | "accepted" | "declined";
export type OrderStatus = "escrow" | "picked_up" | "cancelled";
export type SaleStatus = "live" | "ended" | "draft";
export type SaleChannel = "online" | "physical" | "both";

export type Profile = {
  id: string;
  handle: string;
  neighborhood: string | null;
  zip: string | null;
  city: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
  phone: string | null;
  profileComplete: boolean;
  isPremium: boolean;
  plusPlan: "month" | "year" | null;
  plusTier: "plus" | "trio" | null;
  plusUntil: string | null;
  isStaff: boolean;
  walletCents: number;
  verified: boolean;
  thumbsUp: number;
  thumbsDown: number;
  rep: number;
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
  channel: SaleChannel;
  physicalLocation: string | null;
  hoursStart: string | null;
  hoursEnd: string | null;
  handoffModes: HandoffMode[];
  handoffSpotId: string | null;
  status: SaleStatus;
  itemCount: number;
  onlineStartDow: number | null;
  onlineEndDow: number | null;
  liveOn: boolean;
  liveStartDow: number | null;
  liveEndDow: number | null;
  liveOpen: string | null;
  liveClose: string | null;
  alwaysOn?: boolean;
  featured?: boolean;
};

export type Listing = {
  id: string;
  saleId: string;
  saleName: string;
  sellerId: string;
  sellerHandle: string;
  sellerVerified?: boolean;
  sellerThumbsUp?: number;
  sellerThumbsDown?: number;
  sellerRep?: number;
  title: string;
  description: string;
  priceCents: number;
  buyNowCents: number | null;
  originalCents: number | null;
  category: string;
  condition: string;
  haul: string;
  sizeLabel: string | null;
  pack: "box" | "as_is" | null;
  weightLbs: number | null;
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
  onlineStartDow?: number | null;
  onlineEndDow?: number | null;
  liveOn?: boolean;
  liveStartDow?: number | null;
  liveEndDow?: number | null;
  liveOpen?: string | null;
  liveClose?: string | null;
  alwaysOn?: boolean;
  charitySplit?: boolean;
  featured?: boolean;
  /** Set after the sale ends. Visible to the seller and to +++ only. */
  overtimeCents?: number | null;
  upcoming?: boolean;
  /** +++ early look. Price is omitted until the sale starts. */
  priceHidden?: boolean;
  /** Rough distance from the viewer’s neighborhood. No street. */
  distanceLabel?: string | null;
};

export type Offer = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPhoto: string;
  listingPriceCents: number;
  buyerId: string;
  buyerHandle: string;
  sellerId: string;
  sellerHandle: string;
  amountCents: number;
  counterCents: number | null;
  status: OfferStatus;
  declinedBy: "buyer" | "seller" | "floor" | null;
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
  myScan?: string | null;
  myRatingOverall?: "up" | "down" | null;
  otherVerified?: boolean;
  payableAt?: string | null;
  paidOutAt?: string | null;
  disputeStatus?: string | null;
  checkedIn?: boolean;
  meetupNote?: string | null;
  disposition?: "pickup" | "abandoned" | null;
  /** Seller can hold a refused Fargo package for pickup, or leave it. */
  canLeave?: boolean;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type PendingRate = {
  orderId: string;
  listingTitle: string;
  listingPhoto: string;
  otherHandle: string;
  role: "buyer" | "seller";
  handoffType?: string;
};

export type ReceivedDown = {
  ratingId: string;
  listingTitle: string;
  overall: "down";
  challengeStatus: "open" | "upheld" | "removed" | null;
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
  pendingRates: PendingRate[];
  notices: Notice[];
};
