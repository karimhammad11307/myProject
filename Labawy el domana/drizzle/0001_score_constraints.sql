CREATE FUNCTION domino_valid_scores(value jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE entry jsonb;
BEGIN
  IF jsonb_typeof(value) <> 'array' OR jsonb_array_length(value) NOT BETWEEN 2 AND 4 THEN RETURN false; END IF;
  FOR entry IN SELECT * FROM jsonb_array_elements(value) LOOP
    IF jsonb_typeof(entry) <> 'number' OR entry::text !~ '^[0-9]+$' OR entry::text::numeric > 1000000 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
--> statement-breakpoint
ALTER TABLE rounds ADD CONSTRAINT round_scores_valid CHECK (domino_valid_scores(scores));
--> statement-breakpoint
CREATE FUNCTION domino_round_side_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_array_length(NEW.scores) <> (SELECT count(*) FROM sides WHERE match_id=NEW.match_id) THEN
    RAISE EXCEPTION 'A round must include every side' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER round_side_count BEFORE INSERT OR UPDATE ON rounds FOR EACH ROW EXECUTE FUNCTION domino_round_side_count();
