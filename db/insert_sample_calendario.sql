-- Esempi per testare subito il calendario

-- Campionati
INSERT INTO campionati (id, nome, colore, emoji, sigla, attivo) VALUES
  ('f1', 'Formula 1', '#E10600', '🏎️', 'F1', TRUE),
  ('f2', 'Formula 2', '#0090D0', '🏎️', 'F2', TRUE),
  ('f3', 'Formula 3', '#FF6800', '🏎️', 'F3', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Utenti
INSERT INTO utenti (username, nome, cognome, nome_completo) VALUES
  ('gcianci', 'Giuseppe', 'Cianci', 'Giuseppe Cianci'),
  ('dmuscarella', 'Daniele', 'Muscarella', 'Daniele Muscarella')
ON CONFLICT (username) DO NOTHING;

-- Eventi
INSERT INTO eventi_calendario (titolo, campionato_id, data_inizio, data_fine, max_accrediti, programmazione_weekend)
VALUES
  ('Gran Premio di Monaco', 'f1', '2026-05-22', '2026-05-24', 10, NULL),
  ('Gran Premio d''Italia', 'f2', '2026-09-10', '2026-09-12', 8, NULL)
ON CONFLICT DO NOTHING;

-- Sessioni weekend 
INSERT INTO sessioni_weekend (evento_id, nome_sessione, data_sessione, orario_sessione, campionato_id)
VALUES
  (1, 'PL1', '2026-05-22', '10:00', 'f1'),
  (1, 'Qualifiche', '2026-05-23', '14:00', 'f1'),
  (1, 'Gara', '2026-05-24', '15:00', 'f1'),
  (2, 'PL1', '2026-09-10', '11:00', 'f2'),
  (2, 'Gara', '2026-09-12', '16:00', 'f2')
ON CONFLICT DO NOTHING;

-- Prenotazioni
INSERT INTO prenotazioni_accrediti (evento_id, username)
VALUES (1, 'gcianci'), (2, 'dmuscarella')
ON CONFLICT DO NOTHING;

-- Notifiche calendario
INSERT INTO notifiche_calendario (tipo, messaggio, evento_id)
VALUES ('info', 'Benvenuto nel nuovo calendario!', NULL)
ON CONFLICT DO NOTHING;

-- Notifiche lette
INSERT INTO notifiche_lette (username, notifica_id)
VALUES ('gcianci', 1)
ON CONFLICT (username, notifica_id) DO NOTHING;
