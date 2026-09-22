delete from offers a
using offers b
where a.listing_id = b.listing_id
  and a.buyer_id = b.buyer_id
  and a.created_at < b.created_at;

create unique index if not exists offers_one_per_buyer
  on offers (listing_id, buyer_id);
