-- Counts table
CREATE TABLE echr_citation_counts (
    itemid varchar(50) PRIMARY KEY,
    cites_count integer NOT NULL DEFAULT 0,
    cited_by_count integer NOT NULL DEFAULT 0
);

-- Trigger function: adjust counts on edge INSERT/DELETE
CREATE FUNCTION update_citation_counts() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO echr_citation_counts (itemid, cites_count)
      VALUES (NEW.source_itemid, 1)
      ON CONFLICT (itemid) DO UPDATE SET cites_count = echr_citation_counts.cites_count + 1;
    INSERT INTO echr_citation_counts (itemid, cited_by_count)
      VALUES (NEW.target_itemid, 1)
      ON CONFLICT (itemid) DO UPDATE SET cited_by_count = echr_citation_counts.cited_by_count + 1;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE echr_citation_counts SET cites_count = cites_count - 1 WHERE itemid = OLD.source_itemid;
    UPDATE echr_citation_counts SET cited_by_count = cited_by_count - 1 WHERE itemid = OLD.target_itemid;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_citation_counts
  AFTER INSERT OR DELETE ON echr_edge
  FOR EACH ROW EXECUTE FUNCTION update_citation_counts();