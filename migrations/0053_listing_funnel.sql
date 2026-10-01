create table if not exists listing_funnel (
  day date not null,
  step text not null,
  n integer not null default 0,
  primary key (day, step)
);
