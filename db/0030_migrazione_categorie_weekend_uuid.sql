-- MIGRAZIONE SICURA: Aggiorna solo le relazioni, senza toccare dati

-- Aggiorna la colonna categoria_id in gruppi_redattori
ALTER TABLE gruppi_redattori ALTER COLUMN categoria_id TYPE UUID USING categoria_id::uuid;
ALTER TABLE gruppi_redattori DROP CONSTRAINT IF EXISTS gruppi_redattori_categoria_id_fkey;
ALTER TABLE gruppi_redattori ADD CONSTRAINT gruppi_redattori_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorie_weekend(id) ON DELETE CASCADE;

-- Aggiorna la colonna categoria_id in rss_feeds
ALTER TABLE rss_feeds ALTER COLUMN categoria_id TYPE UUID USING categoria_id::uuid;
ALTER TABLE rss_feeds DROP CONSTRAINT IF EXISTS rss_feeds_categoria_id_fkey;
ALTER TABLE rss_feeds ADD CONSTRAINT rss_feeds_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorie_weekend(id) ON DELETE CASCADE;
