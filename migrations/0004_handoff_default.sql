-- Partner store is the default handoff. "porch" stays the legacy id for person to person.
alter table sales alter column handoff_modes set default 'official';
alter table listings alter column handoff_modes set default 'official';
alter table orders alter column handoff_type set default 'official';
